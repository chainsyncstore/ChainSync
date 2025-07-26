"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.ErrorCategory = void 0;
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["SYSTEM"] = "system";
    ErrorCategory["AUTHENTICATION"] = "authentication";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["UPLOAD_FAILED"] = "UPLOAD_FAILED";
    ErrorCode["INVALID_FILE"] = "INVALID_FILE";
    ErrorCode["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    ErrorCode["UPLOAD_LIMIT_EXCEEDED"] = "UPLOAD_LIMIT_EXCEEDED";
    ErrorCode["AUTHENTICATION"] = "AUTHENTICATION";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
