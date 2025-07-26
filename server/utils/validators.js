"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFilename = exports.validateFileExtension = void 0;
const validateFileExtension = (filename) => {
    const allowedExtensions = ['.csv', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xlsx', '.json'];
    return allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};
exports.validateFileExtension = validateFileExtension;
const validateFilename = (filename) => {
    return /^[a-zA-Z0-9_\-\.]+$/.test(filename); // allows alphanumeric, -, _, .
};
exports.validateFilename = validateFilename;
