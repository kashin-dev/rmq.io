import { Config } from '@jest/types'

// Integration tests (tests/integration/*) need a live RabbitMQ broker and
// only run when RUN_INTEGRATION=1, e.g.:
//   RUN_INTEGRATION=1 RMQ_URL=amqp://guest:guest@localhost:5672 npm test
const runIntegration = process.env.RUN_INTEGRATION === '1'

const config: Config.InitialOptions = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  // globalSetup: './test/jestGlobalSetup.ts',
  modulePaths: ['<rootDir>/src', '<rootDir>/node_modules'],
  moduleNameMapper: {
    '^(\\.{1,2}/)rmqOperations\\.js$': '$1rmqOperations'
  },
  testTimeout: 10 * 60 * 1000,
  roots: ['.'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.test.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  testPathIgnorePatterns: runIntegration
    ? ['/node_modules/']
    : ['/node_modules/', '<rootDir>/tests/integration/']
}

export default config
