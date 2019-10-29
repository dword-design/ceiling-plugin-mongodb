import mongodb from 'mongodb'
import CannotConnectError from './cannot-connect-error'

export { CannotConnectError }

export const sync = (fromEndpoint, toEndpoint) => {

  const _url = endpoint => {
    let result = `mongodb://${endpoint.user || 'root'}:${endpoint.password || 'root'}@${endpoint.host || '127.0.0.1'}`
    if ((endpoint.port || 27017) != 27017) {
      result += `:${endpoint.port || 27017}`
    }
    result += `/${endpoint.database}?authSource=${endpoint.database}`
    return result
  }

  const fromUrl = _url(fromEndpoint)
  const toUrl = _url(toEndpoint)

  console.log('Connecting to the databases ...')

  return Promise.all([
    mongodb.MongoClient.connect(fromUrl, { useNewUrlParser: true }).catch(() => { throw new CannotConnectError(fromUrl) }),
    mongodb.MongoClient.connect(toUrl, { useNewUrlParser: true }).catch(() => { throw new CannotConnectError(toUrl) }),
  ])
    .then(clients => {
      const fromDb = clients[0].db(fromEndpoint.database)
      const toDb = clients[1].db(toEndpoint.database)
      return toDb.dropDatabase()
        .then(() => {
          console.log(`Dropping database ${toUrl} ...`)
          return fromDb.listCollections().toArray()
        })
        .then(collections => {
          console.log(`Importing collections from ${fromUrl} ...`)
          return Promise.all(
            collections.map(collection => fromDb.collection(collection.name).find().toArray()
              .then(objects => toDb.collection(collection.name).insertMany(objects))
            )
          )
        })
    })
}

export const endpointToString = endpoint => {
  let result = `mongodb://${endpoint.host}`
  if ((endpoint.port || 27017) != 27017) {
    result += `:${endpoint.port || 27017}`
  }
  result += `/${endpoint.database}`
  return result
}
