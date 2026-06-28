// Vercel Serverless Function — production equivalent of the Vite dev/preview
// proxy in vite.config.ts.
//
// In development the OpenF1 requests are proxied by a Vite middleware mounted at
// `/api/openf1`. That middleware does NOT exist in a production Vercel build
// (Vercel only serves the static `dist/` output), so on Vercel the browser hits
// `/api/openf1/*` with nothing behind it and no race data loads.
//
// This function reproduces the proxy behaviour:
//   1. Fixes CORS: the browser calls same-origin `/api/openf1/*`, we forward
//      server-side to https://api.openf1.org/v1/*.
//   2. Adds authentication: if OPENF1_USERNAME / OPENF1_PASSWORD are set as
//      Vercel environment variables, it obtains an OAuth2 token from the OpenF1
//      /token endpoint and attaches it as a Bearer header — credentials stay
//      server-side and never reach the browser. Without them it works
//      anonymously (still fixes CORS).
//
// Vercel automatically serves files in this `/api` directory as functions, so
// the catch-all `[...path]` captures everything after `/api/openf1/`.

const USER = process.env.OPENF1_USERNAME
const PASS = process.env.OPENF1_PASSWORD

// Module-scope token cache. Persists across invocations while the (warm) lambda
// instance is reused; cold starts simply re-fetch a token.
let tokenCache: { token: string; exp: number } | null = null
let inFlight: Promise<string | null> | null = null
let failUntil = 0 // negative-cache: don't retry /token until this time

async function fetchToken(): Promise<string | null> {
  try {
    const body = new URLSearchParams({ username: USER!, password: PASS! })
    const r = await fetch('https://api.openf1.org/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!r.ok) {
      failUntil = Date.now() + (r.status === 429 ? 5_000 : 60_000)
      console.warn(`[openf1] token request failed (${r.status}) – anonymous for now`)
      return null
    }
    const j = (await r.json()) as { access_token: string; expires_in?: string | number }
    const ttl = Number(j.expires_in ?? 3600)
    tokenCache = { token: j.access_token, exp: Date.now() + (ttl - 60) * 1000 }
    failUntil = 0
    return tokenCache.token
  } catch (e) {
    failUntil = Date.now() + 15_000
    console.warn('[openf1] token error:', e)
    return null
  }
}

async function getToken(): Promise<string | null> {
  if (!USER || !PASS) return null
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token
  if (Date.now() < failUntil) return null
  if (!inFlight) inFlight = fetchToken().finally(() => (inFlight = null))
  return inFlight
}

export default async function handler(req: any, res: any) {
  try {
    // Reconstruct the upstream URL from the incoming request.
    //
    // The catch-all route is named `[...path]`, so Vercel injects its captured
    // segments back into the query string as `path=<segment>`. OpenF1 treats
    // EVERY query parameter as a column filter, so a stray `path=sessions` matches
    // zero rows and the API returns 404 "No results found". We must strip it.
    //
    // We keep the rest of the query string byte-for-byte (NOT re-encoded) so that
    // OpenF1 operator keys like `date>=` / `date<` survive intact.
    const rawUrl: string = req.url || ''
    const qIndex = rawUrl.indexOf('?')
    const pathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex)
    const rawQuery = qIndex === -1 ? '' : rawUrl.slice(qIndex + 1)

    const endpoint = pathname.replace(/^\/api\/openf1/, '')
    // Vercel names the catch-all param after the filename `[...path]`, so the key
    // it injects is the LITERAL `...path` (dots included) — not `path`. Strip any
    // segment whose key is `path` or `...path` (decoded), keep everything else
    // byte-for-byte so OpenF1 operator keys like `date>=` survive.
    const cleanedQuery = rawQuery
      .split('&')
      .filter((seg) => {
        if (!seg) return false
        const key = decodeURIComponent(seg.split('=')[0])
        return key !== 'path' && key !== '...path'
      })
      .join('&')

    const upstream =
      'https://api.openf1.org/v1' +
      (endpoint.startsWith('/') ? endpoint : '/' + endpoint) +
      (cleanedQuery ? '?' + cleanedQuery : '')

    // Temporary diagnostic: GET /api/openf1/__debug shows how the request is parsed.
    if (endpoint === '/__debug' || endpoint === '__debug') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify(
          { rawUrl, pathname, rawQuery, endpoint, cleanedQuery, upstream, query: req.query },
          null,
          2,
        ),
      )
      return
    }

    const token = await getToken()
    const headers: Record<string, string> = { accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const r = await fetch(upstream, { headers })
    const text = await r.text()

    res.statusCode = r.status
    res.setHeader('content-type', r.headers.get('content-type') || 'application/json')
    res.setHeader('access-control-allow-origin', '*')
    // Let Vercel's edge cache historical responses briefly to ease rate limits.
    res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=30')
    res.end(text)
  } catch (e: any) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'proxy_failed', message: String(e?.message || e) }))
  }
}
