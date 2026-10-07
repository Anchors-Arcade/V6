import { relayVanillia } from '../../bridge/vanillia-relay.mjs'

export default {
  fetch(request) {
    const url = new URL(request.url)
    url.pathname = url.pathname.replace(/^\/api\/vanillia\//, '/vanillia-embed/')
    return relayVanillia(new Request(url, request))
  },
}