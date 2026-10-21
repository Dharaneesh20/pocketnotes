import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import mermaid from 'mermaid'
import {
  Check, ChevronRight, Clipboard, Cloud, CloudOff, Copy, Download,
  FilePlus2, Folder, FolderPlus, Github, Menu, Moon, MoreHorizontal,
  Pencil, Plus, Search, Settings2, Share2, Sun, Trash2, Upload,
  Users, X, ArrowLeft, Home, LogOut, FileText, Eye, Edit2,
  Highlighter, Bookmark, RotateCcw, Eraser, BookmarkCheck,
  GripVertical, Minimize2
} from 'lucide-react'
import type { Notebook, User, Folder as NoteFolder, Page } from './types'

type HighlightColor = 'yellow' | 'green' | 'pink' | 'cyan' | 'orange'

const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; hex: string }[] = [
  { id: 'yellow', label: 'Canary Yellow', hex: '#EAB308' },
  { id: 'green', label: 'Fresh Emerald', hex: '#22C55E' },
  { id: 'pink', label: 'Neon Pink', hex: '#EC4899' },
  { id: 'cyan', label: 'Sky Cyan', hex: '#0EA5E9' },
  { id: 'orange', label: 'Sunset Amber', hex: '#F97316' }
]

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
  onShowToast?: (msg: string) => void
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
  onShowToast, workspace, shareWorkspace, markdownHtml, requiresPin, route
}: WorkspaceProps) {
  const isDark = themeMode === 'dark'
  const [mobileNav, setMobileNav] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showWorkspaceLink, setShowWorkspaceLink] = React.useState(false)
  const [selectedColor, setSelectedColor] = React.useState<HighlightColor>('yellow')
  const [historyStack, setHistoryStack] = React.useState<string[]>([])
  const [showBookmarksMenu, setShowBookmarksMenu] = React.useState(false)
  const [justSaved, setJustSaved] = React.useState(false)
  const [targetMode, setTargetMode] = React.useState<'highlight' | 'bookmark' | null>(null)
  const [ballExpanded, setBallExpanded] = React.useState<boolean>(false)
  const [ballPos, setBallPos] = React.useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 80) : 800,
    y: 160
  }))
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; ballX: number; ballY: number } | null>(null)
  const hasMovedRef = useRef<boolean>(false)
  const bmMenuRef = useRef<HTMLDivElement>(null)
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

  const bookmarks = React.useMemo(() => {
    if (!activePage?.content) return []
    const list: { color: HighlightColor; text: string; raw: string; index: number }[] = []
    const regex = /<span\s+class="bm-pin\s+bm-([a-z]+)"[^>]*>.*?<\/span>\s*([^\n\r]*)/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(activePage.content)) !== null) {
      list.push({
        color: (match[1] || 'yellow') as HighlightColor,
        text: match[2]?.replace(/<[^>]+>/g, '').trim() || 'Bookmarked line',
        raw: match[0],
        index: match.index
      })
    }
    return list
  }, [activePage?.content])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bmMenuRef.current && !bmMenuRef.current.contains(e.target as Node)) {
        setShowBookmarksMenu(false)
      }
    }
    if (showBookmarksMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBookmarksMenu])

  const applyBookmarkAtPos = (color: HighlightColor, pos: number) => {
    if (!activePage) return
    const text = activePage.content
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1
    let lineEnd = text.indexOf('\n', pos)
    if (lineEnd === -1) lineEnd = text.length

    const lineContent = text.slice(lineStart, lineEnd)
    const cleanLine = lineContent.replace(/<span\s+class="bm-pin[^"]*"[^>]*>.*?<\/span>\s*/gi, '')
    const bookmarkTag = `<span class="bm-pin bm-${color}" data-bm="true" title="Bookmarked line">🔖 [${color.toUpperCase()}]</span> `
    const newContent = text.slice(0, lineStart) + bookmarkTag + cleanLine + text.slice(lineEnd)

    setHistoryStack(prev => [...prev.slice(-30), text])
    onUpdatePageField('content', newContent)
    onShowToast?.(`Line bookmarked with ${color}!`)

    if (!preview && editor.current) {
      const newCursor = lineStart + bookmarkTag.length
      setTimeout(() => {
        editor.current?.focus()
        editor.current?.setSelectionRange(newCursor, newCursor)
      }, 40)
    }
  }

  const applyHighlightRange = (color: HighlightColor, start: number, end: number) => {
    if (!activePage) return
    const text = activePage.content
    let newContent = ''
    let newEnd = end

    if (start !== end) {
      const selected = text.slice(start, end)
      const wrapped = `<mark class="hl-${color}">${selected}</mark>`
      newContent = text.slice(0, start) + wrapped + text.slice(end)
      newEnd = start + wrapped.length
    } else {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      let lineEnd = text.indexOf('\n', end)
      if (lineEnd === -1) lineEnd = text.length
      const line = text.slice(lineStart, lineEnd)
      if (!line.trim()) {
        onShowToast?.('Click on text or drag to select words to highlight.')
        return
      }
      const wrapped = `<mark class="hl-${color}">${line}</mark>`
      newContent = text.slice(0, lineStart) + wrapped + text.slice(lineEnd)
      newEnd = lineStart + wrapped.length
    }

    setHistoryStack(prev => [...prev.slice(-30), text])
    onUpdatePageField('content', newContent)
    onShowToast?.(`Highlighted with ${color}!`)
    setTimeout(() => {
      editor.current?.focus()
      editor.current?.setSelectionRange(newEnd, newEnd)
    }, 40)
  }

  const applyHighlight = (color: HighlightColor) => {
    if (!activePage) return
    const el = editor.current
    if (!preview && el && el.selectionStart !== el.selectionEnd) {
      applyHighlightRange(color, el.selectionStart, el.selectionEnd)
      setTargetMode(null)
      return
    }
    const sel = window.getSelection()?.toString().trim()
    if (preview && sel && activePage.content.includes(sel)) {
      const idx = activePage.content.indexOf(sel)
      applyHighlightRange(color, idx, idx + sel.length)
      setTargetMode(null)
      return
    }
    setTargetMode(curr => {
      const next = curr === 'highlight' ? null : 'highlight'
      if (next) onShowToast?.('🖍️ Highlight mode: click any line or drag to highlight (or Esc to cancel)')
      return next
    })
  }

  const handleSwatchClick = (color: HighlightColor) => {
    setSelectedColor(color)
    const el = editor.current
    if (!preview && el && el.selectionStart !== el.selectionEnd) {
      applyHighlightRange(color, el.selectionStart, el.selectionEnd)
    }
  }

  const applyBookmark = (color: HighlightColor) => {
    if (!activePage) return
    const el = editor.current
    if (!preview && el && el.selectionStart !== el.selectionEnd) {
      applyBookmarkAtPos(color, el.selectionStart)
      setTargetMode(null)
      return
    }
    setTargetMode(curr => {
      const next = curr === 'bookmark' ? null : 'bookmark'
      if (next) onShowToast?.('🔖 Bookmark mode: click the exact line to bookmark (or Esc to cancel)')
      return next
    })
  }

  const handleEditorClick = () => {
    if (!targetMode || !activePage) return
    const el = editor.current
    if (!el) return
    setTimeout(() => {
      const pos = el.selectionStart
      if (targetMode === 'bookmark') {
        applyBookmarkAtPos(selectedColor, pos)
      } else if (targetMode === 'highlight') {
        if (el.selectionStart !== el.selectionEnd) {
          applyHighlightRange(selectedColor, el.selectionStart, el.selectionEnd)
        } else {
          applyHighlightRange(selectedColor, pos, pos)
        }
      }
      setTargetMode(null)
    }, 15)
  }

  const handlePreviewClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!targetMode || !activePage) return
    const target = e.target as HTMLElement
    const text = target.textContent?.trim()
    if (text && activePage.content.includes(text)) {
      const idx = activePage.content.indexOf(text)
      if (targetMode === 'bookmark') {
        applyBookmarkAtPos(selectedColor, idx)
      } else {
        applyHighlightRange(selectedColor, idx, idx + text.length)
      }
      setTargetMode(null)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetMode) {
        setTargetMode(null)
        onShowToast?.('Target selection mode cancelled')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [targetMode])

  const handleBallMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      ballX: ballPos.x,
      ballY: ballPos.y
    }
    hasMovedRef.current = false
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true
      }
      if (hasMovedRef.current) {
        const dockW = ballExpanded ? 340 : 48
        const dockH = ballExpanded ? 48 : 48
        const newX = Math.max(8, Math.min(window.innerWidth - dockW - 8, dragStartRef.current.ballX + dx))
        const newY = Math.max(8, Math.min(window.innerHeight - dockH - 8, dragStartRef.current.ballY + dy))
        setBallPos({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [ballExpanded])

  const jumpToBookmark = (bm: { color: string; text: string; raw: string; index: number }) => {
    setShowBookmarksMenu(false)
    if (preview && markdownPreview.current) {
      const pins = Array.from(markdownPreview.current.querySelectorAll('.bm-pin'))
      const match = pins.find(p => p.textContent?.toLowerCase().includes(bm.color)) || pins[0]
      if (match) {
        match.scrollIntoView({ behavior: 'smooth', block: 'center' })
        match.classList.add('bm-flash')
        setTimeout(() => match.classList.remove('bm-flash'), 1600)
      }
    } else if (editor.current) {
      editor.current.focus()
      const pos = activePage ? activePage.content.indexOf(bm.raw) : -1
      if (pos !== -1) {
        editor.current.setSelectionRange(pos, pos + bm.raw.length)
        const linesBefore = activePage!.content.slice(0, pos).split('\n').length
        editor.current.scrollTop = Math.max(0, (linesBefore - 3) * 24)
      }
    }
    onShowToast?.(`Jumped to ${bm.color} bookmark`)
  }

  const removeBookmark = (rawTag: string) => {
    if (!activePage) return
    setHistoryStack(prev => [...prev.slice(-30), activePage.content])
    const newContent = activePage.content.replace(rawTag, '')
    onUpdatePageField('content', newContent)
    onShowToast?.('Bookmark removed')
  }

  const handleResetFormat = () => {
    if (!activePage) return
    const text = activePage.content
    const clean = text
      .replace(/<mark\s+class="hl-[^"]*">([\s\S]*?)<\/mark>/gi, '$1')
      .replace(/<span\s+class="bm-pin[^"]*"[^>]*>.*?<\/span>\s*/gi, '')
    if (clean === text) {
      onShowToast?.('Document has no highlights or bookmarks to reset.')
      return
    }
    setHistoryStack(prev => [...prev.slice(-30), text])
    onUpdatePageField('content', clean)
    onShowToast?.('Document format reset to clean markdown.')
  }

  const handleUndo = () => {
    if (historyStack.length === 0 || !activePage) return
    const previous = historyStack[historyStack.length - 1]
    setHistoryStack(prev => prev.slice(0, -1))
    onUpdatePageField('content', previous)
    onShowToast?.('Undid last highlight or bookmark action.')
  }

  const handleSaveHighlight = () => {
    if (!activePage) return
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
    onShowToast?.('Highlights and bookmarks saved successfully!')
  }

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
                {/* Highlighter & Bookmark toolbar */}
                <div className="ws-hl-toolbar" role="toolbar" aria-label="Highlight and Bookmark Tools">
                  <div className="ws-hl-group">
                    <span className="ws-hl-label">Color:</span>
                    <div className="ws-hl-swatches">
                      {HIGHLIGHT_COLORS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`ws-hl-swatch ${c.id} ${selectedColor === c.id ? 'active' : ''}`}
                          onClick={() => handleSwatchClick(c.id)}
                          title={`Select ${c.label} (${c.id})`}
                          aria-label={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`ws-hl-action-btn ${targetMode === 'highlight' ? 'active-target' : ''}`}
                    onClick={() => applyHighlight(selectedColor)}
                    title={targetMode === 'highlight' ? 'Highlight mode active — click any line or drag to highlight (or Esc to cancel)' : 'Highlight selected text or click a line'}
                  >
                    <Highlighter size={13} />
                    <span>{targetMode === 'highlight' ? 'Pick a line…' : 'Highlight'}</span>
                  </button>

                  <div className="ws-hl-divider" />

                  <button
                    type="button"
                    className={`ws-hl-action-btn ws-bm-btn ${targetMode === 'bookmark' ? 'active-target' : ''}`}
                    onClick={() => applyBookmark(selectedColor)}
                    title={targetMode === 'bookmark' ? 'Bookmark mode active — click the exact line to bookmark (or Esc to cancel)' : `Bookmark line with ${selectedColor}`}
                  >
                    <Bookmark size={13} />
                    <span>{targetMode === 'bookmark' ? 'Pick a line…' : 'Bookmark line'}</span>
                  </button>

                  {bookmarks.length > 0 && (
                    <div className="ws-bm-menu-wrapper" ref={bmMenuRef}>
                      <button
                        type="button"
                        className={`ws-hl-action-btn ws-bm-badge-btn ${showBookmarksMenu ? 'active' : ''}`}
                        onClick={() => setShowBookmarksMenu(!showBookmarksMenu)}
                        title="View all bookmarked lines"
                      >
                        <BookmarkCheck size={13} />
                        <span>Bookmarks</span>
                        <span className="ws-bm-count">{bookmarks.length}</span>
                      </button>

                      {showBookmarksMenu && (
                        <div className="ws-bm-dropdown">
                          <div className="ws-bm-dropdown-header">
                            <span>Bookmarked lines ({bookmarks.length})</span>
                            <button
                              type="button"
                              className="ws-bm-close"
                              onClick={() => setShowBookmarksMenu(false)}
                              aria-label="Close bookmarks"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <div className="ws-bm-list">
                            {bookmarks.map((bm, i) => (
                              <div
                                key={i}
                                className="ws-bm-item"
                                onClick={() => jumpToBookmark(bm)}
                                title="Click to jump to this line"
                              >
                                <span className={`ws-bm-dot ${bm.color}`} />
                                <span className="ws-bm-item-text">{bm.text}</span>
                                <button
                                  type="button"
                                  className="ws-bm-item-del"
                                  onClick={e => {
                                    e.stopPropagation()
                                    removeBookmark(bm.raw)
                                  }}
                                  title="Remove bookmark"
                                  aria-label="Remove bookmark"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ws-hl-spacer" />

                  <button
                    type="button"
                    className="ws-hl-tool-btn"
                    onClick={handleUndo}
                    disabled={historyStack.length === 0}
                    title={historyStack.length > 0 ? "Undo last highlight/bookmark" : "Nothing to undo"}
                  >
                    <RotateCcw size={13} />
                    <span>Undo</span>
                  </button>

                  <button
                    type="button"
                    className={`ws-hl-tool-btn ws-hl-save-btn ${justSaved ? 'saved' : ''}`}
                    onClick={handleSaveHighlight}
                    title="Save current highlights & bookmarks"
                  >
                    <Check size={13} />
                    <span>{justSaved ? 'Saved!' : 'Save'}</span>
                  </button>

                  <button
                    type="button"
                    className="ws-hl-tool-btn ws-hl-reset-btn"
                    onClick={handleResetFormat}
                    title="Reset to old document format (removes all highlights and bookmarks)"
                  >
                    <Eraser size={13} />
                    <span>Reset format</span>
                  </button>
                </div>
                {preview
                  ? <article
                      ref={markdownPreview}
                      className={`ws-markdown-preview ${targetMode ? 'ws-targeting-active' : ''}`}
                      onClick={handlePreviewClick}
                      dangerouslySetInnerHTML={{ __html: markdownHtml }}
                    />
                  : <textarea
                      ref={editor}
                      className={`ws-note-editor ${targetMode ? 'ws-targeting-active' : ''}`}
                      value={activePage.content}
                      onChange={e => onUpdatePageField('content', e.target.value)}
                      onClick={handleEditorClick}
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

      {/* Draggable & Collapsible Floating Quick Ball Widget */}
      <div
        className={`ws-quick-ball-container ${ballExpanded ? 'expanded' : 'collapsed'} ${isDragging ? 'dragging' : ''}`}
        style={{ left: `${ballPos.x}px`, top: `${ballPos.y}px` }}
        role="region"
        aria-label="Quick Highlight and Bookmark Ball"
      >
        {!ballExpanded ? (
          <button
            type="button"
            className="ws-quick-ball"
            onMouseDown={handleBallMouseDown}
            onClick={() => {
              if (!hasMovedRef.current) setBallExpanded(true)
            }}
            title="Quick Highlight & Bookmark Ball (drag to move, click to expand)"
            style={{ '--ball-accent': HIGHLIGHT_COLORS.find(c => c.id === selectedColor)?.hex || '#EAB308' } as React.CSSProperties}
          >
            <div className="ws-quick-ball-inner">
              <Highlighter size={16} />
              <span className={`ws-quick-ball-dot ${selectedColor}`} />
            </div>
          </button>
        ) : (
          <div className="ws-quick-dock">
            <div
              className="ws-quick-dock-handle"
              onMouseDown={handleBallMouseDown}
              title="Drag dock anywhere"
            >
              <GripVertical size={14} />
            </div>

            <div className="ws-quick-dock-swatches">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`ws-quick-swatch ${c.id} ${selectedColor === c.id ? 'active' : ''}`}
                  onClick={() => handleSwatchClick(c.id)}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>

            <div className="ws-quick-dock-divider" />

            <button
              type="button"
              className={`ws-quick-btn ${targetMode === 'highlight' ? 'active-target' : ''}`}
              onClick={() => applyHighlight(selectedColor)}
              title={targetMode === 'highlight' ? 'Click line to highlight (or click to cancel)' : 'Highlight (select text or click line)'}
            >
              <Highlighter size={13} />
              <span>{targetMode === 'highlight' ? 'Pick line…' : 'Highlight'}</span>
            </button>

            <button
              type="button"
              className={`ws-quick-btn ws-quick-bm-btn ${targetMode === 'bookmark' ? 'active-target' : ''}`}
              onClick={() => applyBookmark(selectedColor)}
              title={targetMode === 'bookmark' ? 'Click line to bookmark (or click to cancel)' : 'Bookmark line'}
            >
              <Bookmark size={13} />
              <span>{targetMode === 'bookmark' ? 'Pick line…' : 'Bookmark'}</span>
            </button>

            <div className="ws-quick-dock-divider" />

            <button
              type="button"
              className="ws-quick-icon-btn"
              onClick={handleUndo}
              disabled={historyStack.length === 0}
              title="Undo last format"
            >
              <RotateCcw size={13} />
            </button>

            <button
              type="button"
              className="ws-quick-icon-btn ws-quick-reset"
              onClick={handleResetFormat}
              title="Reset format"
            >
              <Eraser size={13} />
            </button>

            <button
              type="button"
              className="ws-quick-icon-btn ws-quick-collapse"
              onClick={() => setBallExpanded(false)}
              title="Collapse into ball"
            >
              <Minimize2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button className="ws-fab" onClick={() => onAsk('page')} aria-label="New note">
        <Plus size={22} />
      </button>
    </div>
  )
}
