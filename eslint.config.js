import js from "@eslint/js";

const browserGlobals = {
  Blob: "readonly",
  CustomEvent: "readonly",
  File: "readonly",
  FormData: "readonly",
  Image: "readonly",
  URL: "readonly",
  atob: "readonly",
  cancelAnimationFrame: "readonly",
  document: "readonly",
  indexedDB: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  requestAnimationFrame: "readonly",
  window: "readonly"
};

const nodeGlobals = {
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  console: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  process: "readonly"
};

export default [
  {
    ignores: [
      "client/dist/**",
      "client/test-results/**",
      "client/playwright-report/**",
      "node_modules/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["client/src/**/*.{js,jsx}", "client/tests/**/*.{js,jsx}", "client/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...browserGlobals,
        console: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "off"
    }
  },
  {
    files: ["server/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals
    }
  }
];
