import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";

export default [
  { ignores: ["dist", "node_modules", "supabase", "playwright-report", "test-results"] },
  js.configs.recommended,
  jsxA11y.flatConfigs.strict,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": react, react: reactPlugin },
    rules: {
      ...react.configs.recommended.rules,
      "react/jsx-uses-vars": "error", "react/jsx-no-undef": "error", "react/jsx-uses-react": "off",
      "react-hooks/set-state-in-effect": "off", "react-hooks/purity": "off", "react-hooks/refs": "off", "react-hooks/immutability": "off", "react-hooks/preserve-manual-memoization": "off", "react-hooks/incompatible-library": "off",
      "no-unused-vars": ["error", { varsIgnorePattern: "^(React|_)", argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
