import React, { useRef } from 'react'
import {
  Sun, Moon, ArrowRight, Upload, Zap, FolderOpen, Users,
  Globe, CheckCircle, Lock, Key, AlertTriangle, ShieldCheck
} from 'lucide-react'
import type { Notebook } from './types'

interface LandingPageProps {
  data: Notebook
  theme: string
  themeMode: 'light' | 'dark'
  onSetTheme: (theme: string) => void
  toggleTheme: () => void
  onNavigateToUsers: () => void
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

export function LandingPage({
  data,
  theme,
  themeMode,
  onSetTheme,
  toggleTheme,
  onNavigateToUsers,
  onCreateUser,
  onImport
}: LandingPageProps) {
  const isDark = themeMode === 'dark'
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className={`landing theme-${theme} ${isDark ? 'dark' : ''}`}>
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-brand" onClick={onNavigateToUsers} style={{ cursor: 'pointer' }}>
            <div className="brand-sq">n.</div>
            <span className="brand-name">Note Packet</span>
          </div>

          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#security">Security & Key</a>
            <button className="nav-link-btn" onClick={onNavigateToUsers}>See Users</button>
          </div>

          <div className="nav-right">
            {/* Theme switcher */}
            <select
              className="landing-theme-select"
              value={theme}
              onChange={e => onSetTheme(e.target.value)}
              aria-label="Theme selector"
            >
              {THEME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button className="icon-pill" onClick={toggleTheme} aria-label="Toggle light/dark mode">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button className="nav-cta" onClick={onNavigateToUsers}>
              See Users <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-eyebrow">YOUR IDEAS, FINALLY IN ONE PLACE</div>
          <h1 className="hero-headline">
            Every <em>good idea</em><br />deserves a place.
          </h1>
          <p className="hero-sub">
            Capture your thoughts, organize them into folders, and switch between rich themes like Claude, ChatGPT, and Cyberpunk.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onNavigateToUsers}>
              See Users <ArrowRight size={16} />
            </button>
            <button className="btn-secondary" onClick={onCreateUser}>
              Create a new space
            </button>
          </div>
          <div className="hero-trust">
            <span><CheckCircle size={13} /> 6 Custom visual themes</span>
            <span><CheckCircle size={13} /> Markdown + Mermaid</span>
            <span><CheckCircle size={13} /> .ntid identity keys</span>
            <span><CheckCircle size={13} /> PIN-protected privacy</span>
          </div>
        </div>

        <div className="hero-preview" aria-hidden="true">
          <div className="preview-window">
            <div className="preview-titlebar">
              <span className="tb-dot red" /><span className="tb-dot yellow" /><span className="tb-dot green" />
              <div className="preview-url">notepacket.app</div>
            </div>
            <div className="preview-body">
              <div className="preview-sidebar">
                <div className="preview-logo"><div className="brand-sq sm">n.</div><span>Note Packet</span></div>
                <div className="preview-section-label">FOLDERS</div>
                <div className="preview-folder active"><FolderOpen size={11} /> Quick notes <span className="preview-count">3</span></div>
                <div className="preview-folder"><FolderOpen size={11} /> Project Alpha <span className="preview-count">7</span></div>
                <div className="preview-folder"><FolderOpen size={11} /> Reading list <span className="preview-count">2</span></div>
                <div className="preview-folder"><FolderOpen size={11} /> Ideas vault <span className="preview-count">5</span></div>
              </div>
              <div className="preview-notes">
                <div className="preview-note-card active">
                  <strong>Welcome to Note Packet</strong>
                  <p>Your notes live here. Create a page, paste anything…</p>
                  <small>Just now</small>
                </div>
                <div className="preview-note-card">
                  <strong>Meeting notes — Oct 21</strong>
                  <p>Action items: review design, update API…</p>
                  <small>2 hours ago</small>
                </div>
                <div className="preview-note-card">
                  <strong>Book recommendations</strong>
                  <p>Atomic Habits, Deep Work…</p>
                  <small>Yesterday</small>
                </div>
              </div>
              <div className="preview-editor">
                <div className="preview-note-title">Welcome to Note Packet</div>
                <div className="preview-note-content">
                  <div className="preview-h2">## Getting started</div>
                  <div className="preview-p">Paste Markdown, code snippets, or Mermaid charts. Pick Claude, ChatGPT, or Cyberpunk theme!</div>
                  <div className="preview-code"><code>const theme = 'cyberpunk';</code></div>
                </div>
                <div className="preview-sticky-accent">💡 Autosaved</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-eyebrow">WHAT YOU GET</div>
          <h2 className="section-title">Built for how you actually think</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><Zap size={22} /></div>
              <h3>Instant capture</h3>
              <p>No loading bars, no wait. Open a note, type, and watch it save automatically as you compose.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><FolderOpen size={22} /></div>
              <h3>Nested folder tree</h3>
              <p>Keep your thoughts organized with tree navigation, collapsible folders, and live note counters.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Users size={22} /></div>
              <h3>Isolated user profiles</h3>
              <p>Create separate public or private spaces for work, personal ideas, and side projects on a separate user page.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Globe size={22} /></div>
              <h3>Work across devices</h3>
              <p>Take your notes with you. Share workspaces or drop your .ntid identity key on another browser to open instantly.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-container">
          <div className="section-eyebrow">HOW IT WORKS</div>
          <h2 className="section-title">Three steps from chaos to clarity</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Choose your profile</h3>
              <p>Head to the dedicated user page, pick your profile or create a fresh one with an optional PIN.</p>
            </div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Create folders & pages</h3>
              <p>Organize your knowledge however your brain works. Add folders, sub-notes, and markdown tags.</p>
            </div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Write, flow, and export</h3>
              <p>Live Markdown preview, automatic diagrams with Mermaid, PDF export, and .ntid key backups.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & .ntid key spotlight */}
      <section className="security-section" id="security">
        <div className="section-container">
          <div className="security-grid">
            <div className="security-copy">
              <div className="section-eyebrow">SECURITY & PORTABILITY</div>
              <h2 className="section-title">Your notes, locked with your personal key</h2>
              <p className="security-lead">
                Unlike corporate note apps with passwords, Note Packet gives you sovereign control. Set a PIN or download your <strong>.ntid</strong> identity key file.
              </p>
              <div className="security-points">
                <div className="sec-point">
                  <div className="sec-point-icon"><Lock size={16} /></div>
                  <div>
                    <strong>Optional 4-6 digit safety PIN</strong>
                    <p>Keep personal notes private from other people using the same public workspace.</p>
                  </div>
                </div>
                <div className="sec-point">
                  <div className="sec-point-icon"><Key size={16} /></div>
                  <div>
                    <strong>Portable .ntid identity file</strong>
                    <p>Export your identity key. Drag-and-drop it onto any browser to instantly sign in without typing your PIN.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="security-card-visual">
              <div className="id-card">
                <div className="id-card-top">
                  <div className="brand-sq sm">n.</div>
                  <span>Identity Key File (.ntid)</span>
                </div>
                <div className="id-card-body">
                  <div className="id-card-chip" />
                  <div className="id-card-key-icon"><ShieldCheck size={38} /></div>
                  <div className="id-card-user">User Profile Key</div>
                  <div className="id-card-filename">📎 your-profile.ntid</div>
                  <p className="id-card-desc">
                    Your .ntid file is your digital passport — drag it into the User Page on any device and your workspace unlocks instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated Call to Action to visit Users Page */}
      <section className="final-cta">
        <div className="section-container">
          <div className="cta-box">
            <h2>Ready to see your workspaces?</h2>
            <p>Visit the dedicated Users Page to find your profile, create a new one, or sign in with your .ntid key file.</p>
            <div className="cta-buttons">
              <button className="btn-primary large" onClick={onNavigateToUsers}>
                See Users & Profiles <ArrowRight size={18} />
              </button>
              <button className="btn-secondary large" onClick={onCreateUser}>
                Add New Profile
              </button>
            </div>

            {/* Quick .ntid import shortcut */}
            <div className="landing-quick-import">
              <span>Have a .ntid file?</span>
              <button className="landing-import-link" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Import key directly
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ntid,.ntpkt,application/vnd.notepacket+json,.json"
                hidden
                onChange={e => onImport(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Sitemap Footer */}
      <footer className="landing-footer" id="sitemap">
        <div className="footer-container">
          <div className="footer-sitemap-grid">
            {/* Brand Column */}
            <div className="footer-col footer-col-brand">
              <div className="footer-brand" onClick={onNavigateToUsers} style={{ cursor: 'pointer' }}>
                <div className="brand-sq">n.</div>
                <span className="brand-name">Note Packet</span>
              </div>
              <p className="footer-tagline">
                A digital fridge for thoughts, folders, and diagrams. 100% sovereign client-side storage, live Markdown & Mermaid support.
              </p>
              <div className="footer-developer-credit">
                <span>Developed by</span>
                <a
                  href="https://github.com/Dharaneesh20"
                  target="_blank"
                  rel="noreferrer"
                  className="github-credit-link"
                  title="Visit Dharaneesh20 on GitHub"
                >
                  <svg className="github-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <strong>Dharaneesh20</strong>
                </a>
              </div>
            </div>

            {/* Sitemap Column 1: Product */}
            <div className="footer-col">
              <h4 className="footer-col-title">Product</h4>
              <ul className="footer-menu">
                <li><a href="#features">Core Features</a></li>
                <li><a href="#how">How It Works</a></li>
                <li><a href="#security">Security & .ntid</a></li>
                <li><a href="#how">Mermaid Flowcharts</a></li>
                <li><a href="#features">PDF Export & Backups</a></li>
              </ul>
            </div>

            {/* Sitemap Column 2: Workspaces */}
            <div className="footer-col">
              <h4 className="footer-col-title">Workspaces</h4>
              <ul className="footer-menu">
                <li><button className="footer-action-link" onClick={onNavigateToUsers}>All Profiles ({data.users.length})</button></li>
                <li><button className="footer-action-link" onClick={onCreateUser}>Create Fresh Profile</button></li>
                <li><button className="footer-action-link" onClick={() => fileRef.current?.click()}>Import .ntid Key File</button></li>
                <li><button className="footer-action-link" onClick={onNavigateToUsers}>Public Shared Spaces</button></li>
              </ul>
            </div>

            {/* Sitemap Column 3: Themes */}
            <div className="footer-col">
              <h4 className="footer-col-title">Themes & Palettes</h4>
              <ul className="footer-menu">
                <li><button className="footer-theme-link" onClick={() => onSetTheme('default')}>Default · Canary Yellow</button></li>
                <li><button className="footer-theme-link" onClick={() => onSetTheme('claude')}>Claude · Terracotta Serif</button></li>
                <li><button className="footer-theme-link" onClick={() => onSetTheme('chatgpt')}>ChatGPT · Emerald Modern</button></li>
                <li><button className="footer-theme-link" onClick={() => onSetTheme('cyberpunk')}>Cyberpunk · Neon Glow</button></li>
                <li><button className="footer-theme-link" onClick={() => onSetTheme('minimalist')}>Minimalist · Swiss Mono</button></li>
                <li><button className="footer-theme-link" onClick={() => onSetTheme('high-contrast')}>High Contrast · Accessible</button></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom-bar">
            <div className="footer-copyright">
              <span>© {new Date().getFullYear()} Note Packet · Sovereign Notes Platform</span>
            </div>
            <div className="footer-developer-badge">
              <span>Developed by</span>
              <a
                href="https://github.com/Dharaneesh20"
                target="_blank"
                rel="noreferrer"
                className="github-credit-link"
              >
                <svg className="github-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>Dharaneesh20</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
