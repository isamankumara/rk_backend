module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest/setup.js'],
  setupFiles: ['<rootDir>/jest/setEnvVars.ts'],
  modulePathIgnorePatterns: ['e2eUtil', 'unitUtil', 'unitTestData'],
  coveragePathIgnorePatterns: ['e2eUtil', 'unitUtil', 'unitTestData'],
};
