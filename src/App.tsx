import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Archive, Check, ChevronDown, ChevronRight, Clipboard, Cloud, CloudOff, Copy, Download, FilePlus2, Folder, FolderPlus, Menu, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, Upload, Users, X } from 'lucide-react'
import type { Notebook, User, Folder as NoteFolder, Page } from './types'
import { newId, starterNotebook } from './types'

const LOCAL_KEY = 'pocket-notes-cache-v1'
const WORKSPACE_KEY = 'pocket-notes-workspace-v1'
const randomWorkspace = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
function getWorkspace() {
  const params = new URLSearchParams(window.location.search)
  let key = params.get('workspace') || localStorage.getItem(WORKSPACE_KEY)
  if (!key || !/^[a-zA-Z0-9_-]{20,80}$/.test(key)) key = randomWorkspace()
  localStorage.setItem(WORKSPACE_KEY, key)
  if (params.get('workspace') !== key) {
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
  const [data, setData] = useState<Notebook>(() => safeParse(localStorage.getItem(LOCAL_KEY)) || starterNotebook())
  const [sync, setSync] = useState<'loading'|'saved'|'saving'|'offline'|'error'>('loading')
  const [lastSync, setLastSync] = useState('')
  const [filter, setFilter] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [dialog, setDialog] = useState<{kind: string; value?: string} | null>(null)
  const [toast, setToast] = useState('')
  const editor = useRef<HTMLTextAreaElement>(null)
  const firstSync = useRef(true)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverUpdated = useRef<number>(0)

  const activeUser = data.users.find(u => u.id === params.userId) || data.users[0]
  const activeFolder = activeUser?.folders.find(f => f.id === params.folderId) || activeUser?.folders[0]
  const activePage = activeFolder?.pages.find(p => p.id === params.pageId) || activeFolder?.pages[0]
  const route = (u = activeUser, f?: NoteFolder, p?: Page) => u ? routeFor(u, f, p) : '/'

  const persistLocal = useCallback((next: Notebook) => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {
      setToast('Browser storage is full. Export a backup before continuing.')
    }
  }, [])

  // Fetch shared notebook on startup. Local cache remains usable if offline.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/notebook?key=${encodeURIComponent(workspace)}`, { cache: 'no-store' })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Sync unavailable'); return body })
      .then(body => {
        if (cancelled) return
        const remote = body.data as Notebook | null
        if (remote && Array.isArray(remote.users)) {
          const local = safeParse(localStorage.getItem(LOCAL_KEY))
          const localTime = local?.updatedAt || 0
          const remoteTime = remote.updatedAt || 0
          // The server is authoritative once it has data; local-only edits are pushed if newer.
          if (local && localTime > remoteTime) setData(local)
          else { setData(remote); persistLocal(remote); serverUpdated.current = remoteTime }
        } else {
          const local = safeParse(localStorage.getItem(LOCAL_KEY))
          if (local) setData(local)
        }
        setSync(navigator.onLine ? 'saved' : 'offline')
        setLastSync('Connected')
        firstSync.current = false
      })
      .catch(() => {
        if (!cancelled) { setSync('offline'); firstSync.current = false }
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
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Sync failed')
        setSync('saved'); setLastSync(new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))
        serverUpdated.current = next.updatedAt
      } catch { setSync('error') }
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
    if (!activeUser) navigate('/', { replace: true })
    else if (!params.userId || !params.folderId || !params.pageId) {
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
  const submitDialog = () => {
    if (!dialog) return
    const name = dialog.value?.trim()
    if (dialog.kind === 'user' && name) {
      const u: User = { id: newId(), name, folders: [{ id: newId(), name: 'Notes', pages: [] }] }
      updateData(d => ({ ...d, users: [...d.users, u] })); navigate(routeFor(u, u.folders[0])); setDialog(null); return
    }
    if (!activeUser) return
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
      const remaining = data.users.filter(u => u.id !== activeUser.id)
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
  const exportData = () => downloadText(`pocket-notes-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  const importData = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const imported = safeParse(String(reader.result))
      if (!imported) { setToast('That backup file is not valid.'); return }
      if (confirm('Replace the current notebook with this backup?')) setData(imported)
    }
    reader.readAsText(file)
  }

  const allPages = activeUser?.folders.flatMap(f => f.pages.map(p => ({...p, folderName: f.name, folderId: f.id}))) || []
  const filteredPages = allPages.filter(p => !filter || `${p.title} ${p.content} ${p.folderName}`.toLowerCase().includes(filter.toLowerCase()))
  const statusIcon = sync === 'saved' ? <Cloud size={14}/> : sync === 'saving' || sync === 'loading' ? <span className="spinner"/> : <CloudOff size={14}/>
  const statusText = ({loading:'Connecting', saved:'Synced', saving:'Saving…', offline:'Offline · local copy', error:'Sync failed · local copy'} as const)[sync]

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark">p.</div><div><strong>Pocket Notes</strong><small>PERSONAL WORKSPACE</small></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label"><span>WORKSPACE</span><button className="text-btn" onClick={() => setShowWorkspace(v => !v)}><Settings2 size={14}/> Link</button></div>
      {showWorkspace && <div className="workspace-box"><p>Use this private link on your other devices to access the same notebook.</p><button className="outline-btn full" onClick={() => copy(`${location.origin}/?workspace=${workspace}`, 'Workspace link copied')}><Copy size={14}/> Copy workspace link</button><p className="warning">Anyone with this link can access and edit your notes. Keep it private.</p></div>}
      <div className="section-head"><span>USERS</span><button className="icon-btn" onClick={() => ask('user')} title="New user"><Plus size={16}/></button></div>
      <div className="user-list">{data.users.map(u => <Link key={u.id} to={routeFor(u)} onClick={() => setMobileNav(false)} className={`user-item ${activeUser?.id === u.id ? 'selected' : ''}`}><Users size={15}/><span>{u.name}</span>{activeUser?.id === u.id && <ChevronDown size={14}/>}</Link>)}</div>
      <div className="section-head folders-head"><span>FOLDERS</span><button className="icon-btn" onClick={() => ask('folder')} title="New folder" disabled={!activeUser}><FolderPlus size={16}/></button></div>
      <div className="folder-list">{activeUser?.folders.map(f => <div key={f.id} className={`folder-item ${activeFolder?.id === f.id ? 'selected' : ''}`}><Link to={route(activeUser, f)} onClick={() => setMobileNav(false)}><Folder size={15}/><span>{f.name}</span><small>{f.pages.length}</small></Link><button className="mini-btn" title="Folder options" onClick={() => ask('folder-menu', f.id)}><MoreHorizontal size={16}/></button></div>)}</div>
      <button className="new-page-btn" onClick={() => ask('page')} disabled={!activeUser}><FilePlus2 size={16}/> New page <span>↵</span></button>
      <div className="sidebar-bottom"><div className="sync-status">{statusIcon}<span>{statusText}</span></div><div className="side-actions"><button onClick={exportData}><Download size={14}/> Export</button><label><Upload size={14}/> Import<input type="file" accept="application/json,.json" hidden onChange={e => importData(e.target.files?.[0])}/></label></div></div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19}/></button><div className="breadcrumbs"><span>{activeUser?.name || 'Workspace'}</span>{activeFolder && <><ChevronRight size={14}/><span>{activeFolder.name}</span></>}{activePage && <><ChevronRight size={14}/><strong>{activePage.title || 'Untitled'}</strong></>}</div><div className="top-actions"><span className={`save-pill ${sync}`} title={lastSync}>{statusIcon}<span>{statusText}</span></span><button className="icon-btn" onClick={() => copy(activePage?.content || '', 'Page copied')} title="Copy page text"><Clipboard size={17}/></button><button className="icon-btn" onClick={() => activePage && downloadText(`${activePage.title || 'note'}.txt`, activePage.content)} title="Download page"><Download size={17}/></button></div></header>
      <div className="content">
        <div className="page-list-panel">
          <div className="list-title"><div><span className="eyebrow">PAGES</span><h2>{activeFolder?.name || 'All notes'}</h2></div><button className="solid-btn compact" onClick={() => ask('page')} title="Create page"><Plus size={16}/></button></div>
          <div className="search-box"><Search size={15}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find a page…"/>{filter && <button onClick={() => setFilter('')}><X size={14}/></button>}</div>
          <div className="page-list">{(filter ? filteredPages : (activeFolder?.pages || []).map(p => ({...p, folderName: activeFolder?.name || '', folderId: activeFolder?.id || ''}))).map(p => <Link key={`${p.folderId}-${p.id}`} to={route(activeUser, activeUser?.folders.find(f => f.id === p.folderId), p)} className={`page-card ${activePage?.id === p.id ? 'active' : ''}`}><div className="page-card-icon"><Archive size={15}/></div><div className="page-card-copy"><strong>{p.title || 'Untitled'}</strong><span>{p.content.trim().replace(/\s+/g, ' ').slice(0, 58) || 'Empty page'}</span>{filter && <small>{p.folderName}</small>}</div></Link>)}
            {!(filter ? filteredPages : activeFolder?.pages || []).length && <div className="empty-list"><FilePlus2 size={22}/><p>{filter ? 'No matching pages' : 'Nothing here yet'}</p><button className="text-btn" onClick={() => ask('page')}>Create a page</button></div>}
          </div>
          <div className="list-footer">{allPages.length} {allPages.length === 1 ? 'page' : 'pages'} total</div>
        </div>
        <section className="editor-panel">
          {activePage ? <><div className="editor-heading"><input className="title-input" value={activePage.title} onChange={e => updatePage('title', e.target.value)} placeholder="Untitled page" aria-label="Page title"/><div className="editor-tools"><button className="outline-btn" onClick={() => ask('rename-page')}><Pencil size={14}/> Rename</button><button className="icon-btn danger-icon" onClick={() => ask('delete-page')} title="Delete page"><Trash2 size={16}/></button></div></div><div className="editor-meta"><span>PLAIN TEXT</span><span>·</span><span>{activePage.content.length.toLocaleString()} characters</span><span className="meta-spacer"/><button className="text-btn" onClick={() => copy(activePage.content, 'Content copied')}><Copy size={13}/> Copy text</button></div><textarea ref={editor} className="note-editor" value={activePage.content} onChange={e => updatePage('content', e.target.value)} placeholder="Paste or write anything here…" spellCheck={false} aria-label="Note content"/><div className="editor-footer"><span>Plain text · Autosaves as you type</span><span>{sync === 'saved' ? <><Check size={13}/> Saved</> : statusText}</span></div></> : <div className="welcome-empty"><div className="empty-mark">p.</div><h2>Your space, your notes.</h2><p>Create a page to start collecting snippets, links, code, and anything you want to keep.</p><button className="solid-btn" onClick={() => ask('page')}><Plus size={16}/> Create your first page</button></div>}
        </section>
      </div>
    </main>
    {dialog && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null) }}><div className="modal"><div className="modal-head"><h3>{({user:'New user',folder:'New folder',page:'New page','rename-user':'Rename user','rename-folder':'Rename folder','rename-page':'Rename page','delete-page':'Delete this page?','delete-folder':'Delete this folder?','delete-user':'Delete this user?','folder-menu':'Folder options'} as Record<string,string>)[dialog.kind] || 'Confirm'}</h3><button className="icon-btn" onClick={() => setDialog(null)}><X size={17}/></button></div>
      {dialog.kind === 'folder-menu' ? <div className="modal-actions vertical"><button onClick={() => { const f = activeUser?.folders.find(f => f.id === dialog.value); setDialog({kind:'rename-folder',value:f?.name || ''}) }}><Pencil size={15}/> Rename folder</button><button className="danger-text" onClick={() => setDialog({kind:'delete-folder'})}><Trash2 size={15}/> Delete folder</button></div> :
      ['delete-page','delete-folder','delete-user'].includes(dialog.kind) ? <><p className="modal-copy">{dialog.kind === 'delete-page' ? 'This page and its content will be permanently deleted.' : dialog.kind === 'delete-folder' ? 'This folder and all pages inside it will be permanently deleted.' : 'This user and all their folders and pages will be permanently deleted.'}</p><div className="modal-actions"><button className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button className="solid-btn danger-btn" onClick={submitDialog}><Trash2 size={15}/> Delete</button></div></> :
      <form onSubmit={e => { e.preventDefault(); submitDialog() }}><input autoFocus className="modal-input" value={dialog.value || ''} onChange={e => setDialog(d => d ? {...d,value:e.target.value} : d)} placeholder={dialog.kind === 'user' ? 'e.g. Personal' : dialog.kind === 'folder' ? 'e.g. College' : dialog.kind === 'page' ? 'e.g. Quick snippet' : 'Enter a name'} maxLength={80}/><div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="solid-btn"><Check size={15}/> Save</button></div></form>}</div></div>}
    {toast && <div className="toast"><Check size={15}/>{toast}</div>}
  </div>
}