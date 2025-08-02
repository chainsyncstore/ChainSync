'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
const express_1 = __importDefault(require('express'));
const path_1 = __importDefault(require('path'));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Serve static files from dist/client
app.use(express_1.default.static(path_1.default.join(__dirname, '../../dist/client')));
app.get('*', (_, res) => {
  res.sendFile(path_1.default.join(__dirname, '../../dist/client/index.html'));
});
app.listen(PORT, () => {
  console.log(`🚀 Server is running on _http://localhost:${PORT}`);
});
