import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, process: 'readonly', Buffer: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Existing codebase has files that export both components and helpers.
      // Refactor to separate files in a later phase.
      'react-refresh/only-export-components': 'off',
      // Standard data-fetch patterns (setLoading, fetch-then-setState) are used
      // throughout existing effects. Proper fix requires useSyncExternalStore or
      // query-library migration — out of scope for Phase 0.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
