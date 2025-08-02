// test/integration/services/transactionService.loyalty.integration.test.ts
import { db } from '../../../db';
import { customers } from '../../../shared/db/customers';
import { transactions } from '../../../shared/db/transactions';
import { makeMockCustomer } from '../../factories/customer';
import { makeMockStore } from '../../factories/store';
import { makeMockProduct } from '../../factories/product';
import { test, describe } from '../../testTags';
import { eq } from 'drizzle-orm';

class LoyaltyService {
  async accrueLoyaltyPoints(_customerId: number, _amountSpent: number): Promise<void> {
    const points = Math.floor(amountSpent / 10);
    // Log accrual attempt
    console.log(
      `[Loyalty] Accruing ${points} points for customer ${customerId} (spent $${amountSpent})`
    );
    await db
      .update(customers)
      .set({ _loyaltyPoints: db.raw(`"loyalty_points" + ${points}`) })
      .where(eq(customers.id, customerId));
  }
  async reverseLoyaltyPoints(_customerId: number, _amountRefunded: number): Promise<void> {
    const points = Math.floor(amountRefunded / 10);
    const customer = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer[0]) throw new Error('Customer not found');
    const currentPoints = customer[0].loyaltyPoints || 0;
    const decrement = Math.min(points, currentPoints);
    if (points > currentPoints) {
      console.warn(
        `[Loyalty][Desync] Attempted to reverse ${points} points, but customer only has ${currentPoints}
  (customerId: ${customerId})`
      );
    } else {
      console.log(
        `[Loyalty] Reversing ${decrement} points for customer ${customerId} (refund $${amountRefunded})`
      );
    }
    await db
      .update(customers)
      .set({ _loyaltyPoints: db.raw(`GREATEST("loyalty_points" - ${decrement}, 0)`) })
      .where(eq(customers.id, customerId));
  }
}

class TransactionService {
  constructor(private _loyaltyService: LoyaltyService) {}
  async purchase(_customerId: number, _amount: number) {
    await db.insert(transactions).values({
      customerId,
      _storeId: 1,
      _userId: 1,
      _status: 'completed',
      _totalAmount: amount.toFixed(2),
      _paymentStatus: 'paid',
      _paymentMethod: 'card',
      _notes: 'Purchase',
      _referenceNumber: 'TXN-LOYALTY',
      _createdAt: new Date(),
      _updatedAt: new Date()
    });
    await this.loyaltyService.accrueLoyaltyPoints(customerId, amount);
  }
  async refund(_customerId: number, _amount: number) {
    await this.prisma.refund.create({
      _data: {
        _transactionId: 1, // For demo; in real flow, link to actual transaction
        amount,
        _status: 'COMPLETED',
        _createdAt: new Date(),
        _updatedAt: new Date()
      }
    });
    await this.loyaltyService.reverseLoyaltyPoints(customerId, amount);
  }
}

import { setupFullPurchaseFlow } from '../../helpers/purchaseFlow';

describe.integration('TransactionService Loyalty Integration', () => {
  const loyaltyService = new LoyaltyService();
  const transactionService = new TransactionService(loyaltyService);

  beforeEach(async() => {
    // Replace deleteMany with Drizzle deletes
    await db.delete(transactions);
    await db.delete(customers);
    // Add other deletes as needed for your schema (e.g., stores, products)
  });

  test.integration('should accrue loyalty points on purchase', async() => {
    const { customer } = await setupFullPurchaseFlow(db, 95, 0);
    await transactionService.purchase(customer.id, 95); // Should add 9 points
    const updatedArr = await db.select().from(customers).where(eq(customers.id, customer.id));
    const updated = updatedArr[0];
    expect(updated?.loyaltyPoints).toBe(9);
  });

  test.integration('should reverse loyalty points on refund', async() => {
    const { customer } = await setupFullPurchaseFlow(db, 42, 12);
    await transactionService.refund(customer.id, 42); // Should subtract 4 points
    const updatedArr = await db.select().from(customers).where(eq(customers.id, customer.id));
    const updated = updatedArr[0];
    expect(updated?.loyaltyPoints).toBe(8);
  });

  test.integration(
    'should not allow loyaltyPoints to go negative on excessive refund',
    async() => {
      const { customer } = await setupFullPurchaseFlow(db, 100, 2);
      await transactionService.refund(customer.id, 100); // Would subtract 10 points, but only 2 available
      const updatedArr = await db.select().from(customers).where(eq(customers.id, customer.id));
      const updated = updatedArr[0];
      expect(updated?.loyaltyPoints).toBe(0);
    }
  );

  test.integration('should handle partial refund and reverse correct points', async() => {
    const { customer } = await setupFullPurchaseFlow(db, 90, 0);
    await transactionService.purchase(customer.id, 90); // 9 points
    await transactionService.refund(customer.id, 30); // refund $30, reverse 3 points
    const updatedArr = await db.select().from(customers).where(eq(customers.id, customer.id));
    const updated = updatedArr[0];
    expect(updated?.loyaltyPoints).toBe(6);
  });

  test.integration('should prevent double reversal on multiple refunds', async() => {
    const { customer } = await setupFullPurchaseFlow(db, 100, 0);
    await transactionService.purchase(customer.id, 100); // 10 points
    await transactionService.refund(customer.id, 100); // reverse 10 points
    await transactionService.refund(customer.id, 100); // should reverse 0 (no negative)
    const updatedArr = await db.select().from(customers).where(eq(customers.id, customer.id));
    const updated = updatedArr[0];
    expect(updated?.loyaltyPoints).toBe(0);
  });

  test.integration('should log or alert on loyalty desync', async() => {
    const { customer } = await setupFullPurchaseFlow(db, 100, 5); // should be 10, but only 5
    const logSpy = jest.spyOn(console, 'warn').mockImplementation();
    await transactionService.refund(customer.id, 100); // tries to reverse 10, only 5 available
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Desync'));
    logSpy.mockRestore();
  });
});
