import {
  CreateTransactionParams,
  UpdateTransactionParams,
  SelectTransaction,
  TransactionItem,
  TransactionPayment,
  CreateTransactionItemParams,
  UpdateTransactionItemParams,
  CreateTransactionPaymentParams,
  UpdateTransactionPaymentParams
} from './types';

export interface ITransactionService {
  createTransaction(params: CreateTransactionParams): Promise<SelectTransaction>;
  updateTransaction(id: string, params: UpdateTransactionParams): Promise<SelectTransaction>;
  getTransactionById(id: string): Promise<SelectTransaction | null>;
  createTransactionItem(params: CreateTransactionItemParams): Promise<TransactionItem>;
  updateTransactionItem(id: string, params: UpdateTransactionItemParams): Promise<TransactionItem>;
  createTransactionPayment(params: CreateTransactionPaymentParams): Promise<TransactionPayment>;
  updateTransactionPayment(id: string, params: UpdateTransactionPaymentParams): Promise<TransactionPayment>;
}
