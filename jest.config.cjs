module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/server/**/*.test.ts"],
  transform: { "^.+\\.(ts|tsx)$": "ts-jest" },
  moduleFileExtensions: ["ts", "js", "cjs", "mjs"],
  moduleNameMapper: {
    '^(.*vite)(\.ts)?$': '<rootDir>/server/__mocks__/vite.ts',
    '^(.*\/)?vite$': '<rootDir>/server/__mocks__/vite.ts',
    '^(.*\/)?vite\\.ts$': '<rootDir>/server/__mocks__/vite.ts',
    '^@db$': '<rootDir>/shared/db/index.ts',
    '^@db/index$': '<rootDir>/shared/db/index.ts',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
};
