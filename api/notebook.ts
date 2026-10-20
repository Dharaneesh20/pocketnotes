import type { VercelRequest, VercelResponse } from '@vercel/node'
import { get, list, put } from '@vercel/blob'

const KEY_PATTERN = /^[a-zA-Z0-9_-]{20,80}$/
const MAX_BYTES = 2_000_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = typeof req.query.key === 'string' ? req.query.key : ''
  if (!KEY_PATTERN.test(key)) return res.status(400).json({ error: 'Invalid workspace link' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Storage is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.' })
  }

  const pathname = `pocket-notes/${key}.json`

  try {
    if (req.method === 'GET') {
      const result = await list({ prefix: pathname, limit: 10 })
      const blob = result.blobs.find(item => item.pathname === pathname)
      if (!blob) return res.status(200).json({ data: null, updatedAt: null })
      const object = await get(blob.url, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN })
      if (!object || object.statusCode !== 200) throw new Error('Could not read saved notebook')
      const chunks: Uint8Array[] = []
      for await (const chunk of object.stream) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
      const bytes = Buffer.concat(chunks)
      const data = JSON.parse(bytes.toString('utf8'))
      return res.status(200).json({ data, updatedAt: blob.uploadedAt })
    }

    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
      return res.status(413).json({ error: 'Notebook is too large (2 MB limit).' })
    }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).users)) {
      return res.status(400).json({ error: 'Invalid notebook format' })
    }

    const saved = await put(pathname, JSON.stringify(parsed), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
      token: process.env.BLOB_READ_WRITE_TOKEN
    })
    return res.status(200).json({ ok: true, updatedAt: saved.uploadedAt })
  } catch (error) {
    console.error('Pocket Notes storage error:', error)
    return res.status(500).json({ error: 'Storage request failed. Your local copy is still available.' })
  }
}