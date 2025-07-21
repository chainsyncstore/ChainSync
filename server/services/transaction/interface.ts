import {
  CreateTransactionParams,
  UpdateTransactionParams,
  Transaction,
  TransactionItem,
  TransactionPayment,
  CreateTransactionItemParams,
  UpdateTransactionItemParams,
  CreateTransactionPaymentParams,
  UpdateTransactionPaymentParams
} from './types';

export interface ITransactionService {
  createTransaction(params: CreateTransactionParams): Promise<Transaction>;
  updateTransaction(id: string, params: UpdateTransactionParams): Promise<Transaction>;
  getTransactionById(id: string): Promise<Transaction | null>;
  createTransactionItem(params: CreateTransactionItemParams): Promise<TransactionItem>;
  updateTransactionItem(id: string, params: UpdateTransactionItemParams): Promise<TransactionItem>;
  createTransactionPayment(params: CreateTransactionPaymentParams): Promise<TransactionPayment>;
  updateTransactionPayment(id: string, params: UpdateTransactionPaymentParams): Promise<TransactionPayment>;
}
