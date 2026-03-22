export default {
  testEnvironment: "node",
  testTimeout: 20000,
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "routes/**/*.js",
    "models/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
  maxWorkers: 1, // Run tests sequentially to avoid database connection conflicts
};

