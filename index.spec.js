const MongodbSyncProvider = require('./index')
const MongoInMemory = require('mongo-in-memory')
const CannotConnectError = require('./cannot-connect-error')
const consoleMock = require('console-mock2')

describe('MongodbSyncProvider', () => {

  describe('sync', () => {

    beforeEach(done => {
      this.mongoInMemory = new MongoInMemory(8000);
      this.mongoInMemory.start(err => {
        if (err) {
          console.error(err)
        } else {
          this.mongoInMemory.getConnection('test', (err, client) => {
            if (err) {
              console.error(err)
            } else {
              this.client = client
              this.local = this.client.db('loc')
              this.live = this.client.db('live')

              this.liveTasks = [
                { title: 'task1', body: 'foo' },
                { title: 'task2', body: 'bar' },
              ]
              Promise.all([
                this.local.addUser('root', 'root', { roles: [{ role: 'readWrite', db: 'loc' }] }),
                this.live.addUser('root', 'root', { roles: [{ role: 'readWrite', db: 'live' }] })
              ]).then(done)
            }
          })
        }
      })
    })

    afterEach(done => {
      this.mongoInMemory.stop(err => {
        expect(err).toBeNull()
        done()
      })
    })

    it('empty to-database', done => {
      const live = {
        database: 'live',
        host: '127.0.0.1',
        port: 8000
      }
      const local = {
        database: 'loc',
        host: '127.0.0.1',
        port: 8000
      }
      this.live.collection('tasks').insertMany(this.liveTasks)
        .then(() => consoleMock(() => MongodbSyncProvider.sync(live, local)))
        .then(() => this.local.collection('tasks').find().toArray())
        .then(localTasks => expect(localTasks).toEqual(this.liveTasks))
        .then(done)
    })

    it('non-empty to-database', done => {
      const live = {
        database: 'live',
        host: '127.0.0.1',
        port: 8000
      }
      const local = {
        database: 'loc',
        host: '127.0.0.1',
        port: 8000
      }
      this.live.collection('tasks').insertMany(this.liveTasks)
        .then(() => this.local.collection('foo').insertOne({ bar: 'baz' }))
        .then(() => consoleMock(() => MongodbSyncProvider.sync(live, local)))
        .then(() => Promise.all([
          this.local.collection('tasks').find().toArray(),
          this.local.collection('foo').find().toArray()
        ]))
        .then(result => {
          expect(result[0]).toEqual(this.liveTasks)
          expect(result[1]).toEqual([])
        })
        .then(done)
    })

    it(`can't connect to from`, done => {
      const live = {
        database: 'live',
        host: '127.0.0.1',
        port: 8000,
        password: 'foo',
      }
      const local = {
        database: 'loc',
        host: '127.0.0.1',
        port: 8000,
      }
      consoleMock(MongodbSyncProvider.sync(live, local))
        .then(() => { expect(false).toBeTruthy(); done() })
        .catch(err => {
          expect(err).toEqual(new CannotConnectError('mongodb://root:foo@127.0.0.1:8000/live?authSource=live'));
          done();
        })
    })

    it(`can't connect to to`, done => {
      const local = {
        database: 'loc',
        host: '127.0.0.1',
        port: 8000,
        password: 'foo',
      }
      const live = {
        database: 'live',
        host: '127.0.0.1',
        port: 8000,
      }
      consoleMock(MongodbSyncProvider.sync(live, local))
        .then(() => { expect(false).toBeTruthy(); done(); })
        .catch(err => {
          expect(err).toEqual(new CannotConnectError('mongodb://root:foo@127.0.0.1:8000/loc?authSource=loc'));
          done();
        })
    })
  })

  describe('endpointToString', () => {

    it('works', () => {
      expect(MongodbSyncProvider.endpointToString({ database: 'project', host: 'local.de' })).toEqual('mongodb://local.de/project')
      expect(MongodbSyncProvider.endpointToString({ database: 'project', host: 'local.de', port: 4000 })).toEqual('mongodb://local.de:4000/project')
    })
  })
})
