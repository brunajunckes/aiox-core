module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',

  // Test patterns from LOCAL (mais específico)
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage collection from LOCAL (paths atualizados com Story 4.5.2)
  collectCoverageFrom: [
    'common/**/*.js',
    'aios-core/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],

  // Coverage thresholds from REMOTE (boa prática de qualidade)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage ignore patterns from REMOTE
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/.husky/',
    '/dist/'
  ],

  // Timeout from REMOTE (30s melhor para operações longas)
  testTimeout: 30000,

  // Config from LOCAL
  verbose: true,
  roots: ['<rootDir>'],
  moduleDirectories: ['node_modules', '.'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Cross-platform config from REMOTE
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
