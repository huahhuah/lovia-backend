import standard from 'eslint-config-standard'
import pluginImport from 'eslint-plugin-import'
import pluginN from 'eslint-plugin-n'
import pluginPromise from 'eslint-plugin-promise'
import globals from 'globals'

export default [
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      import: pluginImport,
      n: pluginN,
      promise: pluginPromise,
    },
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: {
      ...standard.rules
    }
  }
]
