import { SelectProduct, SelectStore, SelectUser, SelectLoyaltyMember, SelectTransaction } from '@shared/schema';

export interface TopProduct extends SelectProduct {
  quantity: number;
  total: number;
}

export interface StoreMetrics {
  totalRevenue: number;
  averageTransaction: number;
  transactionCount: number;
}

export interface StoreWithMetrics extends SelectStore {
  metrics: StoreMetrics;
  topProducts: TopProduct[];
}

export interface GlobalMetrics {
  totalRevenue: number;
  averageTransaction: number;
  transactionCount: number;
}

export interface StorePerformanceResponse {
  storePerformance: StoreWithMetrics[];
  globalMetrics: GlobalMetrics;
  dateRangeDescription: string;
}

export interface TransactionWithDetails extends SelectTransaction {
  store: SelectStore;
  cashier: SelectUser;
  customer: SelectUser;
  loyaltyMember: SelectLoyaltyMember;
  pointsEarned: number;
  transactionId: string;
}
