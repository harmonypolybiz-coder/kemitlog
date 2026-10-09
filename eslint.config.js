import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Les règles ne s'appuient pas sur les types : la vérification de types reste le rôle
// de `tsc -b` (TypeScript 7). ESLint lit la syntaxe avec sa propre copie de TypeScript 6,
// fournie par `overrides` dans package.json, car TypeScript 7 n'expose plus l'API
// dont typescript-eslint a besoin.
export default defineConfig([
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Un nom préfixé par « _ » signale une valeur volontairement ignorée
      // (par exemple un champ retiré d'un objet par déstructuration).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
])
