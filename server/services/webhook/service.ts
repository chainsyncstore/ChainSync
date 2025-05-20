import { BaseService } from '../base/service';
import { IWebhookService, IWebhookServiceErrors, WebhookServiceErrors } from './types';
import { db } from '@db';
import { transactions } from '@shared/schema';
import crypto from 'crypto';

export class WebhookService extends BaseService implements IWebhookService {
  private static readonly PAYSTACK_SIGNATURE_HEADER = 'X-Paystack-Signature';
  private static readonly FLUTTERWAVE_SIGNATURE_HEADER = 'verif-hash';

  async handlePaystackWebhook(
    signature: string,
    payload: string
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    reference?: string;
    amount?: number;
  }> {
    try {
      if (!process.env.PAYSTACK_SECRET_KEY) {
        throw WebhookServiceErrors.CONFIGURATION_ERROR;
      }

      const expectedSignature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw WebhookServiceErrors.INVALID_SIGNATURE;
      }

      const event = JSON.parse(payload);
      
      switch (event.event) {
        case 'charge.success':
          return this.processPaystackPayment(event.data);
        case 'transfer.success':
          return this.processPaystackPayout(event.data);
        default:
          return {
            success: true,
            message: 'Unsupported event type'
          };
      }
    } catch (error) {
      this.handleError(error, 'Handling Paystack webhook');
    }
  }

  async handleFlutterwaveWebhook(
    signature: string,
    payload: string
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    reference?: string;
    amount?: number;
  }> {
    try {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) {
        throw WebhookServiceErrors.CONFIGURATION_ERROR;
      }

      const expectedSignature = crypto
        .createHmac('sha512', process.env.FLUTTERWAVE_SECRET_KEY)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw WebhookServiceErrors.INVALID_SIGNATURE;
      }

      const event = JSON.parse(payload);
      
      switch (event.event) {
        case 'charge.completed':
          return this.processFlutterwavePayment(event.data);
        case 'transfer.completed':
          return this.processFlutterwavePayout(event.data);
        default:
          return {
            success: true,
            message: 'Unsupported event type'
          };
      }
    } catch (error) {
      this.handleError(error, 'Handling Flutterwave webhook');
    }
  }

  private async processPaystackPayment(data: any): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async (tx) => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.reference, data.reference)
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx.insert(transactions).values({
          reference: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: 'completed',
          paymentMethod: 'paystack',
          metadata: data.metadata
        }).returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount
      };
    } catch (error) {
      this.handleError(error, 'Processing Paystack payment');
    }
  }

  private async processPaystackPayout(data: any): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async (tx) => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.reference, data.reference)
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx.insert(transactions).values({
          reference: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: 'completed',
          paymentMethod: 'paystack',
          type: 'payout',
          metadata: data.metadata
        }).returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payout processed successfully',
        orderId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount
      };
    } catch (error) {
      this.handleError(error, 'Processing Paystack payout');
    }
  }

  private async processFlutterwavePayment(data: any): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async (tx) => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.reference, data.reference)
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx.insert(transactions).values({
          reference: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: 'completed',
          paymentMethod: 'flutterwave',
          metadata: data.metadata
        }).returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount
      };
    } catch (error) {
      this.handleError(error, 'Processing Flutterwave payment');
    }
  }

  private async processFlutterwavePayout(data: any): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async (tx) => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.reference, data.reference)
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx.insert(transactions).values({
          reference: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: 'completed',
          paymentMethod: 'flutterwave',
          type: 'payout',
          metadata: data.metadata
        }).returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payout processed successfully',
        orderId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount
      };
    } catch (error) {
      this.handleError(error, 'Processing Flutterwave payout');
    }
  }
}
