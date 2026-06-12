/** Standalone jest config for Day 3 tests — does not require next/jest */
module.exports = {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ["**/tests/day3*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  preset: "ts-jest",
};
