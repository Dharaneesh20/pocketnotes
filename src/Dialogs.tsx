import React from 'react'
import { X, Check, Trash2, Pencil, Download, Lock, AlertTriangle } from 'lucide-react'
import type { Notebook, User } from './types'

export interface DialogState {
  kind: string
  value?: string
  pin?: string
  isPublic?: boolean
}

interface DialogsProps {
  dialog: DialogState | null
  data: Notebook
  onClose: () => void
  onSubmit: () => void
  onChange: (d: DialogState) => void
  onAsk: (kind: string, value?: string) => void
}

const DIALOG_TITLES: Record<string, string> = {
  user: 'Create profile',
  login: 'Unlock profile',
  folder: 'New folder',
  page: 'New page',
  'rename-user': 'Rename profile',
  'rename-folder': 'Rename folder',
  'rename-page': 'Rename page',
  'delete-page': 'Delete this page?',
  'delete-folder': 'Delete this folder?',
  'delete-user': 'Delete this profile?',
  'folder-menu': 'Folder options',
  'user-menu': 'Profile options',
  'set-pin': 'Set security PIN',
  'toggle-visibility': 'Change visibility',
}

export function Dialogs({ dialog, data, onClose, onSubmit, onChange, onAsk }: DialogsProps) {
  if (!dialog) return null

  const targetUser = data.users.find(u => u.id === dialog.value)

  return (
    <div className="dlg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label={DIALOG_TITLES[dialog.kind] || 'Dialog'}>
      <div className="dlg-modal">
        <div className="dlg-head">
          <h3>{DIALOG_TITLES[dialog.kind] || 'Confirm'}</h3>
          <button className="dlg-close" onClick={onClose} aria-label="Close dialog"><X size={17} /></button>
        </div>

        {/* Login dialog */}
        {dialog.kind === 'login' && (
          <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <div className="dlg-user-preview">
              <div className="dlg-avatar">{targetUser?.name.slice(0, 1).toUpperCase() || '?'}</div>
              <strong>{targetUser?.name}</strong>
            </div>
            <div className="dlg-field">
              <label>Enter your PIN</label>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="\d{4}|\d{6}"
                maxLength={6}
                className="dlg-input dlg-pin"
                placeholder="4 or 6 digit PIN"
                value={dialog.pin || ''}
                onChange={e => onChange({ ...dialog, pin: e.target.value.replace(/\D/g, '') })}
                aria-label="Security PIN"
              />
            </div>
            <div className="dlg-warning">
              <AlertTriangle size={13} />
              <span>Lost PINs <strong>cannot be recovered</strong> from our side. If you've lost yours, that access is gone. No exceptions.</span>
            </div>
            <div className="dlg-actions">
              <button type="button" className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="dlg-solid-btn"><Check size={14} /> Unlock</button>
            </div>
          </form>
        )}

        {/* Create user */}
        {dialog.kind === 'user' && (
          <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <div className="dlg-field">
              <label htmlFor="dlg-username">Profile name</label>
              <input
                id="dlg-username"
                autoFocus
                className="dlg-input"
                value={dialog.value || ''}
                onChange={e => onChange({ ...dialog, value: e.target.value })}
                placeholder="e.g. Personal, Work, Ideas…"
                maxLength={80}
              />
            </div>
            <div className="dlg-field">
              <label>Visibility</label>
              <div className="dlg-toggle-group">
                <button
                  type="button"
                  className={`dlg-toggle-btn ${!dialog.isPublic ? 'active' : ''}`}
                  onClick={() => onChange({ ...dialog, isPublic: false })}
                >
                  🔒 Private
                </button>
                <button
                  type="button"
                  className={`dlg-toggle-btn ${dialog.isPublic ? 'active' : ''}`}
                  onClick={() => onChange({ ...dialog, isPublic: true })}
                >
                  🌐 Public
                </button>
              </div>
            </div>
            {!dialog.isPublic && (
              <>
                <div className="dlg-field">
                  <label htmlFor="dlg-pin">Security PIN <span className="dlg-optional">(4 or 6 digits)</span></label>
                  <input
                    id="dlg-pin"
                    className="dlg-input dlg-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}|\d{6}"
                    maxLength={6}
                    value={dialog.pin || ''}
                    onChange={e => onChange({ ...dialog, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="4 or 6 digit PIN"
                    aria-label="Security PIN"
                  />
                </div>
                <div className="dlg-pin-warning">
                  <Lock size={13} />
                  <div>
                    <strong>⚠️ Read this before setting a PIN!</strong>
                    <p>Your PIN is hashed and stored locally. We have <strong>zero</strong> ability to recover it if you forget it. It's gone. Like, really gone. No password reset, no "forgot PIN", no calling support. Write it down. Tattoo it on your wrist. Send yourself a message. Just don't lose it.</p>
                    <p>You can also <strong>download your .ntid key file</strong> after creating your profile — this lets you log in from any device without typing your PIN. Keep that file safe too.</p>
                  </div>
                </div>
              </>
            )}
            {dialog.isPublic && (
              <p className="dlg-copy">Public profiles can be viewed and edited by anyone on this workspace. No PIN needed.</p>
            )}
            <div className="dlg-actions">
              <button type="button" className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="dlg-solid-btn"><Check size={14} /> Create profile</button>
            </div>
          </form>
        )}

        {/* Set PIN */}
        {dialog.kind === 'set-pin' && (
          <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <div className="dlg-field">
              <label htmlFor="dlg-set-pin">New PIN <span className="dlg-optional">(4 or 6 digits)</span></label>
              <input
                id="dlg-set-pin"
                autoFocus
                className="dlg-input dlg-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}|\d{6}"
                maxLength={6}
                value={dialog.pin || ''}
                onChange={e => onChange({ ...dialog, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="4 or 6 digit PIN"
                aria-label="New security PIN"
              />
            </div>
            <div className="dlg-pin-warning">
              <AlertTriangle size={13} />
              <div>
                <p>Lost PINs <strong>cannot be recovered</strong> from our side. Keep it somewhere safe, or download your .ntid identity file after saving.</p>
              </div>
            </div>
            <div className="dlg-actions">
              <button type="button" className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="dlg-solid-btn"><Check size={14} /> Save PIN</button>
            </div>
          </form>
        )}

        {/* Folder/Page/Rename dialogs */}
        {['folder', 'page', 'rename-user', 'rename-folder', 'rename-page'].includes(dialog.kind) && (
          <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <div className="dlg-field">
              <label htmlFor="dlg-name">
                {dialog.kind === 'folder' ? 'Folder name' : dialog.kind === 'page' ? 'Page title' : 'New name'}
              </label>
              <input
                id="dlg-name"
                autoFocus
                className="dlg-input"
                value={dialog.value || ''}
                onChange={e => onChange({ ...dialog, value: e.target.value })}
                placeholder={
                  dialog.kind === 'folder' ? 'e.g. College, Work, Projects…' :
                  dialog.kind === 'page' ? 'e.g. Meeting notes, Ideas…' : 'Enter a name'
                }
                maxLength={80}
              />
            </div>
            {dialog.kind === 'page' && (
              <p className="dlg-copy">You can always rename it later. Start with anything.</p>
            )}
            <div className="dlg-actions">
              <button type="button" className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="dlg-solid-btn"><Check size={14} /> Save</button>
            </div>
          </form>
        )}

        {/* Delete page/folder */}
        {['delete-page', 'delete-folder'].includes(dialog.kind) && (
          <>
            <p className="dlg-copy">
              {dialog.kind === 'delete-page'
                ? 'This page and all its content will be permanently deleted. This cannot be undone.'
                : 'This folder and every page inside it will be permanently deleted. This cannot be undone.'}
            </p>
            <div className="dlg-actions">
              <button className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button className="dlg-solid-btn dlg-danger-btn" onClick={onSubmit}><Trash2 size={14} /> Delete</button>
            </div>
          </>
        )}

        {/* Delete user */}
        {dialog.kind === 'delete-user' && (
          <form onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <p className="dlg-copy">This profile and all its folders and notes will be <strong>permanently deleted</strong>. Enter your security PIN to confirm.</p>
            <div className="dlg-field">
              <label htmlFor="dlg-del-pin">Security PIN</label>
              <input
                id="dlg-del-pin"
                autoFocus
                className="dlg-input dlg-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={dialog.pin || ''}
                onChange={e => onChange({ ...dialog, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="Enter your PIN to confirm"
                aria-label="Confirm with security PIN"
              />
            </div>
            <div className="dlg-actions">
              <button type="button" className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="dlg-solid-btn dlg-danger-btn"><Trash2 size={14} /> Delete profile</button>
            </div>
          </form>
        )}

        {/* User menu */}
        {dialog.kind === 'user-menu' && (
          <div className="dlg-menu">
            <button onClick={() => { const u = data.users.find(u => u.id === dialog.value); onChange({ kind: 'rename-user', value: u?.name || '' }) }}>
              <Pencil size={15} /> Rename profile
            </button>
            <button onClick={() => onChange({ kind: 'set-pin', value: dialog.value })}>
              <Lock size={15} /> Set or change PIN
            </button>
            <button onClick={() => onChange({ kind: 'toggle-visibility', value: dialog.value })}>
              {data.users.find(u => u.id === dialog.value)?.isPublic ? '🔒 Make private' : '🌐 Make public'}
            </button>
            <button className="dlg-danger-text" onClick={() => onChange({ kind: 'delete-user', value: dialog.value })}>
              <Trash2 size={15} /> Delete profile
            </button>
          </div>
        )}

        {/* Folder menu */}
        {dialog.kind === 'folder-menu' && (
          <div className="dlg-menu">
            <button onClick={() => {
              const allFolders = data.users.flatMap(u => u.folders)
              const f = allFolders.find(f => f.id === dialog.value)
              onChange({ kind: 'rename-folder', value: f?.name || '' })
            }}>
              <Pencil size={15} /> Rename folder
            </button>
            <button className="dlg-danger-text" onClick={() => onChange({ kind: 'delete-folder' })}>
              <Trash2 size={15} /> Delete folder
            </button>
          </div>
        )}

        {/* Toggle visibility */}
        {dialog.kind === 'toggle-visibility' && (
          <>
            <p className="dlg-copy">
              {data.users.find(u => u.id === dialog.value)?.isPublic
                ? 'Making this profile private will require a PIN to access it. Are you sure?'
                : 'Making this profile public removes PIN protection. Anyone on this workspace can view and edit it.'}
            </p>
            <div className="dlg-actions">
              <button className="dlg-outline-btn" onClick={onClose}>Cancel</button>
              <button className="dlg-solid-btn" onClick={onSubmit}><Check size={14} /> Confirm</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
