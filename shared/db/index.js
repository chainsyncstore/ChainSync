"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
const users_js_1 = require("./users.js");
const stores_js_1 = require("./stores.js");
const products_js_1 = require("./products.js");
const inventory_js_1 = require("./inventory.js");
const transactions_js_1 = require("./transactions.js");
// Database configuration
exports.schema = {
    users: users_js_1.users,
    stores: stores_js_1.stores,
    categories: products_js_1.categories,
    products: products_js_1.products,
    inventory: inventory_js_1.inventory,
    inventoryBatches: inventory_js_1.inventoryBatches,
    transactions: transactions_js_1.transactions,
    transactionItems: transactions_js_1.transactionItems
};
// Re-export all types and schemas
__exportStar(require("./base.js"), exports);
__exportStar(require("./users.js"), exports);
__exportStar(require("./stores.js"), exports);
__exportStar(require("./products.js"), exports);
__exportStar(require("./inventory.js"), exports);
__exportStar(require("./transactions.js"), exports);
