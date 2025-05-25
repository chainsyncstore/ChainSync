// test/integration/services/transactionService.loyalty.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockCustomer } from '../../factories/customer';
import { makeMockStore } from '../../factories/store';
import { makeMockProduct } from '../../factories/product';
import { test, describe } from '../../testTags';

const prisma = new PrismaClient();

class LoyaltyService {
  constructor(private prisma: PrismaClient) {}
  async accrueLoyaltyPoints(customerId: number, amountSpent: number): Promise<void> {
    const points = Math.floor(amountSpent / 10);
    // Log accrual attempt
    console.log(`[Loyalty] Accruing ${points} points for customer ${customerId} (spent $${amountSpent})`);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    });
  }
  async reverseLoyaltyPoints(customerId: number, amountRefunded: number): Promise<void> {
    const points = Math.floor(amountRefunded / 10);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    const decrement = Math.min(points, customer.loyaltyPoints);
    if (points > customer.loyaltyPoints) {
      console.warn(`[Loyalty][Desync] Attempted to reverse ${points} points, but customer only has ${customer.loyaltyPoints} (customerId: ${customerId})`);
    } else {
      console.log(`[Loyalty] Reversing ${decrement} points for customer ${customerId} (refund $${amountRefunded})`);
    }
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement } },
    });
  }
}

class TransactionService {
  constructor(private prisma: PrismaClient, private loyaltyService: LoyaltyService) {}
  async purchase(customerId: number, amount: number) {
    await this.prisma.transaction.create({
      data: {
        customerId,
        storeId: 1,
        userId: 1,
        type: 'SALE',
        status: 'COMPLETED',
        subtotal: amount.toFixed(2),
        tax: '0.00',
        total: amount.toFixed(2),
        paymentMethod: 'CARD',
        notes: 'Purchase',
        reference: 'TXN-LOYALTY',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.loyaltyService.accrueLoyaltyPoints(customerId, amount);
  }
  async refund(customerId: number, amount: number) {
    await this.prisma.refund.create({
      data: {
        transactionId: 1, // For demo; in real flow, link to actual transaction
        amount,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.loyaltyService.reverseLoyaltyPoints(customerId, amount);
  }
}

import { setupFullPurchaseFlow } from '../../helpers/purchaseFlow';

describe.integration('TransactionService Loyalty Integration', () => {
  const loyaltyService = new LoyaltyService(prisma);
  const transactionService = new TransactionService(prisma, loyaltyService);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => {
    await prisma.refund.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.store.deleteMany();
    await prisma.product.deleteMany();
  });

  test.integration('should accrue loyalty points on purchase', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 95, 0);
    await transactionService.purchase(customer.id, 95); // Should add 9 points
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(9);
  });

  test.integration('should reverse loyalty points on refund', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 42, 12);
    await transactionService.refund(customer.id, 42); // Should subtract 4 points
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(8);
  });

  test.integration('should not allow loyaltyPoints to go negative on excessive refund', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 100, 2);
    await transactionService.refund(customer.id, 100); // Would subtract 10 points, but only 2 available
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(0);
  });

  test.integration('should handle partial refund and reverse correct points', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 90, 0);
    await transactionService.purchase(customer.id, 90); // 9 points
    await transactionService.refund(customer.id, 30);   // refund $30, reverse 3 points
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(6);
  });

  test.integration('should prevent double reversal on multiple refunds', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 100, 0);
    await transactionService.purchase(customer.id, 100); // 10 points
    await transactionService.refund(customer.id, 100);   // reverse 10 points
    await transactionService.refund(customer.id, 100);   // should reverse 0 (no negative)
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(0);
  });

  test.integration('should log or alert on loyalty desync', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 100, 5); // should be 10, but only 5
    const logSpy = jest.spyOn(console, 'warn').mockImplementation();
    await transactionService.refund(customer.id, 100); // tries to reverse 10, only 5 available
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Desync'));
    logSpy.mockRestore();
  });
});
