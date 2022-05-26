import { Config } from '@jest/types'

const config: Config.InitialOptions = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: './test/jestGlobalSetup.ts',
  modulePaths: ['<rootDir>/src', '<rootDir>/node_modules'],
  testTimeout: 10 * 60 * 1000,
  roots: ['.'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.test.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  }
}

export default config
