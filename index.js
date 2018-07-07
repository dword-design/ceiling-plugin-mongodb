const MongoClient = require('mongodb').MongoClient
const CannotConnectError = require('./cannot-connect-error')
const notnull = require('not-null')

module.exports = {

  sync(fromEndpoint, toEndpoint) {

    function _url(endpoint) {
      var result = `mongodb://${notnull(endpoint.user, 'root')}:${notnull(endpoint.password, 'root')}@${notnull(endpoint.host, '127.0.0.1')}`
      if (notnull(endpoint.port, 27017) != 27017) {
        result += `:${notnull(endpoint.port, 27017)}`;
      }
      result += `/${endpoint.database}?authSource=${endpoint.database}`
      return result
    }

    const fromUrl = _url(fromEndpoint)
    const toUrl = _url(toEndpoint)
    return Promise.resolve(() => console.log('Connecting to the databases ...'))
      .then(() => Promise.all([
      MongoClient.connect(fromUrl, { useNewUrlParser: true }).catch(() => { throw new CannotConnectError(fromUrl) }),
      MongoClient.connect(toUrl, { useNewUrlParser: true }).catch(() => { throw new CannotConnectError(toUrl) })
    ]))
    .then(clients => {
      var fromDb = clients[0].db(fromEndpoint.database);
      var toDb = clients[1].db(toEndpoint.database);
      return toDb.dropDatabase()
        .then(() => {
          console.log(`Dropping database ${toUrl} ...`);
          return fromDb.listCollections().toArray();
        })
        .then(collections => {
          console.log(`Importing collections from ${fromUrl} ...`);
          return Promise.all(
            collections.map(collection => {
              return fromDb.collection(collection.name).find().toArray()
                .then(objects => toDb.collection(collection.name).insertMany(objects))
            })
          )
        })
    })
  },

  endpointToString(endpoint) {
    var result = `mongodb://${endpoint.host}`
    if (notnull(endpoint.port, 27017) != 27017) {
      result += `:${notnull(endpoint.port, 27017)}`
    }
    result += `/${endpoint.database}`
    return result
  }
}
