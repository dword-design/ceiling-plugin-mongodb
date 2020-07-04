import { mapValues } from '@dword-design/functions'

import self from './endpoint-to-string'

const runTest = config => () =>
  expect(self(config.endpoint)).toEqual(config.result)

export default {
  port: {
    endpoint: {
      database: 'project',
      host: 'local.de',
      port: 4000,
    },
    result: 'mongodb://local.de:4000/project',
  },
  valid: {
    endpoint: {
      database: 'project',
      host: 'local.de',
    },
    result: 'mongodb://local.de/project',
  },
} |> mapValues(runTest)
