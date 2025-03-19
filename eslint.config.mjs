import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'keyword-spacing': [
        'error',
        {
          after: true,
          overrides: {
            if: { after: false },
            for: { after: false },
            while: { after: false },
            catch: { after: false },
          },
        },
      ],
    },
  },
  pluginJs.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'tests/', '**/*.config.js'],
  },
];
