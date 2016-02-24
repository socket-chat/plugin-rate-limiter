import { Cache } from './Cache'

export class RateLimiter {
  constructor({
    keyPrefix = '',
    client = null
  } = {}) {
    let prefix = 'chat:rate-limit:'
    if (keyPrefix) {
      prefix += ':' + keyPrefix
    }

    if (client) {
      this.cache = new Cache({ keyPrefix: prefix, client })
    } else {
      this.cache = Cache.make(prefix)
    }
  }

  attempts(key) {
    return this.cache.get(key, 0)
  }

  hit(key, decaySeconds = 5) {
    return this.cache.add(key, 1, decaySeconds)
      .then(() => this.cache.increment(key, decaySeconds))
  }

  exceedsLimit(key, maxAttempts, decaySeconds = 5) {
    return this.attempts(key, decaySeconds)
      .then(this.tooManyAttempts(key, maxAttempts, decaySeconds))
  }

  tooManyAttempts(key, maxAttempts, decaySeconds = 5) {
    return this.cache.has(key + ':lockout')
      .then(exists => {
        if (exists) {
          return true
        }

        return this.hit(key)
          .then(tries => {
            if (tries > maxAttempts) {
              return this.cache
                // set the lockout key with the timestamp it will expire
                .set(key + ':lockout', Date.now() + (decaySeconds * 1000), decaySeconds)
                .then(() => {
                  throw new Error('Rate limit [' + maxAttempts + '] for key [' + key + '] has been exceeded!')
                })
            }

            return false
          })
      })
  }
}

export default RateLimiter
