module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'common/**/*.js',
    'aios-core/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testTimeout: 10000,
  verbose: true,
  roots: ['<rootDir>'],
  moduleDirectories: ['node_modules', '.'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
