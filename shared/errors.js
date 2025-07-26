"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.AppError = void 0;
// Compatibility barrel for older test imports that expect '../shared/errors'
// Re-export AppError and ErrorCode from the canonical location in shared/types/errors
var errors_1 = require("./types/errors");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return errors_1.AppError; } });
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
