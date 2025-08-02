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
  createTransaction(_params: CreateTransactionParams): Promise<SelectTransaction>;
  updateTransaction(_id: string, _params: UpdateTransactionParams): Promise<SelectTransaction>;
  getTransactionById(_id: string): Promise<SelectTransaction | null>;
  createTransactionItem(_params: CreateTransactionItemParams): Promise<TransactionItem>;
  updateTransactionItem(_id: string, _params: UpdateTransactionItemParams): Promise<TransactionItem>;
  createTransactionPayment(_params: CreateTransactionPaymentParams): Promise<TransactionPayment>;
  updateTransactionPayment(_id: string, _params: UpdateTransactionPaymentParams): Promise<TransactionPayment>;
}
