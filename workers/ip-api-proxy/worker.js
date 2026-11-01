// Cloudflare Worker that adds CORS headers in front of a custom IP info API,
// which does not send them, so the dashboard can call it from the browser.
// The upstream address is read from the UPSTREAM_URL variable in the Worker settings,
// and no API key is stored here: the query parameters (`key`, `ip`) are passed through unchanged.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
}

const PREFLIGHT_HEADERS = {
  ...CORS_HEADERS,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

const jsonError = (status, error) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

// Accept a bare host such as `api.example.com`
const parseUpstreamURL = (value) => {
  const base = typeof value === 'string' ? value.trim() : ''

  if (!base) return null

  try {
    return new URL(/^https?:\/\//i.test(base) ? base : `https://${base}`)
  } catch {
    return null
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: PREFLIGHT_HEADERS })
    }

    if (request.method !== 'GET') {
      return jsonError(405, 'Method not allowed')
    }

    const upstreamURL = parseUpstreamURL(env.UPSTREAM_URL)

    if (!upstreamURL) {
      return jsonError(500, 'UPSTREAM_URL is not configured or invalid')
    }

    const { searchParams } = new URL(request.url)

    if (!searchParams.get('key') || !searchParams.get('ip')) {
      return jsonError(400, 'Missing key or ip parameter')
    }

    for (const [name, value] of searchParams) {
      upstreamURL.searchParams.append(name, value)
    }

    let upstream

    try {
      upstream = await fetch(upstreamURL, {
        headers: { Accept: 'application/json' },
      })
    } catch {
      // Keep the error generic so the upstream address is not revealed to callers
      return jsonError(502, 'Upstream request failed')
    }

    // Only pass the body and its content type through, not upstream headers that identify the upstream
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  },
}
