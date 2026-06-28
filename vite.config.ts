import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Dev/preview proxy for the OpenF1 API.
 *
 * 1. Fixes CORS: the browser talks to same-origin `/api/openf1/*`; this proxy
 *    forwards server-side to https://api.openf1.org/v1/*.
 * 2. Adds authentication: if OPENF1_USERNAME / OPENF1_PASSWORD are present in the
 *    environment (.env, gitignored), it obtains an OAuth2 token from the OpenF1
 *    /token endpoint and attaches it as a Bearer header — KEEPING CREDENTIALS
 *    SERVER-SIDE so they never reach the browser (per OpenF1 security guidance).
 *    Without credentials it works anonymously (still fixes CORS).
 */
function openf1Proxy(env: Record<string, string>): Plugin {
  const USER = env.OPENF1_USERNAME
  const PASS = env.OPENF1_PASSWORD
  let tokenCache: { token: string; exp: number } | null = null
  let inFlight: Promise<string | null> | null = null
  let failUntil = 0 // negative-cache: don't retry /token until this time
  let announced = false

  async function fetchToken(): Promise<string | null> {
    try {
      const body = new URLSearchParams({ username: USER!, password: PASS! })
      const r = await fetch('https://api.openf1.org/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!r.ok) {
        // Back off so we don't hammer /token on every request while it's failing.
        failUntil = Date.now() + (r.status === 429 ? 5_000 : 60_000)
        console.warn(`[openf1] token request failed (${r.status}) – anonymous for now`)
        return null
      }
      const j = (await r.json()) as { access_token: string; expires_in?: string | number }
      const ttl = Number(j.expires_in ?? 3600)
      tokenCache = { token: j.access_token, exp: Date.now() + (ttl - 60) * 1000 }
      failUntil = 0
      if (!announced) {
        console.log('\x1b[32m[openf1] authenticated mode enabled (higher rate limits)\x1b[0m')
        announced = true
      }
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
    // Single-flight: concurrent requests share one token fetch.
    if (!inFlight) inFlight = fetchToken().finally(() => (inFlight = null))
    return inFlight
  }

  const handler = async (req: any, res: any) => {
    try {
      const upstream = 'https://api.openf1.org/v1' + (req.url || '')
      const token = await getToken()
      const headers: Record<string, string> = { accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const r = await fetch(upstream, { headers })
      const text = await r.text()
      res.statusCode = r.status
      res.setHeader('content-type', r.headers.get('content-type') || 'application/json')
      res.setHeader('access-control-allow-origin', '*')
      res.end(text)
    } catch (e: any) {
      res.statusCode = 502
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'proxy_failed', message: String(e?.message || e) }))
    }
  }

  return {
    name: 'openf1-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openf1', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/openf1', handler)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), openf1Proxy(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  }
})
