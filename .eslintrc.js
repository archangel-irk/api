'use strict';

const OFF = 0;
const ERROR = 2;
const NEVER = 'never';
const ALWAYS = 'always';

module.exports = {
  // Stop ESLint from looking for a configuration file in parent folders
  'root': true,

  parser: 'babel-eslint',

  env: {
    browser: true,
    es6: true,
    node: true,
    jquery: true,
  },
  extends: [
    'airbnb-base',
    'plugin:jsdoc/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module',
  },

  plugins: [
    // 'no-for-of-loops',
    // 'eslint:recommended',
    // 'plugin:import/errors',
    // 'plugin:import/warnings',
    'jsdoc',
  ],

  rules: {
    // BEST_PRACTICES

    // STRICT
    // "sourceType": "module" disallows strict mode directives
    strict: [ERROR, NEVER],

    // IMPORTS
    // Ensure consistent use of file extension within the import path
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/extensions.md
    'import/extensions': ['error', 'ignorePackages', {
      js: ALWAYS,
    }],

    // Require modules with a single export to use a default export
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/prefer-default-export.md
    'import/prefer-default-export': OFF,

    // JSDOC
    // do not require jsdoc
    // https://eslint.org/docs/rules/require-jsdoc
    'require-jsdoc': OFF,

    // https://github.com/gajus/eslint-plugin-jsdoc#require-jsdoc
    'jsdoc/require-jsdoc': OFF,

    // STYLE
    // allow use of unary operators, ++ and --
    // https://eslint.org/docs/rules/no-plusplus
    'no-plusplus': OFF,
  },
};