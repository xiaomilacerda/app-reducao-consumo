import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [
    '.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts',
    'src/app/PAGES/**', 'supabase/functions/**',
  ] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Existing legacy untyped data adapters are still being migrated.
  // Keep these findings visible as warnings without hiding other lint errors.
  { rules: { '@typescript-eslint/no-explicit-any': 'warn' } },
];
