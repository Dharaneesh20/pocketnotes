import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Check } from 'lucide-react'
import type { Notebook, User, Folder as NoteFolder, Page } from './types'
import { newId, starterNotebook } from './types'
import { LandingPage } from './LandingPage'
import { UserPage } from './UserPage'
import { Workspace } from './Workspace'
import { Dialogs } from './Dialogs'
import type { DialogState } from './Dialogs'

const LOCAL_KEY = 'pocket-notes-cache-v2'
const WORKSPACE_KEY = 'pocket-notes-workspace-v1'
const PUBLIC_WORKSPACE = 'notepacket-public-workspace-v1'
const NOTE_PACKET_FILE_TYPE = 'application/vnd.notepacket+json'

const validPin = (pin: string) => /^\d{4}(\d{2})?$/.test(pin)
const hashPin = async (pin: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
function getWorkspace() {
  const params = new URLSearchParams(window.location.search)
  const requested = params.get('workspace')
  let key = requested || PUBLIC_WORKSPACE
  if (requested && !/^[a-zA-Z0-9_-]{20,80}$/.test(requested)) key = PUBLIC_WORKSPACE
  localStorage.setItem(WORKSPACE_KEY, key)
  return key
}
function safeParse(raw: string | null): Notebook | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (v?.version === 1 && Array.isArray(v.users)) return v
  } catch {}
  return null
}
const routeFor = (u: User, f?: NoteFolder, p?: Page) =>
  `/u/${u.id}${f ? `/f/${f.id}` : ''}${p && f ? `/p/${p.id}` : ''}`
const downloadText = (name: string, text: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
const readApiResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    const body = JSON.parse(text)
    return body && typeof body === 'object' ? body as Record<string, unknown> : {}
  } catch {
    throw new Error(response.ok ? 'The server returned an invalid response.' : `Request failed (${response.status}).`)
  }
}
const fmtTime = (ms: number) => {
  const d = new Date(ms)
  const now = new Date()
  const diff = now.getTime() - ms
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const routeParts = location.pathname.split('/').filter(Boolean)
  const params = {
    userId: routeParts[0] === 'u' ? routeParts[1] : undefined,
    folderId: routeParts[2] === 'f' ? routeParts[3] : undefined,
    pageId: routeParts[4] === 'p' ? routeParts[5] : undefined,
  }
  const workspace = useMemo(() => getWorkspace(), [])
  const cacheKey = `${LOCAL_KEY}-${workspace}`
  const [data, setData] = useState<Notebook>(() => safeParse(localStorage.getItem(cacheKey)) || starterNotebook())
  const [sync, setSync] = useState<'loading' | 'saved' | 'saving' | 'offline' | 'error'>('loading')
  const [lastSync, setLastSync] = useState('')
  const [preview, setPreview] = useState(true)
  const [theme, setTheme] = useState(() => {
    const s = localStorage.getItem('note-packet-theme')
    return s && ['default', 'minimalist', 'claude', 'chatgpt', 'cyberpunk', 'high-contrast'].includes(s) ? s : 'default'
  })
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('note-packet-theme-mode') === 'dark' ? 'dark' : 'light'
  )
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [unlockedUsers, setUnlockedUsers] = useState<Set<string>>(() => new Set())
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const firstSync = useRef(true)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverUpdated = useRef<number>(0)

  useEffect(() => { localStorage.setItem('note-packet-theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('note-packet-theme-mode', themeMode) }, [themeMode])

  const activeUser = data.users.find(u => u.id === params.userId)
  const activeFolder = activeUser?.folders.find(f => f.id === params.folderId) || activeUser?.folders[0]
  const activePage = activeFolder?.pages.find(p => p.id === params.pageId) || activeFolder?.pages[0]
  const requiresPin = (user: User) => Boolean(user.pinHash && !user.isPublic && !unlockedUsers.has(user.id))
  const route = (u = activeUser, f?: NoteFolder, p?: Page) => u ? routeFor(u, f, p) : '/'

  const openUser = (user: User) => {
    if (requiresPin(user)) { setDialog({ kind: 'login', value: user.id }); return }
    navigate(routeFor(user))
  }

  useEffect(() => {
    if (activeUser && requiresPin(activeUser) && (!dialog || dialog.kind !== 'login')) {
      setDialog({ kind: 'login', value: activeUser.id })
    }
  }, [activeUser?.id, activeUser?.pinHash, activeUser?.isPublic, unlockedUsers])

  const persistLocal = useCallback((next: Notebook) => {
    try { localStorage.setItem(cacheKey, JSON.stringify(next)) } catch {
      showToast('Browser storage is full. Export a backup before continuing.')
    }
  }, [cacheKey])

  // Fetch from server
  useEffect(() => {
    let cancelled = false
    fetch(`/api/notebook?key=${encodeURIComponent(workspace)}`, { cache: 'no-store' })
      .then(async r => { const body = await readApiResponse(r); if (!r.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Sync unavailable'); return body })
      .then(body => {
        if (cancelled) return
        const remote = body.data as Notebook | null
        if (remote && Array.isArray(remote.users)) {
          const local = safeParse(localStorage.getItem(cacheKey))
          const localTime = local?.updatedAt || 0
          const remoteTime = remote.updatedAt || 0
          if (local && localTime > remoteTime) setData(local)
          else { setData(remote); persistLocal(remote); serverUpdated.current = remoteTime }
        } else {
          const local = safeParse(localStorage.getItem(cacheKey))
          if (local) setData(local)
        }
        setSync(navigator.onLine ? 'saved' : 'offline')
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        firstSync.current = false
      })
      .catch(error => {
        if (!cancelled) {
          setSync('error')
          firstSync.current = false
          showToast(error instanceof Error ? error.message : 'MongoDB sync unavailable.')
        }
      })
    return () => { cancelled = true }
  }, [workspace, persistLocal])

  // Auto-save
  useEffect(() => {
    if (firstSync.current) return
    const next = { ...data, updatedAt: Date.now() }
    persistLocal(next)
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(async () => {
      if (!navigator.onLine) { setSync('offline'); return }
      setSync('saving')
      try {
        const response = await fetch(`/api/notebook?key=${encodeURIComponent(workspace)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next)
        })
        const body = await readApiResponse(response)
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Sync failed')
        setSync('saved')
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        serverUpdated.current = next.updatedAt
      } catch (error) {
        setSync('error')
        showToast(error instanceof Error ? error.message : 'MongoDB sync failed. Local copy is safe.')
      }
    }, 650)
    return () => { if (pending.current) clearTimeout(pending.current) }
  }, [data, workspace, persistLocal])

  useEffect(() => {
    const online = () => { setSync('saving'); firstSync.current = false; setData(d => ({ ...d, updatedAt: Date.now() })) }
    const offline = () => setSync('offline')
    window.addEventListener('online', online); window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])

  useEffect(() => {
    if (activeUser && (!params.userId || !params.folderId || !params.pageId)) {
      navigate(route(activeUser, activeFolder, activePage), { replace: true })
    }
  }, [activeUser?.id, activeFolder?.id, activePage?.id, params.userId, params.folderId, params.pageId])

  const updateData = (fn: (old: Notebook) => Notebook) => setData(old => fn(old))
  const updatePage = (field: 'title' | 'content', value: string) => {
    if (!activeUser || !activeFolder || !activePage) return
    updateData(old => ({ ...old, users: old.users.map(u => u.id !== activeUser.id ? u : {
      ...u, folders: u.folders.map(f => f.id !== activeFolder.id ? f : {
        ...f, pages: f.pages.map(p => p.id !== activePage.id ? p : { ...p, [field]: value, updatedAt: Date.now() })
      })
    }) }))
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const submitDialog = async () => {
    if (!dialog) return
    const name = dialog.value?.trim()

    if (dialog.kind === 'user' && name) {
      const isPublic = Boolean(dialog.isPublic)
      let pinHash: string | undefined
      if (!isPublic) {
        if (!validPin(dialog.pin || '')) { showToast('PIN must be exactly 4 or 6 digits.'); return }
        pinHash = await hashPin(dialog.pin || '')
      }
      const u: User = { id: newId(), name, pinHash, isPublic, folders: [{ id: newId(), name: 'Notes', pages: [] }] }
      updateData(d => ({ ...d, users: [...d.users, u] }))
      setUnlockedUsers(users => new Set(users).add(u.id))
      navigate(routeFor(u, u.folders[0]))
      setDialog(null)
      showToast(`Welcome, ${name}! Your profile is ready.`)
      return
    }

    if (dialog.kind === 'login') {
      const targetUser = data.users.find(u => u.id === dialog.value)
      if (!targetUser?.pinHash || !dialog.pin || await hashPin(dialog.pin) !== targetUser.pinHash) {
        showToast('Incorrect PIN. Private notes remain locked.')
        return
      }
      setUnlockedUsers(users => new Set(users).add(targetUser.id))
      setDialog(null)
      navigate(routeFor(targetUser))
      return
    }

    if (!activeUser) { setDialog(null); return }

    if (dialog.kind === 'set-pin') {
      if (!validPin(dialog.pin || '')) { showToast('PIN must be exactly 4 or 6 digits.'); return }
      const pinHash = await hashPin(dialog.pin || '')
      updateData(d => ({ ...d, users: d.users.map(u => u.id === dialog.value ? { ...u, pinHash } : u) }))
      setDialog(null); showToast('Security PIN saved. Keep it somewhere safe!'); return
    }

    if (dialog.kind === 'toggle-visibility') {
      updateData(d => ({ ...d, users: d.users.map(u => u.id === dialog.value ? { ...u, isPublic: !u.isPublic } : u) }))
      setDialog(null); return
    }

    if (dialog.kind === 'folder' && name) {
      const f: NoteFolder = { id: newId(), name, pages: [] }
      updateData(d => ({ ...d, users: d.users.map(u => u.id === activeUser.id ? { ...u, folders: [...u.folders, f] } : u) }))
      navigate(route(activeUser, f)); setDialog(null); return
    }

    if (dialog.kind === 'page') {
      const f = activeFolder || activeUser.folders[0]
      if (!f) return
      const p: Page = { id: newId(), title: name || 'Untitled', content: '', updatedAt: Date.now() }
      updateData(d => ({ ...d, users: d.users.map(u => u.id !== activeUser.id ? u : { ...u, folders: u.folders.map(x => x.id === f.id ? { ...x, pages: [p, ...x.pages] } : x) }) }))
      navigate(route(activeUser, f, p)); setDialog(null); setPreview(false)
      setTimeout(() => (document.querySelector('.ws-note-editor') as HTMLTextAreaElement | null)?.focus(), 40)
      return
    }

    if (dialog.kind === 'rename-user' && name) updateData(d => ({ ...d, users: d.users.map(u => u.id === activeUser.id ? { ...u, name } : u) }))
    if (dialog.kind === 'rename-folder' && name && activeFolder) updateData(d => ({ ...d, users: d.users.map(u => u.id !== activeUser.id ? u : { ...u, folders: u.folders.map(f => f.id === activeFolder.id ? { ...f, name } : f) }) }))
    if (dialog.kind === 'rename-page' && name && activePage) updatePage('title', name)
    if (dialog.kind === 'delete-page' && activeFolder && activePage) {
      const remaining = activeFolder.pages.filter(p => p.id !== activePage.id)
      updateData(d => ({ ...d, users: d.users.map(u => u.id !== activeUser.id ? u : { ...u, folders: u.folders.map(f => f.id === activeFolder.id ? { ...f, pages: remaining } : f) }) }))
      navigate(route(activeUser, activeFolder)); setDialog(null); return
    }
    if (dialog.kind === 'delete-folder' && activeFolder) {
      const remaining = activeUser.folders.filter(f => f.id !== activeFolder.id)
      updateData(d => ({ ...d, users: d.users.map(u => u.id === activeUser.id ? { ...u, folders: remaining } : u) }))
      navigate(remaining[0] ? route(activeUser, remaining[0]) : route(activeUser)); setDialog(null); return
    }
    if (dialog.kind === 'delete-user') {
      const targetUser = data.users.find(u => u.id === dialog.value)
      if (!targetUser) return
      if (!targetUser.pinHash) { showToast('Set a security PIN before deleting this profile.'); setDialog({ kind: 'set-pin', value: targetUser.id }); return }
      if (!dialog.pin || await hashPin(dialog.pin) !== targetUser.pinHash) { showToast('Incorrect PIN. Deletion cancelled.'); return }
      const remaining = data.users.filter(u => u.id !== targetUser.id)
      updateData(d => ({ ...d, users: remaining }))
      navigate(remaining[0] ? routeFor(remaining[0]) : '/'); setDialog(null); return
    }
    setDialog(null)
  }

  const copy = async (text: string, success = 'Copied') => {
    try { await navigator.clipboard.writeText(text); showToast(success) }
    catch { showToast('Clipboard blocked — select the text and copy manually.') }
  }

  const shareNote = async () => {
    if (!activePage) return
    const noteUrl = `${window.location.origin}/?workspace=${workspace}`
    const title = activePage.title || 'Untitled note'
    const message = `${title}\n${noteUrl}`
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: `${title} · Note Packet`, text: 'Created on Note Packet', url: noteUrl }); showToast('Share sheet opened'); return }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return }
    }
    await copy(message, 'Note link copied')
  }

  const exportData = () => downloadText(`note-packet-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  const exportNotePacket = () => {
    const packet = { format: 'Note Packet', formatVersion: 1, exportedAt: new Date().toISOString(), notebook: data }
    downloadText(`note-packet-${new Date().toISOString().slice(0, 10)}.ntpkt`, JSON.stringify(packet, null, 2), NOTE_PACKET_FILE_TYPE)
  }
  const exportNtid = (user: User) => {
    const ntid = { format: 'Note Packet Identity', formatVersion: 1, exportedAt: new Date().toISOString(), userId: user.id, username: user.name, workspace, notebook: data }
    downloadText(`${user.name.toLowerCase().replace(/\s+/g, '-')}.ntid`, JSON.stringify(ntid, null, 2), 'application/json')
    showToast('Identity key downloaded. Keep it safe — lose it and it\'s gone forever!')
  }
  const exportNote = () => {
    if (!activePage) return
    downloadText(`${activePage.title || 'note'}.md`, activePage.content)
  }

  const importData = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const text = String(reader.result)
      let imported = safeParse(text)
      let autoLogin: string | null = null

      // Try .ntpkt format
      if (!imported) {
        try {
          const packet = JSON.parse(text)
          if (packet?.format === 'Note Packet' && packet.formatVersion === 1) imported = safeParse(JSON.stringify(packet.notebook))
        } catch {}
      }
      // Try .ntid format — identity key auto-login
      if (!imported) {
        try {
          const ntid = JSON.parse(text)
          if (ntid?.format === 'Note Packet Identity' && ntid.formatVersion === 1) {
            imported = safeParse(JSON.stringify(ntid.notebook))
            autoLogin = ntid.userId
          }
        } catch {}
      }

      if (!imported) { showToast('That file is not a valid Note Packet backup or identity key.'); return }
      if (confirm('Import this notebook? Your current data will be replaced.')) {
        setData(imported)
        if (autoLogin) {
          const user = imported.users.find(u => u.id === autoLogin)
          if (user) {
            setUnlockedUsers(s => new Set(s).add(autoLogin!))
            navigate(routeFor(user))
            showToast(`Welcome back, ${user.name}! Identity key accepted.`)
          }
        } else {
          showToast('Notebook imported successfully.')
        }
      }
    }
    reader.readAsText(file)
  }

  const markdownHtml = activePage
    ? DOMPurify.sanitize(
        marked.parse(activePage.content.replace(/```mermaid\s*([\s\S]*?)```/gi, (_m, chart: string) => {
          const raw = chart.trim()
          return `<div class="mermaid" data-chart="${encodeURIComponent(raw)}">${raw.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
        }), { async: false }),
        {
          ADD_TAGS: ['mark', 'span'],
          ADD_ATTR: ['data-chart', 'data-bm', 'data-color', 'class', 'title']
        }
      )
    : ''

  const isUsersPage = routeParts[0] === 'users'
  const isInWorkspace = Boolean(params.userId)
  const lockedActiveUser = activeUser && requiresPin(activeUser)

  return (
    <div className={`app-root theme-${theme} ${themeMode === 'dark' ? 'dark-mode' : ''}`}>
      {/* Landing page (shown when not in users page and not in workspace) */}
      {!isInWorkspace && !isUsersPage && (
        <LandingPage
          data={data}
          theme={theme}
          themeMode={themeMode}
          onSetTheme={setTheme}
          toggleTheme={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
          onNavigateToUsers={() => navigate('/users')}
          onCreateUser={() => setDialog({ kind: 'user', isPublic: false })}
          onImport={importData}
        />
      )}

      {/* Dedicated separate Users page (shown at /users) */}
      {!isInWorkspace && isUsersPage && (
        <UserPage
          data={data}
          theme={theme}
          themeMode={themeMode}
          onSetTheme={setTheme}
          onToggleTheme={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
          onOpenUser={openUser}
          onCreateUser={() => setDialog({ kind: 'user', isPublic: false })}
          onImport={importData}
        />
      )}

      {/* Workspace (shown when in a user route) */}
      {isInWorkspace && activeUser && !lockedActiveUser && (
        <Workspace
          data={data}
          activeUser={activeUser}
          activeFolder={activeFolder}
          activePage={activePage}
          sync={sync}
          lastSync={lastSync}
          themeMode={themeMode}
          theme={theme}
          preview={preview}
          expandedFolders={expandedFolders}
          onToggleTheme={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
          onSetTheme={setTheme}
          onSetPreview={setPreview}
          onToggleFolder={id => setExpandedFolders(old => ({ ...old, [id]: !old[id] }))}
          onUpdatePageField={updatePage}
          onAsk={(kind, value) => setDialog({ kind, value })}
          onOpenUser={openUser}
          onCopy={copy}
          onShareNote={shareNote}
          onExportNote={exportNote}
          onExportNotePacket={exportNotePacket}
          onExportJson={exportData}
          onImport={importData}
          onExportNtid={exportNtid}
          onSignOut={() => navigate('/users')}
          workspace={workspace}
          shareWorkspace={`/?workspace=${workspace}`}
          markdownHtml={markdownHtml}
          requiresPin={requiresPin}
          route={route}
          onShowToast={showToast}
        />
      )}

      {/* Redirect if locked user */}
      {isInWorkspace && (!activeUser || lockedActiveUser) && (
        <div className="lock-screen">
          <div className="lock-inner">
            <div className="brand-sq lg">n.</div>
            <p>This profile is locked or doesn't exist.</p>
            <button className="dlg-solid-btn" onClick={() => navigate('/')}>← Back to home</button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialogs
        dialog={dialog}
        data={data}
        onClose={() => setDialog(null)}
        onSubmit={submitDialog}
        onChange={setDialog}
        onAsk={(kind, value) => setDialog({ kind, value })}
      />

      {/* Toast */}
      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  )
}