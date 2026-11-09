/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  // Source files use ".js" import specifiers for ESM; resolve them to the ".ts" files
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    // Tests run as CommonJS because they rely on jest.mock hoisting
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node10',
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
};
