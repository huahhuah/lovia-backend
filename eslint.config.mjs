import pluginImport from "eslint-plugin-import";
import pluginN from "eslint-plugin-n";
import pluginPromise from "eslint-plugin-promise";
import globals from "globals";

export default [
  {
    files: ["**/*.{js,mjs}"], // 處理所有 js, mjs 檔
    languageOptions: {
      globals: globals.node,
      sourceType: "module" // 用 import/export
    },
    plugins: {
      import: pluginImport,
      n: pluginN,
      promise: pluginPromise
    },
    extends: [
      "standard" // 直接套用標準風格
    ]
  }
];
