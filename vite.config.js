"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const plugin_react_1 = __importDefault(require("@vitejs/plugin-react"));
const path_1 = __importDefault(require("path"));
exports.default = (0, vite_1.defineConfig)({
    root: 'client',
    plugins: [(0, plugin_react_1.default)()],
    build: {
        outDir: '../dist/client',
    },
    resolve: {
        alias: {
            '@': path_1.default.resolve(__dirname, './client/src'),
            '@components': path_1.default.resolve(__dirname, './client/src/components'),
            '@shared': path_1.default.resolve(__dirname, './shared'),
        },
    },
});
