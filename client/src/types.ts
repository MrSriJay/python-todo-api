export type Todo = {
  id: number
  title: string
  description: string | null
  done: boolean
  created_at: string
  updated_at: string
}

export type TodoFilter = "all" | "open" | "done"
export type TodoSort = "newest" | "oldest" | "title"
