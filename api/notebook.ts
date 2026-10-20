import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MongoClient } from 'mongodb'

const KEY_PATTERN = /^[a-zA-Z0-9_-]{20,80}$/
const MAX_BYTES = 2_000_000
type NotebookDocument = { key: string; data: unknown; updatedAt: Date }

const globalForMongo = globalThis as typeof globalThis & {
  pocketNotesMongo?: Promise<MongoClient>
}

function getMongoClient() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  if (!globalForMongo.pocketNotesMongo) {
    globalForMongo.pocketNotesMongo = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      connectTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 5_000
    }).connect()
  }
  return globalForMongo.pocketNotesMongo
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = typeof req.query.key === 'string' ? req.query.key : ''
  if (!KEY_PATTERN.test(key)) return res.status(400).json({ error: 'Invalid workspace link' })
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({ error: 'Storage is not configured. Add MONGODB_URI in Vercel.' })
  }

  try {
    const client = await getMongoClient()
    const collection = client
      .db(process.env.MONGODB_DB || 'pocketnotes')
      .collection<NotebookDocument>('notebooks')

    if (req.method === 'GET') {
      const document = await collection.findOne({ key })
      return res.status(200).json({
        data: document?.data ?? null,
        updatedAt: document?.updatedAt ?? null
      })
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

    const updatedAt = new Date()
    await collection.updateOne(
      { key },
      { $set: { data: parsed, updatedAt }, $setOnInsert: { key } },
      { upsert: true }
    )
    return res.status(200).json({ ok: true, updatedAt })
  } catch (error) {
    console.error('Pocket Notes storage error:', error)
    return res.status(500).json({ error: 'Storage request failed. Your local copy is still available.' })
  }
}