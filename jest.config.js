module.exports = {
  roots: ['src'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: 'tsconfig.json',
    },
  },
  collectCoverageFrom: ['!src/index.ts', '!src/test/fixture/**/*.ts'],
};
