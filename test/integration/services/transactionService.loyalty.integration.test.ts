// test/integration/services/transactionService.loyalty.integration.test.ts

import { makeMockCustomer } from '../../factories/customer';
import { makeMockStore } from '../../factories/store';
import { makeMockProduct } from '../../factories/product';
import { test, describe } from '../../testTags';
import { eq } from 'drizzle-orm';
import {
  drizzleTestDb,
  testCustomers,
  testTransactions,
  testRefunds,
  clearCustomers,
  clearStores,
  clearProducts,
  clearTransactions,
  clearRefunds,
  createCustomer,
  createStore,
  createProduct,
  createTransaction,
  createRefund,
  findCustomerById
} from '../../integration/drizzleTestDb';
import { setupFullPurchaseFlow } from '../../helpers/purchaseFlow';

class LoyaltyService {
  async accrueLoyaltyPoints(customerId: number, amountSpent: number): Promise<void> {
    const points = Math.floor(amountSpent / 10);
    // Log accrual attempt
    console.log(`[Loyalty] Accruing ${points} points for customer ${customerId} (spent $${amountSpent})`);
    // Increment loyalty points
    // Fetch current points, increment, and update
    const [customer] = await drizzleTestDb.select().from(testCustomers).where(eq(testCustomers.id, customerId));
    if (!customer) throw new Error('Customer not found');
    await drizzleTestDb.update(testCustomers)
      .set({ loyaltyPoints: customer.loyaltyPoints + points })
      .where(eq(testCustomers.id, customerId));
  }
  async reverseLoyaltyPoints(customerId: number, amountRefunded: number): Promise<void> {
    const points = Math.floor(amountRefunded / 10);
    const [customer] = await drizzleTestDb.select().from(testCustomers).where(eq(testCustomers.id, customerId));
    if (!customer) throw new Error('Customer not found');
    const decrement = Math.min(points, customer.loyaltyPoints);
    if (points > customer.loyaltyPoints) {
      console.warn(`[Loyalty][Desync] Attempted to reverse ${points} points, but customer only has ${customer.loyaltyPoints} (customerId: ${customerId})`);
    } else {
      console.log(`[Loyalty] Reversing ${decrement} points for customer ${customerId} (refund $${amountRefunded})`);
    }
    await drizzleTestDb.update(testCustomers)
      .set({ loyaltyPoints: Math.max(0, customer.loyaltyPoints - decrement) })
      .where(eq(testCustomers.id, customerId));
  }
}

class TransactionService {
  constructor(private loyaltyService: LoyaltyService) {}
  async purchase(customerId: number, amount: number) {
    await createTransaction({
      customerId,
      storeId: 1,
      userId: 1,
      type: 'SALE',
      status: 'COMPLETED',
      subtotal: amount,
      tax: 0,
      total: amount,
      paymentMethod: 'CARD',
      notes: 'Purchase',
      reference: 'TXN-LOYALTY',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.loyaltyService.accrueLoyaltyPoints(customerId, amount);
  }
  async refund(customerId: number, amount: number) {
    await createRefund({
      transactionId: 1, // For demo; in real flow, link to actual transaction
      amount,
      status: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.loyaltyService.reverseLoyaltyPoints(customerId, amount);
  }
}

describe.integration('TransactionService Loyalty Integration', () => {
  const loyaltyService = new LoyaltyService();
  const transactionService = new TransactionService(loyaltyService);

  beforeAll(async () => {});
  afterAll(async () => {});
  beforeEach(async () => {
    await clearRefunds();
    await clearTransactions();
    await clearCustomers();
    await clearStores();
    await clearProducts();
  });

  test.integration('should accrue loyalty points on purchase', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 95, 0);
    await transactionService.purchase(customer.id, 95); // Should add 9 points
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(9);
  });

  test.integration('should reverse loyalty points on refund', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 42, 12);
    await transactionService.refund(customer.id, 42); // Should subtract 4 points
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(8);
  });

  test.integration('should not allow loyaltyPoints to go negative on excessive refund', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 100, 2);
    await transactionService.refund(customer.id, 100); // Would subtract 10 points, but only 2 available
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(0);
  });

  test.integration('should handle partial refund and reverse correct points', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 90, 0);
    await transactionService.purchase(customer.id, 90); // 9 points
    await transactionService.refund(customer.id, 30);   // refund $30, reverse 3 points
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(6);
  });

  test.integration('should prevent double reversal on multiple refunds', async () => {
    const { customer } = await setupFullPurchaseFlow(prisma, 100, 0);
    await transactionService.purchase(customer.id, 100); // 10 points
    await transactionService.refund(customer.id, 100);   // reverse 10 points
    await transactionService.refund(customer.id, 100);   // should reverse 0 (no negative)
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
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
