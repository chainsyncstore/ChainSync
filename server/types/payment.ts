export interface PaymentStatus {
  _reference: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded';
  _amount: number;
  _currency: string;
  provider: 'paystack' | 'flutterwave';
  _metadata: Record<string, unknown>;
  _updatedAt: Date;
}

export interface PaymentAnalytics {
  _reference: string;
  _amount: number;
  _currency: string;
  provider: 'paystack' | 'flutterwave';
  _success: boolean;
  _metadata: Record<string, unknown>;
  _timestamp: Date;
}

export interface PaymentWebhookRequest {
  provider: 'paystack' | 'flutterwave';
  _reference: string;
  _status: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  signature?: string;
}
