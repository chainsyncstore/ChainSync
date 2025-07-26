"use strict";
/**
 * Transaction Service Types
 *
 * This file defines the interfaces and types for the transaction service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionServiceErrors = exports.TransactionStatus = exports.TransactionType = exports.PaymentMethod = void 0;
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "cash";
    PaymentMethod["CREDIT_CARD"] = "credit_card";
    PaymentMethod["DEBIT_CARD"] = "debit_card";
    PaymentMethod["MOBILE_MONEY"] = "mobile_money";
    PaymentMethod["BANK_TRANSFER"] = "bank_transfer";
    PaymentMethod["STORE_CREDIT"] = "store_credit";
    PaymentMethod["LOYALTY_POINTS"] = "loyalty_points";
    PaymentMethod["OTHER"] = "other";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["SALE"] = "SALE";
    TransactionType["RETURN"] = "RETURN";
    TransactionType["REFUND"] = "REFUND";
    TransactionType["EXCHANGE"] = "EXCHANGE";
    TransactionType["LAYAWAY"] = "LAYAWAY";
    TransactionType["PAYMENT"] = "PAYMENT";
    TransactionType["DEPOSIT"] = "DEPOSIT";
    TransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["COMPLETED"] = "completed";
    TransactionStatus["CANCELLED"] = "cancelled";
    TransactionStatus["REFUNDED"] = "refunded";
    TransactionStatus["PARTIALLY_REFUNDED"] = "partially_refunded";
    TransactionStatus["FAILED"] = "failed";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
exports.TransactionServiceErrors = {
    TRANSACTION_NOT_FOUND: new Error("Transaction not found"),
    TRANSACTION_ITEM_NOT_FOUND: new Error("Transaction item not found"),
    STORE_NOT_FOUND: new Error("Store not found"),
    PRODUCT_NOT_FOUND: new Error("Product not found"),
    CUSTOMER_NOT_FOUND: new Error("Customer not found"),
    USER_NOT_FOUND: new Error("User not found"),
    INVALID_REFUND: new Error("Invalid refund operation"),
    INSUFFICIENT_STOCK: new Error("Insufficient stock available"),
    PAYMENT_VALIDATION_FAILED: new Error("Payment validation failed"),
    INVALID_PAYMENT_AMOUNT: new Error("Invalid payment amount"),
    INVALID_TRANSACTION_STATUS: new Error("Invalid transaction status"),
    INVALID_REFUND_AMOUNT: new Error("Invalid refund amount")
};
