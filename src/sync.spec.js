import { mapValues, noop } from '@dword-design/functions'
import * as mongodb from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

import self from './sync'

const liveTasks = [
  { body: 'foo', title: 'task1' },
  { body: 'bar', title: 'task2' },
]

const runTest = config => {
  config = { init: noop, ...config }

  return async () => {
    const localMongo = await MongoMemoryServer.create()

    const liveMongo = await MongoMemoryServer.create()

    const localUrl = localMongo.getUri()

    const liveUrl = liveMongo.getUri()

    const local = config.local || {
      database: 'loc',
      port: localMongo.instanceInfo.port,
    }

    const live = config.live || {
      database: 'live',
      port: liveMongo.instanceInfo.port,
    }
    try {
      const localClient = await mongodb.MongoClient.connect(localUrl)

      const liveClient = await mongodb.MongoClient.connect(liveUrl)
      try {
        const localDb = localClient.db('loc')

        const liveDb = liveClient.db('live')
        await Promise.all([
          localDb.addUser('root', 'root', {
            roles: [{ db: 'loc', role: 'readWrite' }],
          }),
          liveDb.addUser('root', 'root', {
            roles: [{ db: 'live', role: 'readWrite' }],
          }),
        ])
        await liveDb.collection('tasks').insertMany(liveTasks)
        await config.init(localDb)
        if (config.error) {
          await expect(self(live, local, { log: false })).rejects.toThrow(
            config.error
          )
        } else {
          await self(live, local, { log: false })
          await config.test(localDb)
        }
      } finally {
        await Promise.all([localClient.close(), liveClient.close()])
      }
    } finally {
      await Promise.all([localMongo.stop(), liveMongo.stop()])
    }
  }
}

export default {
  "can't connect to from": {
    error:
      process.platform === 'win32'
        ? 'Authentication failed.'
        : 'connect ECONNREFUSED 127.0.0.1:27017',
    local: {},
  },
  "can't connect to to": {
    error:
      process.platform === 'win32'
        ? 'Authentication failed.'
        : 'connect ECONNREFUSED 127.0.0.1:27017',
    live: {},
  },
  'empty to-database': {
    test: async localDb =>
      expect(await localDb.collection('tasks').find().toArray()).toEqual(
        liveTasks
      ),
  },
  'non-empty to-database': {
    init: localDb => localDb.collection('foo').insertOne({ bar: 'baz' }),
    test: async localDb => {
      const result = await Promise.all([
        localDb.collection('tasks').find().toArray(),
        localDb.collection('foo').find().toArray(),
      ])
      expect(result[0]).toEqual(liveTasks)
      expect(result[1]).toEqual([])
    },
  },
} |> mapValues(runTest)
