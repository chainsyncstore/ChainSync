import crypto from 'crypto';

import { db } from '@db/index';
import { schema as actualDbSchema } from '@shared/db/index'; // For precise Drizzle transaction typing
import * as schema from '@shared/schema'; // Consolidated schema import
import { transactions } from '@shared/schema'; // Keep for direct table access if preferred over schema.transactions
import { sql, eq } from 'drizzle-orm';
import { NodePgTransaction } from 'drizzle-orm/node-postgres';

import { IWebhookService, IWebhookAppErrors, WebhookAppErrors } from './types';
import { BaseService } from '../base/service';

// Define a more specific type for webhook data
interface WebhookData {
  reference?: string; // For Paystack
  tx_ref?: string; // For Flutterwave
  amount: number;
  status?: string; // e.g., from webhook: 'charge.success', 'transfer.completed'
  metadata?: {
    storeId?: number;
    userId?: number;
    [key: string]: any;
  };
  // Add other relevant fields from actual webhook payloads if needed
}

export class WebhookService extends BaseService implements IWebhookService {
  private logger = this.logger || console;

  // Placeholder for handleError method
  private handleError(error: unknown, context: string): void {
    this.logger.error({ error, context }, `Error in webhook processing: ${context}`);
  }

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
        throw WebhookAppErrors.CONFIGURATION_ERROR;
      }

      const expectedSignature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw WebhookAppErrors.INVALID_SIGNATURE;
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
            message: 'Unsupported event type',
          };
      }
    } catch (error: unknown) {
      this.handleError(error, 'Handling Paystack webhook');
      return { success: false, message: 'Error handling Paystack webhook.' };
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
        throw WebhookAppErrors.CONFIGURATION_ERROR;
      }

      const expectedSignature = crypto
        .createHmac('sha512', process.env.FLUTTERWAVE_SECRET_KEY)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw WebhookAppErrors.INVALID_SIGNATURE;
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
            message: 'Unsupported event type',
          };
      }
    } catch (error: unknown) {
      this.handleError(error, 'Handling Flutterwave webhook');
      return { success: false, message: 'Error handling Flutterwave webhook.' };
    }
  }

  private async processPaystackPayment(data: WebhookData): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async tx => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.referenceNumber, data.reference!),
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx
          .insert(transactions)
          .values({
            total: data.amount.toString(), // Added missing 'total' field, assuming it's same as totalAmount
            referenceNumber: data.reference!,
            totalAmount: data.amount.toString(),
            status: 'completed',
            paymentStatus: 'paid',
            paymentMethod: 'paystack',
            storeId: data.metadata?.storeId,
            userId: data.metadata?.userId,
          })
          .returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId: transaction.transactionId,
        reference: transaction.referenceNumber!,
        amount: Number(transaction.totalAmount),
      };
    } catch (error: unknown) {
      this.handleError(error, 'Processing Paystack payment');
      return {
        success: false,
        message: 'Error processing Paystack payment.',
        orderId: 0,
        reference: '',
        amount: 0,
      }; // Ensure all properties of return type are present
    }
  }

  private async processPaystackPayout(data: WebhookData): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async tx => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.referenceNumber, data.reference!),
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx
          .insert(transactions)
          .values({
            total: data.amount.toString(), // Added missing 'total' field, assuming it's same as totalAmount
            referenceNumber: data.reference!,
            totalAmount: data.amount.toString(),
            status: 'completed',
            paymentStatus: 'paid',
            paymentMethod: 'paystack',
            storeId: data.metadata?.storeId,
            userId: data.metadata?.userId,
          })
          .returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payout processed successfully',
        orderId: transaction.transactionId,
        reference: transaction.referenceNumber!,
        amount: Number(transaction.totalAmount),
      };
    } catch (error: unknown) {
      this.handleError(error, 'Processing Paystack payout');
      return {
        success: false,
        message: 'Error processing Paystack payout.',
        orderId: 0,
        reference: '',
        amount: 0,
      }; // Ensure all properties of return type are present
    }
  }

  private async processFlutterwavePayment(data: WebhookData): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async tx => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.referenceNumber, data.tx_ref!),
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx
          .insert(transactions)
          .values({
            total: data.amount.toString(), // Added missing 'total' field, assuming it's same as totalAmount
            referenceNumber: data.tx_ref!,
            totalAmount: data.amount.toString(),
            status: 'completed',
            paymentStatus: 'paid',
            paymentMethod: 'flutterwave',
            storeId: data.metadata?.storeId,
            userId: data.metadata?.userId,
          })
          .returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId: transaction.transactionId,
        reference: transaction.referenceNumber!,
        amount: Number(transaction.totalAmount),
      };
    } catch (error: unknown) {
      this.handleError(error, 'Processing Flutterwave payment');
      return {
        success: false,
        message: 'Error processing Flutterwave payment.',
        orderId: 0,
        reference: '',
        amount: 0,
      }; // Ensure all properties of return type are present
    }
  }

  public async processFlutterwavePayout(data: WebhookData): Promise<{
    success: boolean;
    message: string;
    orderId: number;
    reference: string;
    amount: number;
  }> {
    try {
      const transaction = await db.transaction(async tx => {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.referenceNumber, data.tx_ref!),
        });

        if (existing) {
          return existing;
        }

        const newTransaction = await tx
          .insert(transactions)
          .values({
            total: data.amount.toString(), // Added missing 'total' field, assuming it's same as totalAmount
            referenceNumber: data.tx_ref!,
            totalAmount: data.amount.toString(),
            status: 'completed',
            paymentStatus: 'paid',
            paymentMethod: 'flutterwave',
            storeId: data.metadata?.storeId,
            userId: data.metadata?.userId,
          })
          .returning();

        return newTransaction[0];
      });

      return {
        success: true,
        message: 'Payout processed successfully',
        orderId: transaction.transactionId,
        reference: transaction.referenceNumber!,
        amount: transaction.totalAmount,
      };
    } catch (error: unknown) {
      this.handleError(error, 'Processing Flutterwave payout');
      return {
        success: false,
        message: 'Error processing Flutterwave payout.',
        orderId: 0,
        reference: '',
        amount: 0,
      }; // Ensure all properties of return type are present
    }
  }
}
