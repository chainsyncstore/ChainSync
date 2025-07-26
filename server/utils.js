"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomString = generateRandomString;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Generate a random string with specified length
 * @param length Length of string to generate
 * @returns Random string
 */
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt_1.default.hash(password, saltRounds);
}
/**
 * Compare a plain text password with a hash
 * @param password Plain text password
 * @param hash Hashed password
 * @returns Boolean indicating if passwords match
 */
async function comparePassword(password, hash) {
    return await bcrypt_1.default.compare(password, hash);
}
