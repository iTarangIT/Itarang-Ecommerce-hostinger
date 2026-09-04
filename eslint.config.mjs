import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // `.next-*/**` covers verification builds made with NEXT_DIST_DIR — see the
  // `distDir` note in next.config.mjs. Without it, `eslint .` walks into the
  // build output and reports thousands of problems in generated code.
  {
    ignores: ['.next/**', '.next-*/**', 'node_modules/**', 'next-env.d.ts', 'public/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
