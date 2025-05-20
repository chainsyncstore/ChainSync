export interface PaymentStatus {
  reference: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  provider: 'paystack' | 'flutterwave';
  metadata: Record<string, unknown>;
  updatedAt: Date;
}

export interface PaymentAnalytics {
  reference: string;
  amount: number;
  currency: string;
  provider: 'paystack' | 'flutterwave';
  success: boolean;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface PaymentWebhookRequest {
  provider: 'paystack' | 'flutterwave';
  reference: string;
  status: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  signature?: string;
}
