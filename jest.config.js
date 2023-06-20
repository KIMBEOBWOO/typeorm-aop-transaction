module.exports = {
  roots: ['<rootDir>'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testMatch: ['**/*.spec.ts'],
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: 'tsconfig.json',
    },
  },
};
