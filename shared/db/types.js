// This file contains type definitions to handle circular dependencies
// Initialize global references
export function initializeGlobals() {
    if (!global.stores) {
        try {
            const { stores } = require('./stores');
            global.stores = stores;
        }
        catch (error) {
            console.warn('Failed to initialize stores:', error);
        }
    }
    if (!global.users) {
        try {
            const { users } = require('./users');
            global.users = users;
        }
        catch (error) {
            console.warn('Failed to initialize users:', error);
        }
    }
    if (!global.products) {
        try {
            const { products, categories } = require('./products'); // Assuming categories is in products.ts
            global.products = products;
            global.categories = categories;
        }
        catch (error) {
            console.warn('Failed to initialize products/categories:', error);
        }
    }
    if (!global.inventory) {
        try {
            const { inventory, inventoryBatches } = require('./inventory'); // Assuming inventoryBatches is in inventory.ts
            global.inventory = inventory;
            global.inventoryBatches = inventoryBatches;
        }
        catch (error) {
            console.warn('Failed to initialize inventory/inventoryBatches:', error);
        }
    }
    if (!global.suppliers) {
        try {
            const { suppliers } = require('./suppliers');
            global.suppliers = suppliers;
        }
        catch (error) {
            console.warn('Failed to initialize suppliers:', error);
        }
    }
}
//# sourceMappingURL=types.js.map