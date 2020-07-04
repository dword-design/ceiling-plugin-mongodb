export default endpoint => {
  let result = `mongodb://${endpoint.host}`
  if ((endpoint.port || 27017) !== 27017) {
    result += `:${endpoint.port || 27017}`
  }
  result += `/${endpoint.database}`
  return result
}
