import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import mermaid from 'mermaid'
import {
  Check, ChevronRight, Clipboard, Cloud, CloudOff, Copy, Download,
  FilePlus2, Folder, FolderPlus, Github, Menu, Moon, MoreHorizontal,
  Pencil, Plus, Search, Settings2, Share2, Sun, Trash2, Upload,
  Users, X, ArrowLeft, Home, LogOut, FileText, Eye, Edit2
} from 'lucide-react'
import type { Notebook, User, Folder as NoteFolder, Page } from './types'

interface WorkspaceProps {
  data: Notebook
  activeUser: User
  activeFolder?: NoteFolder
  activePage?: Page
  sync: 'loading' | 'saved' | 'saving' | 'offline' | 'error'
  lastSync: string
  themeMode: 'light' | 'dark'
  theme: string
  preview: boolean
  expandedFolders: Record<string, boolean>
  onToggleTheme: () => void
  onSetTheme: (t: string) => void
  onSetPreview: (v: boolean) => void
  onToggleFolder: (id: string) => void
  onUpdatePageField: (field: 'title' | 'content', value: string) => void
  onAsk: (kind: string, value?: string) => void
  onOpenUser: (u: User) => void
  onCopy: (text: string, msg?: string) => void
  onShareNote: () => void
  onExportNote: () => void
  onExportNotePacket: () => void
  onExportJson: () => void
  onImport: (file?: File) => void
  onExportNtid: (user: User) => void
  onSignOut: () => void
  workspace: string
  shareWorkspace: string
  markdownHtml: string
  requiresPin: (u: User) => boolean
  route: (u?: User, f?: NoteFolder, p?: Page) => string
}

export function Workspace({
  data, activeUser, activeFolder, activePage, sync, lastSync,
  themeMode, theme, preview, expandedFolders,
  onToggleTheme, onSetTheme, onSetPreview, onToggleFolder,
  onUpdatePageField, onAsk, onOpenUser, onCopy,
  onShareNote, onExportNote, onExportNotePacket, onExportJson, onImport, onExportNtid, onSignOut,
  workspace, shareWorkspace, markdownHtml, requiresPin, route
}: WorkspaceProps) {
  const isDark = themeMode === 'dark'
  const [mobileNav, setMobileNav] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showWorkspaceLink, setShowWorkspaceLink] = React.useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const markdownPreview = useRef<HTMLElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const statusIcon = sync === 'saved' ? <Cloud size={13} /> : sync === 'saving' || sync === 'loading' ? <span className="ws-spinner" /> : <CloudOff size={13} />
  const statusText: Record<typeof sync, string> = { loading: 'Connecting', saved: 'Synced', saving: 'Saving…', offline: 'Offline', error: 'Sync failed' }

  const themeOptions = [
    { value: 'default', label: 'Default' },
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'claude', label: 'Claude' },
    { value: 'chatgpt', label: 'ChatGPT' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'high-contrast', label: 'High contrast' }
  ]

  const getFlowchartTheme = (t: string, dark: boolean) => {
    switch (t) {
      case 'claude':
        return dark
          ? {
              primaryColor: '#2E2520',
              primaryTextColor: '#F7F2EB',
              nodeTextColor: '#F7F2EB',
              primaryBorderColor: '#E88653',
              lineColor: '#E88653',
              secondaryColor: '#25201C',
              tertiaryColor: '#1A1614',
              textColor: '#F7F2EB',
              mainBkg: '#2E2520',
              nodeBorder: '#E88653',
              fontFamily: 'Georgia, Cambria, serif'
            }
          : {
              primaryColor: '#F7ECE4',
              primaryTextColor: '#2E2724',
              nodeTextColor: '#2E2724',
              primaryBorderColor: '#D97746',
              lineColor: '#D97746',
              secondaryColor: '#FFFDF9',
              tertiaryColor: '#F0E8DD',
              textColor: '#2E2724',
              mainBkg: '#F7ECE4',
              nodeBorder: '#D97746',
              fontFamily: 'Georgia, Cambria, serif'
            }
      case 'chatgpt':
        return dark
          ? {
              primaryColor: '#162B24',
              primaryTextColor: '#F0F6FC',
              nodeTextColor: '#F0F6FC',
              primaryBorderColor: '#10A37F',
              lineColor: '#10A37F',
              secondaryColor: '#161B22',
              tertiaryColor: '#0D1117',
              textColor: '#F0F6FC',
              mainBkg: '#162B24',
              nodeBorder: '#10A37F',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }
          : {
              primaryColor: '#E6F7F2',
              primaryTextColor: '#202123',
              nodeTextColor: '#202123',
              primaryBorderColor: '#10A37F',
              lineColor: '#10A37F',
              secondaryColor: '#FFFFFF',
              tertiaryColor: '#F0FAF7',
              textColor: '#202123',
              mainBkg: '#E6F7F2',
              nodeBorder: '#10A37F',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }
      case 'cyberpunk':
        return dark
          ? {
              primaryColor: '#140A2B',
              primaryTextColor: '#00FF66',
              nodeTextColor: '#00FF66',
              primaryBorderColor: '#00F0FF',
              lineColor: '#FF007F',
              secondaryColor: '#1F0D3D',
              tertiaryColor: '#090414',
              textColor: '#00FF66',
              mainBkg: '#140A2B',
              nodeBorder: '#00F0FF',
              fontFamily: 'Courier New, monospace'
            }
          : {
              primaryColor: '#FFE6F3',
              primaryTextColor: '#1F0D3D',
              nodeTextColor: '#1F0D3D',
              primaryBorderColor: '#FF007F',
              lineColor: '#FF007F',
              secondaryColor: '#FFFFFF',
              tertiaryColor: '#F3E8FF',
              textColor: '#1F0D3D',
              mainBkg: '#FFE6F3',
              nodeBorder: '#FF007F',
              fontFamily: 'Courier New, monospace'
            }
      case 'high-contrast':
        return dark
          ? {
              primaryColor: '#000000',
              primaryTextColor: '#FFFFFF',
              nodeTextColor: '#FFFFFF',
              primaryBorderColor: '#FFFF00',
              lineColor: '#FFFF00',
              secondaryColor: '#000000',
              tertiaryColor: '#111111',
              textColor: '#FFFFFF',
              mainBkg: '#000000',
              nodeBorder: '#FFFF00'
            }
          : {
              primaryColor: '#FFFFFF',
              primaryTextColor: '#000000',
              nodeTextColor: '#000000',
              primaryBorderColor: '#000000',
              lineColor: '#000000',
              secondaryColor: '#FFFFFF',
              tertiaryColor: '#FFFF00',
              textColor: '#000000',
              mainBkg: '#FFFFFF',
              nodeBorder: '#000000'
            }
      case 'minimalist':
        return dark
          ? {
              primaryColor: '#181818',
              primaryTextColor: '#EDEDED',
              nodeTextColor: '#EDEDED',
              primaryBorderColor: '#555555',
              lineColor: '#888888',
              secondaryColor: '#141414',
              tertiaryColor: '#0A0A0A',
              textColor: '#EDEDED',
              mainBkg: '#181818',
              nodeBorder: '#555555'
            }
          : {
              primaryColor: '#F7F7F7',
              primaryTextColor: '#111111',
              nodeTextColor: '#111111',
              primaryBorderColor: '#222222',
              lineColor: '#222222',
              secondaryColor: '#FFFFFF',
              tertiaryColor: '#EEEEEE',
              textColor: '#111111',
              mainBkg: '#F7F7F7',
              nodeBorder: '#222222'
            }
      case 'default':
      default:
        return dark
          ? {
              primaryColor: '#181B22',
              primaryTextColor: '#F3F4F6',
              nodeTextColor: '#F3F4F6',
              primaryBorderColor: '#FFE500',
              lineColor: '#FFE500',
              secondaryColor: '#12141A',
              tertiaryColor: '#0F1115',
              textColor: '#F3F4F6',
              mainBkg: '#181B22',
              nodeBorder: '#FFE500'
            }
          : {
              primaryColor: '#FFFCE6',
              primaryTextColor: '#111111',
              nodeTextColor: '#111111',
              primaryBorderColor: '#111111',
              lineColor: '#111111',
              secondaryColor: '#FFFFFF',
              tertiaryColor: '#FFE500',
              textColor: '#111111',
              mainBkg: '#FFFCE6',
              nodeBorder: '#111111'
            }
    }
  }

  useEffect(() => {
    if (!preview || !markdownPreview.current) return
    const nodes = Array.from(markdownPreview.current.querySelectorAll<HTMLElement>('.mermaid'))
    if (!nodes.length) return

    // Restore original chart definition before re-running mermaid with new theme variables
    nodes.forEach(node => {
      const dataChart = node.getAttribute('data-chart')
      if (dataChart) {
        node.innerHTML = decodeURIComponent(dataChart)
      }
      node.removeAttribute('data-processed')
      node.removeAttribute('id')
    })

    const flowTheme = getFlowchartTheme(theme, isDark)
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: flowTheme,
      securityLevel: 'strict'
    })
    mermaid.run({ nodes }).catch(() => {})
  }, [preview, activePage?.content, theme, isDark])

  return (
    <div className={`ws-shell theme-${theme} ${isDark ? 'dark-mode' : ''}`}>
      {/* Sidebar */}
      <aside className={`ws-sidebar ${mobileNav ? 'ws-sidebar-open' : ''}`}>
        <div className="ws-sidebar-head">
          <Link to="/" className="ws-brand">
            <div className="brand-sq">n.</div>
            <div className="ws-brand-text">
              <strong>Note Packet</strong>
              <small>WORKSPACE</small>
            </div>
          </Link>
          <button className="ws-icon-btn ws-mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Profile info */}
        <div className="ws-profile-row">
          <div className="ws-profile-avatar">{activeUser.name.slice(0, 1).toUpperCase()}</div>
          <div className="ws-profile-info">
            <strong>{activeUser.name}</strong>
            <span className={`ws-badge ${activeUser.isPublic ? 'public' : 'private'}`}>
              {activeUser.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          <button className="ws-icon-btn" onClick={() => onAsk('user-menu', activeUser.id)} title="Profile options">
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Switch profile */}
        <Link to="/users" className="ws-switch-btn" title="View all users">
          <Users size={14} /> All profiles
        </Link>

        {/* Search */}
        <div className="ws-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search notes…"
            aria-label="Search notes"
            onInput={(e) => {
              // Simple scroll-to-first-match
              const q = (e.target as HTMLInputElement).value.toLowerCase()
              if (!q) return
            }}
          />
        </div>

        {/* Folders */}
        <div className="ws-section-head">
          <span>FOLDERS</span>
          <button className="ws-icon-btn" onClick={() => onAsk('folder')} title="New folder">
            <FolderPlus size={15} />
          </button>
        </div>
        <div className="ws-folder-list">
          {activeUser.folders.map(f => (
            <div key={f.id} className={`ws-folder-item ${activeFolder?.id === f.id ? 'active' : ''}`}>
              <div className="ws-folder-row">
                <button
                  className="ws-toggle-btn"
                  onClick={() => onToggleFolder(f.id)}
                  aria-label={`${expandedFolders[f.id] ? 'Collapse' : 'Expand'} ${f.name}`}
                >
                  <ChevronRight size={13} style={{ transform: expandedFolders[f.id] ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                <Link
                  to={route(activeUser, f)}
                  className="ws-folder-link"
                  onClick={() => setMobileNav(false)}
                >
                  <Folder size={14} />
                  <span>{f.name}</span>
                  <small>{f.pages.length}</small>
                </Link>
                <button className="ws-icon-btn ws-more-btn" onClick={() => onAsk('folder-menu', f.id)} title="Folder options">
                  <MoreHorizontal size={14} />
                </button>
              </div>
              {expandedFolders[f.id] && (
                <div className="ws-pages-list">
                  {f.pages.map(p => (
                    <Link
                      key={p.id}
                      to={route(activeUser, f, p)}
                      onClick={() => setMobileNav(false)}
                      className={`ws-page-link ${activePage?.id === p.id ? 'active' : ''}`}
                    >
                      <FileText size={12} />
                      <span>{p.title || 'Untitled'}</span>
                    </Link>
                  ))}
                  {f.pages.length === 0 && (
                    <div className="ws-empty-folder">No pages yet</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {activeUser.folders.length === 0 && (
            <div className="ws-empty-folder-msg">
              <p>No folders yet.</p>
              <button className="ws-text-btn" onClick={() => onAsk('folder')}>Create one</button>
            </div>
          )}
        </div>

        {/* New page button */}
        <button className="ws-new-page-btn" onClick={() => onAsk('page')}>
          <FilePlus2 size={15} /> New page
        </button>

        {/* Sidebar bottom */}
        <div className="ws-sidebar-bottom">
          <div className={`ws-sync-status ${sync}`}>
            {statusIcon}
            <span>{statusText[sync]}</span>
            {lastSync && sync === 'saved' && <span className="ws-sync-time">{lastSync}</span>}
          </div>

          {/* Direct Theme Control Row */}
          <div className="ws-theme-row">
            <select
              className="ws-theme-select"
              value={theme}
              onChange={e => onSetTheme(e.target.value)}
              aria-label="Choose theme"
            >
              {themeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              className="ws-theme-toggle-btn"
              onClick={onToggleTheme}
              aria-label="Toggle light/dark mode"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>

          {/* Backup & Import options */}
          <div className="ws-quick-actions">
            <button onClick={onExportNotePacket} title="Export Note Packet file">
              <Download size={12} /> .ntpkt
            </button>
            <button onClick={() => onExportNtid(activeUser)} title="Export identity key">
              <Download size={12} /> .ntid
            </button>
            <label title="Import backup or .ntid">
              <Upload size={12} /> Import
              <input type="file" accept=".ntid,.ntpkt,application/vnd.notepacket+json,.json" hidden onChange={e => onImport(e.target.files?.[0])} />
            </label>
          </div>

          {/* Workspace link */}
          <button className="ws-text-btn ws-workspace-btn" onClick={() => setShowWorkspaceLink(v => !v)}>
            <Settings2 size={13} /> Workspace link
          </button>
          {showWorkspaceLink && (
            <div className="ws-link-box">
              <p>Share this URL to let others access the same notebook.</p>
              <button className="ws-outline-btn" onClick={() => onCopy(`${window.location.origin}/?workspace=${workspace}`, 'Workspace link copied')}>
                <Copy size={13} /> Copy link
              </button>
              <p className="ws-warning">Anyone with this link can read and edit your notes.</p>
            </div>
          )}

          <div className="ws-credit">
            Built by <a href="https://github.com/Dharaneesh20" target="_blank" rel="noreferrer"><Github size={11} /> Dharaneesh20</a>
          </div>
        </div>
      </aside>

      {/* Scrim */}
      {mobileNav && <button className="ws-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      {/* Main content */}
      <main className="ws-main">
        {/* Top bar */}
        <header className="ws-topbar">
          <button className="ws-icon-btn ws-menu-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu size={19} />
          </button>
          <nav className="ws-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="ws-breadcrumb-home" title="Home"><Home size={14} /></Link>
            <ChevronRight size={12} />
            <Link to="/users" className="ws-breadcrumb-users" title="All profiles"><Users size={13} /> Profiles</Link>
            <ChevronRight size={12} />
            <span>{activeUser.name}</span>
            {activeFolder && <><ChevronRight size={12} /><span>{activeFolder.name}</span></>}
            {activePage && <><ChevronRight size={12} /><strong>{activePage.title || 'Untitled'}</strong></>}
          </nav>
          <div className="ws-top-actions">
            {/* Quick theme selector in topbar */}
            <select
              className="ws-topbar-theme-select"
              value={theme}
              onChange={e => onSetTheme(e.target.value)}
              aria-label="Choose theme"
            >
              {themeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              className="ws-icon-btn"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className={`ws-save-pill ${sync}`} title={lastSync}>
              {statusIcon}<span>{statusText[sync]}</span>
            </span>
            <button className="ws-icon-btn" onClick={() => onCopy(activePage?.content || '', 'Content copied')} title="Copy page text" disabled={!activePage}>
              <Clipboard size={16} />
            </button>
            <button className="ws-icon-btn" onClick={onShareNote} disabled={!activePage} title="Share note">
              <Share2 size={16} />
            </button>
            <button className="ws-icon-btn" onClick={onExportNote} disabled={!activePage} title="Download note">
              <Download size={16} />
            </button>
            <button className="ws-outline-btn ws-pdf-btn" onClick={() => window.print()} disabled={!activePage} title="Export PDF">
              <Download size={13} /> PDF
            </button>
            <button className="ws-new-note-btn" onClick={() => onAsk('page')}>
              <Plus size={15} /> New note
            </button>
          </div>
        </header>

        {/* Editor area */}
        <div className="ws-content">
          <div className="ws-editor-panel">
            {activePage ? (
              <>
                <div className="ws-editor-head">
                  <input
                    className="ws-title-input"
                    value={activePage.title}
                    onChange={e => onUpdatePageField('title', e.target.value)}
                    placeholder="Untitled page"
                    aria-label="Page title"
                  />
                  <div className="ws-editor-tools">
                    <button
                      className="ws-mode-btn"
                      onClick={() => onSetPreview(!preview)}
                      title={preview ? 'Switch to edit mode' : 'Switch to preview mode'}
                    >
                      {preview ? <Edit2 size={14} /> : <Eye size={14} />}
                      {preview ? 'Edit' : 'Preview'}
                    </button>
                    <button className="ws-icon-btn" onClick={() => onAsk('rename-page')} title="Rename page">
                      <Pencil size={15} />
                    </button>
                    <button className="ws-icon-btn ws-danger-btn" onClick={() => onAsk('delete-page')} title="Delete page">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="ws-editor-meta">
                  <span>MARKDOWN · MERMAID</span>
                  <span>·</span>
                  <span>{activePage.content.length.toLocaleString()} characters</span>
                  <div className="ws-meta-spacer" />
                  <button className="ws-text-btn" onClick={onShareNote}><Share2 size={12} /> Share</button>
                  <button className="ws-text-btn" onClick={() => onCopy(activePage.content, 'Content copied')}><Copy size={12} /> Copy</button>
                </div>
                {preview
                  ? <article ref={markdownPreview} className="ws-markdown-preview" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
                  : <textarea
                      ref={editor}
                      className="ws-note-editor"
                      value={activePage.content}
                      onChange={e => onUpdatePageField('content', e.target.value)}
                      placeholder="Write in Markdown, paste a ```mermaid flowchart, or just start typing…"
                      spellCheck={false}
                      aria-label="Note content"
                    />
                }
                <div className="ws-editor-footer">
                  <span>Markdown · Autosaves as you type</span>
                  <span className={`ws-save-indicator ${sync}`}>
                    {sync === 'saved' ? <><Check size={12} /> Saved</> : statusText[sync]}
                  </span>
                </div>
              </>
            ) : (
              <div className="ws-welcome">
                <div className="ws-welcome-icon">
                  <div className="brand-sq lg">n.</div>
                </div>
                <h2>Your ideas, in one place.</h2>
                <p>
                  {activeFolder
                    ? `"${activeFolder.name}" is empty. Create your first note to get started.`
                    : 'Select a folder from the sidebar or create a new note.'}
                </p>
                <button className="ws-solid-btn" onClick={() => onAsk('page')}>
                  <Plus size={15} /> Create a note
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Print header/footer */}
        <div className="print-header">
          <span className="print-logo">n.</span>
          <strong>Note Packet</strong>
          <span>https://notepacket.vercel.app</span>
        </div>
        {activePage && <article className="print-note"><h1>{activePage.title || 'Untitled'}</h1><div dangerouslySetInnerHTML={{ __html: markdownHtml }} /></article>}
        <footer className="print-footer"><span className="print-logo">n.</span><span>Note Packet · <a href="https://notepacket.vercel.app">notepacket.vercel.app</a></span></footer>
      </main>

      {/* Mobile FAB */}
      <button className="ws-fab" onClick={() => onAsk('page')} aria-label="New note">
        <Plus size={22} />
      </button>
    </div>
  )
}
