import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { Check, ChevronDown, ChevronRight, Clipboard, Cloud, CloudOff, Copy, Download, FilePlus2, Folder, FolderPlus, Github, Menu, Moon, MoreHorizontal, Pencil, Plus, Settings2, Sun, Trash2, Upload, Users, X } from 'lucide-react'
import { marked } from 'marked'
import mermaid from 'mermaid'
import type { Notebook, User, Folder as NoteFolder, Page } from './types'
import { newId, starterNotebook } from './types'

const LOCAL_KEY = 'pocket-notes-cache-v1'
const WORKSPACE_KEY = 'pocket-notes-workspace-v1'
const PUBLIC_WORKSPACE = 'notepacket-public-workspace-v1'
const validPin = (pin: string) => /^\d{4}(\d{2})?$/.test(pin)
const hashPin = async (pin: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
function getWorkspace() {
  const params = new URLSearchParams(window.location.search)
  const requestedWorkspace = params.get('workspace')
  let key = requestedWorkspace || PUBLIC_WORKSPACE
  if (requestedWorkspace && !/^[a-zA-Z0-9_-]{20,80}$/.test(requestedWorkspace)) key = PUBLIC_WORKSPACE
  localStorage.setItem(WORKSPACE_KEY, key)
  if (requestedWorkspace && requestedWorkspace !== key) {
    params.set('workspace', key)
    history.replaceState({}, '', `${location.pathname}?${params.toString()}${location.hash}`)
  }
  return key
}
function safeParse(raw: string | null): Notebook | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value?.version === 1 && Array.isArray(value.users)) return value
  } catch {}
  return null
}
const routeFor = (u: User, f?: NoteFolder, p?: Page) => `/u/${u.id}${f ? `/f/${f.id}` : ''}${p && f ? `/p/${p.id}` : ''}`
const downloadText = (name: string, text: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
const NOTE_PACKET_FILE_TYPE = 'application/vnd.notepacket+json'
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

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const routeParts = location.pathname.split('/').filter(Boolean)
  const params = {
    userId: routeParts[0] === 'u' ? routeParts[1] : undefined,
    folderId: routeParts[2] === 'f' ? routeParts[3] : undefined,
    pageId: routeParts[4] === 'p' ? routeParts[5] : undefined
  }
  const workspace = useMemo(() => getWorkspace(), [])
  const cacheKey = `${LOCAL_KEY}-${workspace}`
  const [data, setData] = useState<Notebook>(() => safeParse(localStorage.getItem(cacheKey)) || starterNotebook())
  const [sync, setSync] = useState<'loading'|'saved'|'saving'|'offline'|'error'>('loading')
  const [lastSync, setLastSync] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false)
  const [mobileDockOffset, setMobileDockOffset] = useState({ x: 0, y: 0 })
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [preview, setPreview] = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('note-packet-theme')
    return saved && ['default', 'minimalist', 'claude', 'chatgpt', 'cyberpunk', 'high-contrast'].includes(saved) ? saved : 'default'
  })
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => localStorage.getItem('note-packet-theme-mode') === 'dark' ? 'dark' : 'light')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<{kind: string; value?: string; pin?: string} | null>(null)
  const [toast, setToast] = useState('')
  const editor = useRef<HTMLTextAreaElement>(null)
  const firstSync = useRef(true)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverUpdated = useRef<number>(0)
  const mobileDockDrag = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false })
  const suppressDockClick = useRef(false)

  useEffect(() => {
    localStorage.setItem('note-packet-theme', theme)
  }, [theme])
  useEffect(() => {
    localStorage.setItem('note-packet-theme-mode', themeMode)
  }, [themeMode])

  const activeUser = data.users.find(u => u.id === params.userId)
  const activeFolder = activeUser?.folders.find(f => f.id === params.folderId) || activeUser?.folders[0]
  const activePage = activeFolder?.pages.find(p => p.id === params.pageId) || activeFolder?.pages[0]
  const route = (u = activeUser, f?: NoteFolder, p?: Page) => u ? routeFor(u, f, p) : '/'

  const persistLocal = useCallback((next: Notebook) => {
    try { localStorage.setItem(cacheKey, JSON.stringify(next)) } catch {
      setToast('Browser storage is full. Export a backup before continuing.')
    }
  }, [])

  // Fetch shared notebook on startup. Local cache remains usable if offline.
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
          // The server is authoritative once it has data; local-only edits are pushed if newer.
          if (local && localTime > remoteTime) setData(local)
          else { setData(remote); persistLocal(remote); serverUpdated.current = remoteTime }
        } else {
          const local = safeParse(localStorage.getItem(cacheKey))
          if (local) setData(local)
        }
        setSync(navigator.onLine ? 'saved' : 'offline')
        setLastSync('Connected')
        firstSync.current = false
      })
      .catch(error => {
        if (!cancelled) {
          setSync('error')
          firstSync.current = false
          setToast(error instanceof Error ? error.message : 'MongoDB sync is unavailable.')
        }
      })
    return () => { cancelled = true }
  }, [workspace, persistLocal])

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
        setSync('saved'); setLastSync(new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))
        serverUpdated.current = next.updatedAt
      } catch (error) {
        setSync('error')
        setToast(error instanceof Error ? error.message : 'MongoDB sync failed. Your local copy is still available.')
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
  const updatePage = (field: 'title'|'content', value: string) => {
    if (!activeUser || !activeFolder || !activePage) return
    updateData(old => ({ ...old, users: old.users.map(u => u.id !== activeUser.id ? u : {
      ...u, folders: u.folders.map(f => f.id !== activeFolder.id ? f : {
        ...f, pages: f.pages.map(p => p.id !== activePage.id ? p : { ...p, [field]: value, updatedAt: Date.now() })
      })
    }) }))
  }
  const ask = (kind: string, value = '') => setDialog({ kind, value })
  const submitDialog = async () => {
    if (!dialog) return
    const name = dialog.value?.trim()
    if (dialog.kind === 'user' && name) {
      if (!validPin(dialog.pin || '')) { setToast('PIN must be exactly 4 or 6 digits.'); return }
      const u: User = { id: newId(), name, pinHash: await hashPin(dialog.pin || ''), folders: [{ id: newId(), name: 'Notes', pages: [] }] }
      updateData(d => ({ ...d, users: [...d.users, u] })); navigate(routeFor(u, u.folders[0])); setDialog(null); return
    }
    if (!activeUser) return
    if (dialog.kind === 'set-pin') {
      if (!validPin(dialog.pin || '')) { setToast('PIN must be exactly 4 or 6 digits.'); return }
      const pinHash = await hashPin(dialog.pin || '')
      updateData(d => ({ ...d, users: d.users.map(u => u.id === dialog.value ? { ...u, pinHash } : u) }))
      setDialog(null); setToast('Safety PIN saved.'); return
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
      navigate(route(activeUser, f, p)); setDialog(null); setMobileNav(false); setTimeout(() => editor.current?.focus(), 40); return
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
      if (!targetUser.pinHash) { setToast('Set a safety PIN before deleting this profile.'); setDialog({ kind: 'set-pin', value: targetUser.id }); return }
      if (!dialog.pin || await hashPin(dialog.pin) !== targetUser.pinHash) { setToast('Incorrect safety PIN.'); return }
      const remaining = data.users.filter(u => u.id !== targetUser.id)
      updateData(d => ({ ...d, users: remaining }))
      navigate(remaining[0] ? routeFor(remaining[0]) : '/'); setDialog(null); return
    }
    setDialog(null)
  }
  const copy = async (text: string, success = 'Copied') => {
    try { await navigator.clipboard.writeText(text); setToast(success) }
    catch { setToast('Clipboard blocked — select the text and copy manually.') }
    setTimeout(() => setToast(''), 2400)
  }
  const shareWorkspace = `${location.pathname}?workspace=${workspace}`
  const exportData = () => downloadText(`note-packet-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  const exportNotePacket = () => {
    const packet = {
      format: 'Note Packet',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      notebook: data
    }
    downloadText(`note-packet-${new Date().toISOString().slice(0,10)}.ntpkt`, JSON.stringify(packet, null, 2), NOTE_PACKET_FILE_TYPE)
  }
  const importData = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      let imported = safeParse(String(reader.result))
      if (!imported) {
        try {
          const packet = JSON.parse(String(reader.result))
          if (packet?.format === 'Note Packet' && packet.formatVersion === 1) imported = safeParse(JSON.stringify(packet.notebook))
        } catch {}
      }
      if (!imported) { setToast('That backup file is not valid.'); return }
      if (confirm('Replace the current notebook with this backup?')) setData(imported)
    }
    reader.readAsText(file)
  }

  const markdownHtml = activePage ? DOMPurify.sanitize(marked.parse(activePage.content.replace(/```mermaid\s*([\s\S]*?)```/gi, (_match, chart: string) => `<div class="mermaid">${chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`), { async: false })) : ''
  const statusIcon = sync === 'saved' ? <Cloud size={14}/> : sync === 'saving' || sync === 'loading' ? <span className="spinner"/> : <CloudOff size={14}/>
  const statusText = ({loading:'Connecting', saved:'Synced', saving:'Saving…', offline:'Offline · local copy', error:'Sync failed · local copy'} as const)[sync]

  const themeOptions = [{ value: 'default', label: 'Green default' }, { value: 'minimalist', label: 'Minimalist' }, { value: 'claude', label: 'Claude' }, { value: 'chatgpt', label: 'ChatGPT' }, { value: 'cyberpunk', label: 'Cyberpunk' }, { value: 'high-contrast', label: 'High contrast' }]
  const isDarkTheme = themeMode === 'dark'
  const toggleTheme = () => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')
  const handleDockPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    mobileDockDrag.current = {
      startX: event.clientX,
      startY: event.clientY,
      initialX: mobileDockOffset.x,
      initialY: mobileDockOffset.y,
      moved: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleDockPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const drag = mobileDockDrag.current
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true
    if (!drag.moved) return
    const maxX = Math.max(0, window.innerWidth - 76)
    const maxY = Math.max(0, window.innerHeight - 76)
    setMobileDockOffset({
      x: Math.min(0, Math.max(-maxX, drag.initialX + deltaX)),
      y: Math.min(0, Math.max(-maxY, drag.initialY + deltaY))
    })
  }
  const handleDockPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (mobileDockDrag.current.moved) {
      suppressDockClick.current = true
      window.setTimeout(() => { suppressDockClick.current = false }, 0)
    }
  }
  const toggleMobileDock = () => {
    if (suppressDockClick.current) return
    setMobileDockExpanded(expanded => !expanded)
  }
  const markdownPreview = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!preview || !markdownPreview.current) return
    const flowColors = isDarkTheme
      ? { primaryColor: theme === 'high-contrast' ? '#111111' : '#242424', primaryTextColor: '#f5f2ec', nodeTextColor: '#f5f2ec', primaryBorderColor: theme === 'high-contrast' ? '#ffffff' : theme === 'cyberpunk' ? '#00ff41' : '#88827b', lineColor: theme === 'high-contrast' ? '#ffffff' : theme === 'cyberpunk' ? '#00ff41' : '#e1794f', secondaryColor: '#242424', tertiaryColor: '#1b1b1b', textColor: '#f5f2ec' }
      : { primaryColor: theme === 'high-contrast' ? '#fff200' : theme === 'cyberpunk' ? '#ffd7f3' : '#f5d7c2', primaryTextColor: '#262421', nodeTextColor: '#262421', primaryBorderColor: theme === 'cyberpunk' ? '#ed72c5' : '#c87545', lineColor: theme === 'cyberpunk' ? '#8b2f78' : '#c87545', secondaryColor: '#f7f5f2', tertiaryColor: '#ffffff', textColor: '#262421' }
    mermaid.initialize({ startOnLoad: false, theme: isDarkTheme ? 'dark' : 'base', themeVariables: flowColors, securityLevel: 'strict' })
    mermaid.run({ nodes: Array.from(markdownPreview.current.querySelectorAll<HTMLElement>('.mermaid')) }).catch(error => setToast(error instanceof Error ? 'Unable to render this flowchart.' : 'Unable to render this flowchart.'))
  }, [preview, activePage?.content, theme, isDarkTheme])

  if (!activeUser) return <div className={`profile-picker theme-${theme} ${isDarkTheme ? 'dark-mode' : ''}`}>
    <div className="profile-picker-top"><div className="brand-mark">n.</div><div className="landing-bubbles" aria-hidden="true"><span>⌁</span><span>✦</span><span>☄</span></div><button className="theme-picker-btn" onClick={toggleTheme} aria-label="Toggle theme">{isDarkTheme ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
    <div className="profile-picker-content"><span className="eyebrow">THE INTERNET'S TINIEST NOTE UNIVERSE</span><h1>Who is using <em>Note Packet</em>?</h1><p className="landing-intro">A shared digital fridge for thoughts. Pick a profile, open a folder, and rescue your brilliant ideas from the dangerous swamp called “I’ll remember it later.”</p><div className="landing-punchline"><span>🧠</span> Notes go in. Chaos gets organized. <span>✨</span></div><div className="landing-features"><span>✦ Markdown + Mermaid</span><span>◐ PDF download</span><span>↗ Shareable workspace links</span><span>◒ Five visual themes</span></div><h2>Choose your human</h2><div className="profile-grid">{data.users.map(user => <button key={user.id} className="profile-card" onClick={() => navigate(routeFor(user))}><span className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</span><strong>{user.name}</strong><small>{user.folders.length} {user.folders.length === 1 ? 'folder' : 'folders'} · {user.folders.reduce((count, folder) => count + folder.pages.length, 0)} notes</small></button>)}<button className="profile-card profile-add" onClick={() => ask('user')}><Plus size={25}/><strong>Join the packet</strong><small>Make a shared profile</small></button></div><div className="landing-how"><div><b>1</b><span>Pick a profile</span></div><div><b>2</b><span>Find a folder</span></div><div><b>3</b><span>Ship the idea</span></div></div></div>
    <footer className="profile-picker-footer">Developed by <a href="https://github.com/Dharaneesh20" target="_blank" rel="noreferrer"><Github size={13}/> Dharaneesh20</a></footer>
    {dialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null) }}><div className="modal"><div className="modal-head"><h3>New user</h3><button className="icon-btn" onClick={() => setDialog(null)}><X size={17}/></button></div><form onSubmit={e => { e.preventDefault(); submitDialog() }}><input autoFocus className="modal-input" value={dialog.value || ''} onChange={e => setDialog(d => d ? {...d,value:e.target.value} : d)} placeholder="e.g. Personal" maxLength={80}/><input className="modal-input pin-input" type="password" inputMode="numeric" pattern="\d{4}|\d{6}" maxLength={6} value={dialog.pin || ''} onChange={e => setDialog(d => d ? {...d,pin:e.target.value.replace(/\D/g, '')} : d)} placeholder="4 or 6 digit safety PIN" aria-label="Safety PIN"/><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="solid-btn"><Check size={15}/> Save</button></div></form></div></div>}
  </div>

  return <div className={`app-shell theme-${theme} ${isDarkTheme ? 'dark-mode' : ''}`}>
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark">n.</div><div><strong>Note Packet</strong><small>PERSONAL WORKSPACE</small></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label"><span>WORKSPACE</span><button className="text-btn" onClick={() => setShowWorkspace(v => !v)}><Settings2 size={14}/> Link</button></div>
      {showWorkspace && <div className="workspace-box"><p>Use this private link on your other devices to access the same notebook.</p><button className="outline-btn full" onClick={() => copy(`${window.location.origin}/?workspace=${workspace}`, 'Workspace link copied')}><Copy size={14}/> Copy workspace link</button><p className="warning">Anyone with this link can access and edit your notes. Keep it private.</p></div>}
      <div className="section-head"><span>USERS</span><button className="icon-btn" onClick={() => ask('user')} title="New user"><Plus size={16}/></button></div>
      <div className="user-list">{data.users.map(u => <div key={u.id} className={`user-row ${activeUser?.id === u.id ? 'selected' : ''}`}><Link to={routeFor(u)} onClick={() => setMobileNav(false)} className="user-item"><Users size={15}/><span>{u.name}</span>{activeUser?.id === u.id && <ChevronDown size={14}/>}</Link><button className="mini-btn" title="Profile options" onClick={() => ask('user-menu', u.id)}><MoreHorizontal size={16}/></button></div>)}</div>
      <div className="section-head folders-head"><span>FOLDERS</span><button className="icon-btn" onClick={() => ask('folder')} title="New folder" disabled={!activeUser}><FolderPlus size={16}/></button></div>
      <div className="folder-list explorer-list">{activeUser?.folders.map(f => <div key={f.id} className={`explorer-folder ${activeFolder?.id === f.id ? 'selected' : ''}`}><div className="explorer-folder-row"><button className="explorer-toggle" onClick={() => setExpandedFolders(old => ({ ...old, [f.id]: !old[f.id] }))} aria-label={`${expandedFolders[f.id] ? 'Collapse' : 'Expand'} ${f.name}`}>{expandedFolders[f.id] ? '▾' : '▸'}</button><Link to={route(activeUser, f)} onClick={() => setMobileNav(false)}><Folder size={15}/><span>{f.name}</span><small>{f.pages.length}</small></Link><button className="mini-btn" title="Folder options" onClick={() => ask('folder-menu', f.id)}><MoreHorizontal size={16}/></button></div>{expandedFolders[f.id] && <div className="explorer-pages">{f.pages.map(p => <Link key={p.id} to={route(activeUser, f, p)} onClick={() => setMobileNav(false)} className={activePage?.id === p.id ? 'active' : ''}><FilePlus2 size={13}/><span>{p.title || 'Untitled'}</span></Link>)}</div>}</div>)}</div>
      <button className="new-page-btn" onClick={() => ask('page')} disabled={!activeUser}><FilePlus2 size={16}/> New page <span>↵</span></button>
      <div className="sidebar-bottom"><div className="sync-status">{statusIcon}<span>{statusText}</span></div><div className="side-actions"><button onClick={exportNotePacket} title="Export Note Packet file"><Download size={14}/> .ntpkt</button><button onClick={exportData} title="Export JSON backup"><Download size={14}/> JSON</button><label><Upload size={14}/> Import<input type="file" accept=".ntpkt,application/vnd.notepacket+json,.json,application/json" hidden onChange={e => importData(e.target.files?.[0])}/></label><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} mode`}>{isDarkTheme ? <Sun size={14}/> : <Moon size={14}/>} {isDarkTheme ? 'Light' : 'Dark'}</button><select className="theme-select"  value={theme} onChange={e => setTheme(e.target.value)} aria-label="Choose theme">{themeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="credit">Developed by <a href="https://github.com/Dharaneesh20" target="_blank" rel="noreferrer"><Github size={12}/> Dharaneesh20</a></div></div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19}/></button><div className="breadcrumbs"><span>{activeUser?.name || 'Workspace'}</span>{activeFolder && <><ChevronRight size={14}/><span>{activeFolder.name}</span></>}{activePage && <><ChevronRight size={14}/><strong>{activePage.title || 'Untitled'}</strong></>}</div><div className="top-actions"><span className={`save-pill ${sync}`} title={lastSync}>{statusIcon}<span>{statusText}</span></span><button className="icon-btn" onClick={() => copy(activePage?.content || '', 'Page copied')} title="Copy page text"><Clipboard size={17}/></button><button className="icon-btn" onClick={() => activePage && downloadText(`${activePage.title || 'note'}.txt`, activePage.content)} title="Download page"><Download size={17}/></button><button className="outline-btn print-btn" onClick={() => window.print()} disabled={!activePage} title="Print this page or save it as a PDF"><Download size={14}/> PDF</button></div></header>
      <div className="content">
        <section className="editor-panel">
          {activePage ? <><div className="editor-heading"><input className="title-input" value={activePage.title} onChange={e => updatePage('title', e.target.value)} placeholder="Untitled page" aria-label="Page title"/><div className="editor-tools"><button className="outline-btn" onClick={() => ask('rename-page')}><Pencil size={14}/> Rename</button><button className="icon-btn danger-icon" onClick={() => ask('delete-page')} title="Delete page"><Trash2 size={16}/></button></div></div><div className="editor-meta"><span>MARKDOWN · MERMAID FLOWCHARTS</span><span>·</span><span>{activePage.content.length.toLocaleString()} characters</span><span className="meta-spacer"/><button className="text-btn" onClick={() => setPreview(value => !value)}>{preview ? 'Edit' : 'Preview'}</button><button className="text-btn" onClick={() => copy(activePage.content, 'Content copied')}><Copy size={13}/> Copy text</button></div>{preview ? <article ref={markdownPreview} className="markdown-preview" dangerouslySetInnerHTML={{ __html: markdownHtml }} /> : <textarea ref={editor} className="note-editor" value={activePage.content} onChange={e => updatePage('content', e.target.value)} placeholder="Paste Markdown or a ```mermaid flowchart here…" spellCheck={false} aria-label="Note content"/>}<div className="editor-footer"><span>Markdown · Autosaves as you type</span><span>{sync === 'saved' ? <><Check size={13}/> Saved</> : statusText}</span></div></> : <div className="welcome-empty"><div className="empty-mark">p.</div><h2>Your space, your notes.</h2><p>Create a page to start collecting snippets, links, code, and anything you want to keep.</p><button className="solid-btn" onClick={() => ask('page')}><Plus size={16}/> Create your first page</button></div>}
        </section>
      </div>
      <div className="print-header"><span className="print-logo">n.</span><strong>Note Packet</strong><span>https://notepacket.vercel.app</span></div>
      {activePage && <article className="print-note"><h1>{activePage.title || 'Untitled'}</h1><div dangerouslySetInnerHTML={{ __html: markdownHtml }} /></article>}
      <footer className="print-footer"><span className="print-logo">n.</span><span>Note Packet · <a href="https://notepacket.vercel.app">notepacket.vercel.app</a> · Developed by <a href="https://github.com/Dharaneesh20">Dharaneesh20</a></span></footer>
    </main>
    <nav className={`mobile-dock ${mobileDockExpanded ? 'expanded' : ''}`} style={{ transform: `translate(${mobileDockOffset.x}px, ${mobileDockOffset.y}px)` }} onPointerDown={handleDockPointerDown} onPointerMove={handleDockPointerMove} onPointerUp={handleDockPointerUp} aria-label="Mobile actions">
      <button className="mobile-dock-toggle" onClick={toggleMobileDock} aria-label={mobileDockExpanded ? 'Collapse mobile actions' : 'Expand mobile actions'}><MoreHorizontal size={21}/></button>
      {mobileDockExpanded && <><button onClick={() => { setMobileNav(true); setMobileDockExpanded(false) }} aria-label="Open navigation"><Menu size={19}/><span>Explorer</span></button><button onClick={() => { ask('page'); setMobileDockExpanded(false) }} disabled={!activeUser} aria-label="New page"><Plus size={20}/><span>New</span></button><button onClick={() => { toggleTheme(); setMobileDockExpanded(false) }} aria-label="Toggle theme">{isDarkTheme ? <Sun size={19}/> : <Moon size={19}/>}<span>Theme</span></button>{activePage && <button onClick={() => { window.print(); setMobileDockExpanded(false) }} aria-label="Download PDF"><Download size={19}/><span>PDF</span></button>}</>}
    </nav>
    {dialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null) }}><div className="modal"><div className="modal-head"><h3>{({user:'New user',folder:'New folder',page:'New page','rename-user':'Rename user','rename-folder':'Rename folder','rename-page':'Rename page','delete-page':'Delete this page?','delete-folder':'Delete this folder?','delete-user':'Delete this user?','folder-menu':'Folder options','user-menu':'Profile options','set-pin':'Set safety PIN'} as Record<string,string>)[dialog.kind] || 'Confirm'}</h3><button className="icon-btn" onClick={() => setDialog(null)}><X size={17}/></button></div>
      {dialog.kind === 'folder-menu' ? <div className="modal-actions vertical"><button onClick={() => { const f = activeUser?.folders.find(f => f.id === dialog.value); setDialog({kind:'rename-folder',value:f?.name || ''}) }}><Pencil size={15}/> Rename folder</button><button className="danger-text" onClick={() => setDialog({kind:'delete-folder'})}><Trash2 size={15}/> Delete folder</button></div> :
      dialog.kind === 'user-menu' ? <div className="modal-actions vertical"><button onClick={() => { const u = data.users.find(u => u.id === dialog.value); setDialog({kind:'rename-user',value:u?.name || ''}) }}><Pencil size={15}/> Rename profile</button><button onClick={() => setDialog({kind:'set-pin',value:dialog.value})}>Set or change safety PIN</button><button className="danger-text" onClick={() => setDialog({kind:'delete-user',value:dialog.value})}><Trash2 size={15}/> Delete profile</button></div> :
      ['delete-page','delete-folder'].includes(dialog.kind) ? <><p className="modal-copy">{dialog.kind === 'delete-page' ? 'This page and its content will be permanently deleted.' : 'This folder and all pages inside it will be permanently deleted.'}</p><div className="modal-actions"><button className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button className="solid-btn danger-btn" onClick={submitDialog}><Trash2 size={15}/> Delete</button></div></> :
      <form onSubmit={e => { e.preventDefault(); submitDialog() }}>{['user','rename-user','folder','page','rename-folder','rename-page'].includes(dialog.kind) && <input autoFocus className="modal-input" value={dialog.value || ''} onChange={e => setDialog(d => d ? {...d,value:e.target.value} : d)} placeholder={dialog.kind === 'user' ? 'e.g. Personal' : dialog.kind === 'folder' ? 'e.g. College' : dialog.kind === 'page' ? 'e.g. Quick snippet' : 'Enter a name'} maxLength={80}/>} {['user','set-pin','delete-user'].includes(dialog.kind) && <input autoFocus={dialog.kind !== 'user'} className="modal-input pin-input" type="password" inputMode="numeric" pattern="\d{4}|\d{6}" maxLength={6} value={dialog.pin || ''} onChange={e => setDialog(d => d ? {...d,pin:e.target.value.replace(/\D/g, '')} : d)} placeholder={dialog.kind === 'delete-user' ? 'Enter safety PIN' : '4 or 6 digit safety PIN'} aria-label="Safety PIN"/>}<div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="solid-btn"><Check size={15}/> Save</button></div></form>}</div></div>}
    {toast && <div className="toast"><Check size={15}/>{toast}</div>}
  </div>
}