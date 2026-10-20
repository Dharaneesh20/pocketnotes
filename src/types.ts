export type Page = { id: string; title: string; content: string; updatedAt: number }
export type Folder = { id: string; name: string; pages: Page[] }
export type User = { id: string; name: string; pinHash?: string; folders: Folder[] }
export type Notebook = { version: 1; users: User[]; updatedAt: number }
export const newId = () => crypto.randomUUID()
export const starterNotebook = (): Notebook => ({
  version: 1, updatedAt: Date.now(),
  users: [{ id: newId(), name: 'Personal', folders: [{ id: newId(), name: 'Quick notes', pages: [{ id: newId(), title: 'Welcome', content: 'Your notes live here.\\n\\nCreate a page, paste anything, and it will save automatically.\\n\\nShare this workspace URL with yourself on another device to open the same notebook.', updatedAt: Date.now() }] }] }]
})