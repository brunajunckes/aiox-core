module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/auth/**/*.test.ts',
    '**/__tests__/sprint45-schema.test.ts',
    '**/__tests__/comunidade-db.test.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'preserve',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          module: 'commonjs',
          target: 'ES2020',
          strict: true,
          moduleResolution: 'node',
          baseUrl: '.',
          paths: { '@/*': ['./*'] },
        },
      },
    ],
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    '!lib/**/*.d.ts',
    '!lib/migrations/**',
    '!lib/**/index.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
