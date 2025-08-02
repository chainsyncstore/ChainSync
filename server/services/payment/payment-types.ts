import { Logger } from '../../utils/logger';

export interface PaymentProviderConfig {
  _paystack: {
    _secretKey: string;
    _publicKey: string;
  };
  flutterwave: {
    _secretKey: string;
    _publicKey: string;
  };
}

export interface PaymentVerificationResponse {
  _success: boolean;
  _reference: string;
  _amount: number;
  _currency: string;
  _metadata: Record<string, unknown>;
  _provider: 'paystack' | 'flutterwave';
  _timestamp: Date;
}

export interface PaymentAnalytics {
  _totalTransactions: number;
  _totalAmount: number;
  _successRate: number;
  _failedTransactions: number;
}

export interface PaymentWebhookRequest {
  _event: string;
  _data: Record<string, unknown>;
}

export interface PaymentStatus {
  _status: string;
  _message: string;
}

export interface PaymentInitializationResponse {
  _authorization_url: string;
  _reference: string;
  provider: 'paystack' | 'flutterwave';
}

export interface FlutterwavePaymentRequest {
  _card_number: string;
  _cvv: string;
  _expiry_month: string;
  _expiry_year: string;
  _amount: number;
  _currency: string;
  _email: string;
  _tx_ref: string;
  redirect_url?: string;
}
