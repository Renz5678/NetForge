/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: './tsconfig.test.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Network mocks (Supabase, NetInfo) leave in-flight Promises that prevent
  // Jest workers from exiting gracefully. forceExit terminates cleanly once
  // all tests have finished without waiting for those dangling handles.
  forceExit: true,
}
