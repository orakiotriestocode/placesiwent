const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'assets/vendor/**',
      'inspector/versions/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'performance-report/**',
      '_site/**',
    ],
  },
  {
    files: [
      'tests/**/*.cjs',
      'scripts/**/*.cjs',
      '*.cjs',
      'assets/monitoring.js',
      'assets/arcade/*.js',
    ],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];
