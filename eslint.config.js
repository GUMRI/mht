// @ts-check
const eslint = require('@eslint/js');
const {defineConfig} = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

let firebasePluginConfig = {};
try {
  const firebaseRulesPlugin = require('@firebase/eslint-plugin-security-rules');
  if (firebaseRulesPlugin && firebaseRulesPlugin.configs) {
    firebasePluginConfig = firebaseRulesPlugin.configs['flat/recommended'] || firebaseRulesPlugin.configs.recommended || {};
  }
} catch {
  // Optional fallback
}

module.exports = defineConfig([
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
    ],
    rules: {
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
  ...(firebasePluginConfig && Object.keys(firebasePluginConfig).length > 0 ? [firebasePluginConfig] : []),
]);
