import { relayVanillia, VANILLIA_EMBED_PREFIX } from './bridge/vanillia-relay.mjs'

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname.startsWith(VANILLIA_EMBED_PREFIX)) {
      return relayVanillia(request)
    }
    return env.ASSETS.fetch(request)
  },
}