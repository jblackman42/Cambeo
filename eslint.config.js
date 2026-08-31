import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/.next/**',
      '**/next-env.d.ts',
      '**/packages/server/dist/**',
      '**/packages/server/scripts/**',
      '**/scripts/**',
      '**/.wrangler/**',
      '**/wrangler.toml',
      '**/vendor/**',
      '**/apps/web/public/cards/**',
      '**/apps/web/src/lib/card-art-manifest.ts',
    ],
  },
  {
    files: ['packages/engine/**/*.ts', 'packages/shared/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random is banned in packages/engine and packages/shared. Use the seeded Rng.',
        },
      ],
    },
  },
  {
    files: ['packages/server/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
