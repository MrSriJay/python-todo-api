import { useEffect, useState, type FormEvent } from "react"
import {
  ApiError,
  createTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  updateTodo,
} from "./api"
import { TaskRow } from "./TaskRow"
import type { Todo, TodoFilter, TodoSort } from "./types"

const filters: { id: TodoFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<TodoFilter>("all")
  const [sort, setSort] = useState<TodoSort>("newest")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [leavingIds, setLeavingIds] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    setRefreshing(true)
    listTodos(filter, sort)
      .then((result) => {
        if (cancelled) return
        setTodos(result.items)
        setTotal(result.total)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError, "Could not load tasks."))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [filter, sort])

  async function reload() {
    const result = await listTodos(filter, sort)
    setTodos(result.items)
    setTotal(result.total)
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    const nextDescription = description.trim()
    if (!nextTitle) {
      setError("Title must not be empty or whitespace.")
      return
    }

    const tempId = -Date.now()
    const optimistic: Todo = {
      id: tempId,
      title: nextTitle,
      description: nextDescription || null,
      done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setError(null)
    setCreating(true)
    setTitle("")
    setDescription("")
    if (filter !== "done") {
      setTodos((current) =>
        sort === "oldest" ? [...current, optimistic] : [optimistic, ...current],
      )
      setTotal((current) => current + 1)
    }

    try {
      const created = await createTodo(nextTitle, nextDescription || null)
      setTodos((current) => current.map((item) => (item.id === tempId ? created : item)))
    } catch (createError: unknown) {
      setTodos((current) => current.filter((item) => item.id !== tempId))
      setTotal((current) => Math.max(0, current - (filter === "done" ? 0 : 1)))
      setTitle(nextTitle)
      setDescription(nextDescription)
      setError(errorMessage(createError, "Could not add the task."))
    } finally {
      setCreating(false)
    }
  }

  async function onToggle(todo: Todo) {
    const nextDone = !todo.done
    setError(null)
    setTodos((current) =>
      current.flatMap((item) => {
        if (item.id !== todo.id) return [item]
        if (filter === "open" && nextDone) return []
        if (filter === "done" && !nextDone) return []
        return [{ ...item, done: nextDone }]
      }),
    )
    try {
      const updated = await toggleTodo(todo.id)
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (toggleError: unknown) {
      setError(errorMessage(toggleError, "Could not update the task."))
      try {
        await reload()
      } catch {
        setTodos((current) => [todo, ...current.filter((item) => item.id !== todo.id)])
      }
    }
  }

  async function onSave(id: number, nextTitle: string, nextDescription: string | null) {
    let snapshot: Todo | undefined
    setTodos((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        snapshot = item
        return { ...item, title: nextTitle, description: nextDescription }
      }),
    )
    try {
      const updated = await updateTodo(id, nextTitle, nextDescription)
      setTodos((current) => current.map((item) => (item.id === id ? updated : item)))
      setError(null)
    } catch (saveError: unknown) {
      if (snapshot) {
        const saved = snapshot
        setTodos((current) => current.map((item) => (item.id === id ? saved : item)))
      }
      throw saveError
    }
  }

  async function onDelete(todo: Todo) {
    setLeavingIds((current) => [...current, todo.id])
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    setTodos((current) => current.filter((item) => item.id !== todo.id))
    setTotal((current) => Math.max(0, current - 1))
    setLeavingIds((current) => current.filter((id) => id !== todo.id))
    try {
      await deleteTodo(todo.id)
      setError(null)
    } catch (deleteError: unknown) {
      setError(errorMessage(deleteError, "Could not delete the task."))
      try {
        await reload()
      } catch {
        setTodos((current) => [todo, ...current])
        setTotal((current) => current + 1)
      }
    }
  }

  const countLabel = total === 1 ? "1 task" : `${total} tasks`

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">TODO</p>
        <h1>Tasks</h1>
        <p className="lede">A single shared list. Add a task, edit it, check it off, or remove it.</p>
      </header>

      <form className="composer" onSubmit={(event) => void onCreate(event)}>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="What needs doing?"
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Optional note"
          />
        </label>
        <button type="submit" disabled={creating}>
          {creating ? "Adding…" : "Add task"}
        </button>
      </form>

      {error ? (
        <p className="banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter tasks">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === filter ? "is-selected" : ""}
              aria-pressed={item.id === filter}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="sort">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as TodoSort)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
          </select>
        </label>
        <p className="count">{loading ? "Loading…" : countLabel}</p>
      </div>

      {loading ? (
        <p className="status">Loading tasks…</p>
      ) : todos.length === 0 ? (
        <p className="status">No tasks in this view.</p>
      ) : (
        <ul className={`tasks${refreshing ? " is-refreshing" : ""}`}>
          {todos.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              leaving={leavingIds.includes(todo.id)}
              onToggle={(item) => void onToggle(item)}
              onDelete={(item) => void onDelete(item)}
              onSave={onSave}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
