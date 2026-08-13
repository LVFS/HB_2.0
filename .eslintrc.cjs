// Config in formato .eslintrc (ESLint 8). Estensione .cjs perché il
// package.json dichiara "type": "module".
//
// Nota: eslint-plugin-react NON è attivo di proposito. La regola
// react/no-unknown-property segnalerebbe come errori tutte le prop degli
// elementi di react-three-fiber (<mesh position>, <boxGeometry args>, ...),
// che non sono tag HTML.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
};
