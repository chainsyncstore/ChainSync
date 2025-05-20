import { Logger } from '../../utils/logger';

export interface PaymentProviderConfig {
  paystack: {
    secretKey: string;
    publicKey: string;
  };
  flutterwave: {
    secretKey: string;
    publicKey: string;
  };
}

export interface PaymentVerificationResponse {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  provider: 'paystack' | 'flutterwave';
  timestamp: Date;
}

export interface PaymentAnalytics {
  totalTransactions: number;
  totalAmount: number;
  successRate: number;
  failedTransactions: number;
}

export interface PaymentWebhookRequest {
  event: string;
  data: Record<string, unknown>;
}

export interface PaymentStatus {
  status: string;
  message: string;
}

export interface PaymentInitializationResponse {
  authorization_url: string;
  reference: string;
  provider: 'paystack' | 'flutterwave';
}

export interface FlutterwavePaymentRequest {
  card_number: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
  amount: number;
  currency: string;
  email: string;
  tx_ref: string;
  redirect_url?: string;
}
