'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.generateRandomString = generateRandomString;
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
