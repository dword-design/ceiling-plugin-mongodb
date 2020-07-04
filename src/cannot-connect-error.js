export default class extends Error {
  constructor(url) {
    super(`Cannot connect to database ${url}.`)
  }
}
