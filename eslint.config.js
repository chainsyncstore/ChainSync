// eslint.config.js
import globals from "globals";

// Patch for trailing whitespace in globals
if (globals.browser["AudioWorkletGlobalScope "]) {
  delete globals.browser["AudioWorkletGlobalScope "];
  globals.browser["AudioWorkletGlobalScope"] = true;
}
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/", "dist.bak/", "node_modules/", "coverage/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  ...tseslint.configs.recommended,
  pluginReactConfig,
  {
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  prettierConfig
);
