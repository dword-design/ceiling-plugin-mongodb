import { map } from '@dword-design/functions'
import mongodb from 'mongodb'

import CannotConnectError from './cannot-connect-error'

const getUrl = endpoint => {
  let result = `mongodb://${endpoint.user || 'root'}:${
    endpoint.password || 'root'
  }@${endpoint.host || '127.0.0.1'}`
  if ((endpoint.port || 27017) !== 27017) {
    result += `:${endpoint.port || 27017}`
  }
  result += `/${endpoint.database}?authSource=${endpoint.database}`
  return result
}

export default {
  CannotConnectError,
  endpointToString: endpoint => {
    let result = `mongodb://${endpoint.host}`
    if ((endpoint.port || 27017) !== 27017) {
      result += `:${endpoint.port || 27017}`
    }
    result += `/${endpoint.database}`
    return result
  },
  sync: async (fromEndpoint, toEndpoint, options = {}) => {
    const fromUrl = fromEndpoint |> getUrl
    const toUrl = toEndpoint |> getUrl
    const log = message => {
      if (options.log !== false) {
        console.log(message)
      }
    }
    log('Connecting to the databases ...')
    const clients = await Promise.all([
      mongodb.MongoClient.connect(fromUrl, { useNewUrlParser: true }).catch(
        () => {
          throw new CannotConnectError(fromUrl)
        }
      ),
      mongodb.MongoClient.connect(toUrl, { useNewUrlParser: true }).catch(
        () => {
          throw new CannotConnectError(toUrl)
        }
      ),
    ])
    const fromDb = clients[0].db(fromEndpoint.database)
    const toDb = clients[1].db(toEndpoint.database)
    log(`Dropping database ${toUrl} ...`)
    await toDb.dropDatabase()
    const collections = await fromDb.listCollections().toArray()
    log(`Importing collections from ${fromUrl} ...`)
    await (collections
      |> map(async collection => {
        const objects =
          fromDb.collection(collection.name).find().toArray() |> await
        return toDb.collection(collection.name).insertMany(objects)
      })
      |> Promise.all)
  },
}
