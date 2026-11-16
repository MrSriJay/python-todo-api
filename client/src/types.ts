export type NoteColor = "sun" | "sky" | "blush" | "peach" | "leaf"

export type Todo = {
  id: number
  title: string
  description: string | null
  color: NoteColor
  done: boolean
  created_at: string
  updated_at: string
}

export type AuthUser = {
  id: number
  name: string
  email: string
}

export type TodoFilter = "all" | "open" | "done"
export type TodoSort = "newest" | "oldest" | "title"
