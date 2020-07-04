import { mapValues } from '@dword-design/functions'
import MongoInMemory from 'mongo-in-memory'

import self from '.'

const liveTasks = [
  { body: 'foo', title: 'task1' },
  { body: 'bar', title: 'task2' },
]
const runTest = test => async () => {
  const mongoInMemory = new MongoInMemory(8000)
  try {
    await mongoInMemory.start()
    const client = mongoInMemory.getConnection('test')
    const local = client.db('loc')
    const live = client.db('live')
    await Promise.all([
      local.addUser('root', 'root', {
        roles: [{ db: 'loc', role: 'readWrite' }],
      }),
      live.addUser('root', 'root', {
        roles: [{ db: 'live', role: 'readWrite' }],
      }),
    ])
    await test({ live, local })
  } finally {
    await mongoInMemory.stop()
  }
}

export default {
  endpointToString: {
    port: () =>
      expect(
        self.endpointToString({
          database: 'project',
          host: 'local.de',
          port: 4000,
        })
      ).toEqual('mongodb://local.de:4000/project'),
    valid: () =>
      expect(
        self.endpointToString({
          database: 'project',
          host: 'local.de',
        })
      ).toEqual('mongodb://local.de/project'),
  },
  sync:
    {
      "can't connect to from": async () => {
        const live = {
          database: 'live',
          host: '127.0.0.1',
          password: 'foo',
          port: 8000,
        }
        const local = {
          database: 'loc',
          host: '127.0.0.1',
          port: 8000,
        }
        await expect(self.sync(live, local, { log: false })).rejects.toThrow(
          new self.CannotConnectError(
            'mongodb://root:foo@127.0.0.1:8000/live?authSource=live'
          )
        )
      },
      "can't connect to to": async () => {
        const local = {
          database: 'loc',
          host: '127.0.0.1',
          password: 'foo',
          port: 8000,
        }
        const live = {
          database: 'live',
          host: '127.0.0.1',
          port: 8000,
        }
        await expect(self.sync(live, local)).rejects.toThrow(
          new self.CannotConnectError(
            'mongodb://root:foo@127.0.0.1:8000/loc?authSource=loc'
          )
        )
      },
      'empty to-database': async context => {
        const live = {
          database: 'live',
          host: '127.0.0.1',
          port: 8000,
        }
        const local = {
          database: 'loc',
          host: '127.0.0.1',
          port: 8000,
        }
        await context.live.collection('tasks').insertMany(liveTasks)
        await self.sync(live, local, { log: false })
        const localTasks = await context.local
          .collection('tasks')
          .find()
          .toArray()
        expect(localTasks).toEqual(liveTasks)
      },
      'non-empty to-database': async context => {
        const live = {
          database: 'live',
          host: '127.0.0.1',
          port: 8000,
        }
        const local = {
          database: 'loc',
          host: '127.0.0.1',
          port: 8000,
        }
        await context.live.collection('tasks').insertMany(liveTasks)
        await context.local.collection('foo').insertOne({ bar: 'baz' })
        await self.sync(live, local, { log: false })
        const result = await Promise.all([
          context.local.collection('tasks').find().toArray(),
          context.local.collection('foo').find().toArray(),
        ])
        expect(result[0]).toEqual(liveTasks)
        expect(result[1]).toEqual([])
      },
    } |> mapValues(runTest),
}
