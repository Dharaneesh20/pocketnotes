export type Page = { id: string; title: string; content: string; updatedAt: number }
export type Folder = { id: string; name: string; pages: Page[] }
export type User = { id: string; name: string; pinHash?: string; isPublic?: boolean; folders: Folder[] }
export type Notebook = { version: 1; users: User[]; updatedAt: number }
export const newId = () => crypto.randomUUID()
export const starterNotebook = (): Notebook => ({
  version: 1, updatedAt: Date.now(),
  users: []
})