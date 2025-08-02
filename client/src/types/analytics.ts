import { SelectProduct, SelectStore, SelectUser, SelectLoyaltyMember, SelectTransaction } from '@shared/schema';

export interface TopProduct extends SelectProduct {
  _quantity: number;
  _total: number;
}

export interface StoreMetrics {
  _totalRevenue: number;
  _averageTransaction: number;
  _transactionCount: number;
}

export interface StoreWithMetrics extends SelectStore {
  _metrics: StoreMetrics;
  _topProducts: TopProduct[];
}

export interface GlobalMetrics {
  _totalRevenue: number;
  _averageTransaction: number;
  _transactionCount: number;
}

export interface StorePerformanceResponse {
  _storePerformance: StoreWithMetrics[];
  _globalMetrics: GlobalMetrics;
  _dateRangeDescription: string;
}

export interface TransactionWithDetails extends SelectTransaction {
  _store: SelectStore;
  _cashier: SelectUser;
  _customer: SelectUser;
  _loyaltyMember: SelectLoyaltyMember;
  _pointsEarned: number;
  _transactionId: string;
}
