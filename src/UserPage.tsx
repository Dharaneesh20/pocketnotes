import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Moon, Plus, Search, Upload, Lock, Globe, Key,
  ArrowLeft, ArrowRight, FolderOpen, FileText, Check, ShieldCheck, X
} from 'lucide-react'
import type { Notebook, User } from './types'

interface UserPageProps {
  data: Notebook
  theme: string
  themeMode: 'light' | 'dark'
  onSetTheme: (theme: string) => void
  onToggleTheme: () => void
  onOpenUser: (user: User) => void
  onCreateUser: () => void
  onImport: (file?: File) => void
}

const THEME_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'claude', label: 'Claude' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'high-contrast', label: 'High contrast' },
]

export function UserPage({
  data,
  theme,
  themeMode,
  onSetTheme,
  onToggleTheme,
  onOpenUser,
  onCreateUser,
  onImport
}: UserPageProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDark = themeMode === 'dark'
  const filteredUsers = data.users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onImport(file)
    }
  }

  return (
    <div className={`user-page-wrapper theme-${theme} ${isDark ? 'dark-mode' : ''}`}>
      {/* Top navigation */}
      <header className="user-page-nav">
        <div className="user-page-nav-inner">
          <div className="user-page-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="brand-mark">n.</div>
            <div>
              <strong>Note Packet</strong>
              <small>PROFILES</small>
            </div>
          </div>

          <div className="user-page-nav-actions">
            <button
              className="user-nav-btn user-nav-back"
              onClick={() => navigate('/')}
              title="Return to Home page"
            >
              <ArrowLeft size={15} />
              <span>Back to Home</span>
            </button>

            {/* Theme switcher dropdown */}
            <div className="theme-select-wrapper">
              <select
                className="user-theme-select"
                value={theme}
                onChange={e => onSetTheme(e.target.value)}
                aria-label="Select theme"
              >
                {THEME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode toggle */}
            <button
              className="user-theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main container */}
      <main className="user-page-container">
        {/* Page Hero */}
        <div className="user-page-hero">
          <span className="user-page-eyebrow">SAVED WORKSPACES & IDENTITIES</span>
          <h1 className="user-page-title">Who is using Note Packet?</h1>
          <p className="user-page-subtitle">
            Select a profile to jump straight to your notes, create a new space, or sign in using your .ntid key file.
          </p>
        </div>

        {/* Toolbar: Search & Add button */}
        <div className="user-page-toolbar">
          <div className="user-search-wrapper">
            <Search size={16} className="user-search-icon" />
            <input
              type="text"
              className="user-search-input"
              placeholder="Search profiles by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search profiles"
            />
            {search && (
              <button
                className="user-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="user-toolbar-actions">
            <button
              className="user-add-btn"
              onClick={onCreateUser}
              title="Create a new profile"
            >
              <Plus size={16} />
              <span>New Profile</span>
            </button>
          </div>
        </div>

        {/* Profiles Grid */}
        <div className="user-cards-grid">
          {filteredUsers.map(u => {
            const totalNotes = u.folders.reduce((sum, f) => sum + f.pages.length, 0)
            const isProtected = Boolean(u.pinHash && !u.isPublic)

            return (
              <div
                key={u.id}
                className="user-profile-card"
                onClick={() => onOpenUser(u)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenUser(u)
                  }
                }}
              >
                <div className="user-avatar-badge">
                  <div className="user-avatar-circle">
                    {u.name.slice(0, 1).toUpperCase()}
                  </div>
                  {isProtected ? (
                    <span className="user-lock-pill" title="PIN protected">
                      <Lock size={11} /> PIN
                    </span>
                  ) : (
                    <span className="user-lock-pill public" title="Public profile">
                      <Globe size={11} /> Public
                    </span>
                  )}
                </div>

                <div className="user-card-details">
                  <h3 className="user-card-title">{u.name}</h3>
                  <div className="user-card-stats">
                    <span>
                      <FolderOpen size={12} /> {u.folders.length} {u.folders.length === 1 ? 'folder' : 'folders'}
                    </span>
                    <span>·</span>
                    <span>
                      <FileText size={12} /> {totalNotes} {totalNotes === 1 ? 'note' : 'notes'}
                    </span>
                  </div>
                </div>

                <div className="user-card-action">
                  <span>Open workspace</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            )
          })}

          {/* New Profile Quick Card */}
          <div
            className="user-profile-card user-card-new"
            onClick={onCreateUser}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCreateUser()
              }
            }}
          >
            <div className="user-avatar-circle new-avatar">
              <Plus size={24} />
            </div>
            <div className="user-card-details">
              <h3 className="user-card-title">Add Profile</h3>
              <p className="user-card-meta-text">Create a personal or team space</p>
            </div>
          </div>
        </div>

        {/* Empty Search Result */}
        {filteredUsers.length === 0 && search && (
          <div className="user-search-empty">
            <p>No profiles found matching &ldquo;{search}&rdquo;.</p>
            <button className="user-btn-text" onClick={() => setSearch('')}>
              Clear search filter
            </button>
          </div>
        )}

        {/* .ntid Identity Key Import Section */}
        <section
          className={`user-ntid-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="user-ntid-header">
            <div className="ntid-icon-badge">
              <Key size={22} />
            </div>
            <div className="ntid-header-text">
              <h2>Have a .ntid Key File?</h2>
              <p>
                Import your <strong>.ntid</strong> identity key file or notebook backup (<strong>.ntpkt / .json</strong>) to restore and sign in instantly without typing a PIN.
              </p>
            </div>
          </div>

          <div className="user-ntid-box">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ntid,.ntpkt,application/vnd.notepacket+json,.json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onImport(file)
              }}
            />
            <div className="user-ntid-drop-copy">
              <Upload size={20} className="ntid-upload-icon" />
              <span>Drag and drop your <strong>.ntid</strong> file here, or</span>
              <button
                type="button"
                className="user-ntid-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse .ntid file
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="user-page-footer">
        <span>Note Packet</span>
        <span>·</span>
        <span>Developed by <a href="https://github.com/Dharaneesh20" target="_blank" rel="noreferrer">Dharaneesh20</a></span>
      </footer>
    </div>
  )
}
