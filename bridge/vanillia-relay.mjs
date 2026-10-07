export const VANILLIA_EMBED_PREFIX = '/vanillia-embed/'
const SERVERS = {
  vercel: 'https://vanillia-vercel.plutoniumnet.work',
  'us-west': 'https://vanillia-us-west.plutoniumnet.work',
  europe: 'https://vanillia-europe.plutoniumnet.work',
}
const ROUTES = new Set(['vanillia', 'favicon', 'api/icon', 'service-worker.js', 'health', 'robots.txt'])
const INTERNAL_PATHS = [...ROUTES, 'ws'].sort((a, b) => b.length - a.length)
const MAX_TEXT_BYTES = 8 * 1024 * 1024
const STRIP_HEADERS = [
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-embedder-policy', 'cross-origin-opener-policy', 'permissions-policy',
  'content-encoding', 'content-length', 'transfer-encoding', 'connection',
  'set-cookie', 'service-worker-allowed', 'etag', 'last-modified',
]

function errorResponse(message, status) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function rewriteText(text, upstreamOrigin, localBase) {
  text = text.replaceAll(upstreamOrigin, localBase)
  const paths = INTERNAL_PATHS.map(path => path.replaceAll('.', '\\.')).join('|')
  text = text.replace(new RegExp(`(["'\x60])/(${paths})(?=[?"'\x60])`, 'g'), `$1${localBase}/$2`)
  for (const path of INTERNAL_PATHS) {
    for (const quote of ['"', "'", '`']) {
      text = text.replaceAll(`${quote}${localBase}/${path}${quote}`, `${quote}${new URL(localBase).pathname}/${path}${quote}`)
    }
  }
  text = text.replace(/next\.scope\s*=\s*["']\/["']/g, `next.scope = ${JSON.stringify(new URL(localBase).pathname + '/')}`)
  return text.replace(/<meta\b[^>]*http-equiv\s*=\s*(?:["']content-security-policy["']|content-security-policy)[^>]*>/gi, '')
}

async function readText(response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_TEXT_BYTES) {
      await reader.cancel()
      throw new RangeError('VanilliaPXY text response exceeds 8 MiB')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(response.headers.get('content-type') || '')?.[1] || 'utf-8'
  let decoder
  try { decoder = new TextDecoder(charset) } catch { decoder = new TextDecoder() }
  return decoder.decode(bytes)
}

export async function relayVanillia(request, fetchUpstream = fetch) {
  const url = new URL(request.url)
  const match = /^\/vanillia-embed\/([^/]+)\/(.+)$/.exec(url.pathname)
  if (!match || !Object.hasOwn(SERVERS, match[1]) || !ROUTES.has(match[2])) {
    return errorResponse('Unknown VanilliaPXY relay route', 404)
  }
  const [, serverId, route] = match
  if (!['GET', 'HEAD', 'POST'].includes(request.method) || (request.method === 'POST' && route !== 'vanillia')) {
    return errorResponse('Method not allowed', 405)
  }
  const target = url.searchParams.get(route === 'service-worker.js' ? 'target' : 'url')
  if (['vanillia', 'favicon', 'api/icon', 'service-worker.js'].includes(route)) {
    try {
      const parsed = new URL(target)
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid target')
    } catch {
      return errorResponse('A valid HTTP(S) target URL is required', 400)
    }
  }

  const upstreamOrigin = SERVERS[serverId]
  const upstreamUrl = new URL(`/${route}${url.search}`, upstreamOrigin)
  const localBase = `${url.origin}${VANILLIA_EMBED_PREFIX}${serverId}`

  const requestHeaders = new Headers()
  for (const name of ['accept', 'accept-language', 'content-type', 'range', 'if-range', 'user-agent']) {
    if (request.headers.has(name)) requestHeaders.set(name, request.headers.get(name))
  }
  requestHeaders.set('Accept-Encoding', 'identity')

  try {
    const upstream = await fetchUpstream(upstreamUrl.href, {
      method: request.method,
      headers: requestHeaders,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    })
    const headers = new Headers(upstream.headers)
    for (const name of STRIP_HEADERS) headers.delete(name)
    headers.set('Cache-Control', 'no-store')
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    if (headers.has('location')) {
      const destination = new URL(headers.get('location'), upstreamUrl)
      headers.set('Location', destination.origin === upstreamOrigin && ROUTES.has(destination.pathname.slice(1))
        ? `${localBase}${destination.pathname}${destination.search}${destination.hash}`
        : `${localBase}/vanillia?url=${encodeURIComponent(destination.href)}`)
    }

    if (route === 'service-worker.js') {
      headers.set('Service-Worker-Allowed', `${VANILLIA_EMBED_PREFIX}${serverId}/`)
    }

    const noBody = request.method === 'HEAD' || [204, 205, 304].includes(upstream.status)
    const type = headers.get('content-type') || ''
    let body = noBody ? null : upstream.body

    if (!noBody && /(?:text\/|javascript|json|xml)/i.test(type)) {
      body = rewriteText(await readText(upstream), upstreamOrigin, localBase)

      if (/text\/html/i.test(type)) {
        headers.set('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads')

        const sandboxSetup = `<script data-plu-sandbox>
Object.defineProperty(navigator,"serviceWorker",{value:undefined,configurable:false});
document.addEventListener("click",function(event){
  const anchor=event.target.closest?.("a[href]");
  if(!anchor||event.defaultPrevented||event.button!==0||anchor.hasAttribute("download"))return;
  const href=anchor.getAttribute("href");
  if(!href||/^(?:#|javascript:|mailto:|data:|blob:)/i.test(href))return;
  const destination=new URL(href,globalThis.__VANILLIAPXY_TARGET__||document.baseURI);
  if(!/^https?:$/.test(destination.protocol))return;
  const relay=${JSON.stringify(localBase)};
  const next=destination.href.startsWith(relay+"/")?destination.href:relay+"/vanillia?url="+encodeURIComponent(destination.href);
  event.preventDefault();
  if(anchor.target==="_blank"||event.ctrlKey||event.metaKey||event.shiftKey)window.open(next,"_blank","noopener");
  else location.assign(next);
},true);
</script>`

        body = /<head\b[^>]*>/i.test(body)
          ? body.replace(/<head\b[^>]*>/i, head => head + sandboxSetup)
          : sandboxSetup + body
      }

      headers.set('Content-Type', type.replace(/;\s*charset\s*=[^;]+/i, '') + '; charset=utf-8')
    }

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    })
  } catch (error) {
    console.error('[vanillia-relay]', error)
    return errorResponse(
      error instanceof RangeError
        ? 'VanilliaPXY response is too large to rewrite'
        : 'VanilliaPXY server could not be reached. Try another server.',
      502
    )
  }
}