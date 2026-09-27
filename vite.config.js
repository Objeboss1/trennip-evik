import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const storePath = path.resolve('data/paevik.json')

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8'))
  } catch {
    return {}
  }
}

function hasPlan(plan) {
  return (
    Array.isArray(plan) &&
    plan.some(
      (column) =>
        (column?.title || '').trim() ||
        (column?.rows || []).some((row) => (row?.text || '').trim() || (row?.reps || '').trim()),
    )
  )
}

function mergeDiary(base, incoming) {
  const next = { ...base }
  if (incoming?.choices && Object.keys(incoming.choices).length) {
    next.choices = { ...(base.choices || {}), ...incoming.choices }
  }
  if (incoming?.muscles && typeof incoming.muscles === 'object') {
    next.muscles = { ...(base.muscles || {}) }
    for (const [name, value] of Object.entries(incoming.muscles)) {
      const previous = next.muscles[name] || {}
      next.muscles[name] = {
        exercises: value?.exercises?.trim() ? value.exercises : previous.exercises || '',
        reps: value?.reps?.trim() ? value.reps : previous.reps || '',
      }
    }
  }
  if (incoming?.nutrition?.trim()) next.nutrition = incoming.nutrition
  if (hasPlan(incoming?.plan)) next.plan = incoming.plan
  if (incoming?.layout?.spots?.length) next.layout = incoming.layout
  return next
}

function diaryApi() {
  return {
    name: 'diary-api',
    configureServer(server) {
      server.middlewares.use('/api/paevik', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(readStore()))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          let incoming = {}
          try {
            incoming = JSON.parse(body || '{}')
          } catch {
            incoming = {}
          }
          if (!incoming.edited) {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(readStore()))
            return
          }
          const merged = mergeDiary(readStore(), incoming)
          fs.mkdirSync(path.dirname(storePath), { recursive: true })
          fs.writeFileSync(storePath, JSON.stringify(merged, null, 2))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(merged))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [diaryApi()],
  server: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
  },
})
