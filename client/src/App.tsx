import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Inbox,
  ListTodo,
  Loader2,
  Moon,
  Plus,
  Rows3,
  Search,
  StickyNote,
  Sun,
  X,
} from "lucide-react"
import {
  ApiError,
  createTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  updateTodo,
} from "./api"
import { ColorSwatches } from "./ColorSwatches"
import { NotePad } from "./NotePad"
import { PaperSheet } from "./PaperSheet"
import { TaskRow } from "./TaskRow"
import type { NoteColor, Todo, TodoFilter, TodoSort } from "./types"

type View = "new" | "wall"
type Theme = "light" | "dark"

function initialTheme(): Theme {
  const saved = localStorage.getItem("theme")
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const filters: { id: TodoFilter; label: string; icon: typeof Rows3 }[] = [
  { id: "all", label: "All", icon: Rows3 },
  { id: "open", label: "Open", icon: Circle },
  { id: "done", label: "Done", icon: CheckCircle2 },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<TodoFilter>("all")
  const [sort, setSort] = useState<TodoSort>("newest")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState<NoteColor>("sun")
  const [openedId, setOpenedId] = useState<number | null>(null)
  const [pendingToggle, setPendingToggle] = useState<Todo | null>(null)
  const [creating, setCreating] = useState(false)
  const [leavingIds, setLeavingIds] = useState<number[]>([])
  const [view, setView] = useState<View>("new")
  const [panelMotion, setPanelMotion] = useState<"" | "in-left" | "in-right">("")
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  function showView(next: View) {
    if (next === view) return
    setPanelMotion(next === "wall" ? "in-right" : "in-left")
    setView(next)
  }

  useLayoutEffect(() => {
    const root = tabsRef.current
    if (!root) return
    const measure = () => {
      const selected = root.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!selected) return
      setIndicator({ left: selected.offsetLeft, width: selected.offsetWidth, ready: true })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [view])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("theme", theme)
  }, [theme])

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
      color,
      done: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setError(null)
    setCreating(true)
    setTitle("")
    setDescription("")
    setColor("sun")
    showView("wall")
    if (filter === "done") setFilter("all")
    if (filter !== "done") {
      setTodos((current) =>
        sort === "oldest" ? [...current, optimistic] : [optimistic, ...current],
      )
      setTotal((current) => current + 1)
    }

    try {
      const created = await createTodo(nextTitle, nextDescription || null, color)
      setTodos((current) => current.map((item) => (item.id === tempId ? created : item)))
    } catch (createError: unknown) {
      setTodos((current) => current.filter((item) => item.id !== tempId))
      setTotal((current) => Math.max(0, current - (filter === "done" ? 0 : 1)))
      setTitle(nextTitle)
      setDescription(nextDescription)
      setColor(color)
      showView("new")
      setError(errorMessage(createError, "Could not add the task."))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!pendingToggle) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.stopImmediatePropagation()
      setPendingToggle(null)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [pendingToggle])

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
      const updated = await updateTodo(id, { title: nextTitle, description: nextDescription })
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

  async function onColor(todo: Todo, nextColor: NoteColor) {
    let snapshot: Todo | undefined
    setTodos((current) =>
      current.map((item) => {
        if (item.id !== todo.id) return item
        snapshot = item
        return { ...item, color: nextColor }
      }),
    )
    try {
      const updated = await updateTodo(todo.id, { color: nextColor })
      setTodos((current) => current.map((item) => (item.id === todo.id ? updated : item)))
      setError(null)
    } catch (colorError: unknown) {
      if (snapshot) {
        const saved = snapshot
        setTodos((current) => current.map((item) => (item.id === todo.id ? saved : item)))
      }
      setError(errorMessage(colorError, "Could not change the color."))
    }
  }

  async function onDelete(todo: Todo) {
    if (openedId === todo.id) setOpenedId(null)
    setLeavingIds((current) => [...current, todo.id])
    await new Promise((resolve) => window.setTimeout(resolve, 280))
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

  const needle = query.trim().toLowerCase()
  const visibleTodos = needle
    ? todos.filter((todo) => {
        const description = (todo.description ?? "").replace(/<[^>]*>/g, " ")
        return `${todo.title} ${description}`.toLowerCase().includes(needle)
      })
    : todos
  const countLabel = needle
    ? `${visibleTodos.length} of ${total}`
    : total === 1
      ? "1 task"
      : `${total} tasks`
  const opened = todos.find((item) => item.id === openedId) ?? null

  return (
    <main className={`page${view === "wall" ? " is-wide" : ""}`}>
      <header className="masthead">
        <span className="mark" aria-hidden="true">
          <ListTodo size={22} />
        </span>
        <div>
          <p className="eyebrow">TODO</p>
          <h1>Tasks</h1>
          <p className="lede">Add a task, then see it on the sticky wall.</p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      <div className="views" role="tablist" aria-label="Task views" ref={tabsRef}>
        <span
          className={`view-indicator${indicator.ready ? " is-ready" : ""}`}
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
        <button
          type="button"
          role="tab"
          aria-selected={view === "new"}
          className={view === "new" ? "is-selected" : ""}
          onClick={() => showView("new")}
        >
          <Plus size={16} />
          New task
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "wall"}
          className={view === "wall" ? "is-selected" : ""}
          onClick={() => showView("wall")}
        >
          <StickyNote size={16} />
          Sticky wall
        </button>
      </div>

      {error ? (
        <p className="banner" role="alert">
          <CircleAlert size={18} />
          {error}
        </p>
      ) : null}

      <div key={view} className={`view-panel${panelMotion ? ` ${panelMotion}` : ""}`}>
      {view === "new" ? (
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
        <div className="field">
          <span>Description</span>
          <NotePad
            value={description}
            onChange={setDescription}
            label="Description"
            placeholder="Optional note. Bold a word, or start a list."
          />
        </div>
        <div className="field">
          <span>Color</span>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <button type="submit" className="primary" disabled={creating}>
          {creating ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
          {creating ? "Adding" : "Add task"}
        </button>
      </form>
      ) : (
      <section className="board" aria-label="Sticky wall">
        <h2>Sticky wall</h2>
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter tasks">
          {filters.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={item.id === filter ? "is-selected" : ""}
                aria-pressed={item.id === filter}
                onClick={() => setFilter(item.id)}
              >
                <Icon size={15} />
                {item.label}
              </button>
            )
          })}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </label>
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
        <p className="status">
          <Loader2 size={18} className="spin" />
          Loading tasks…
        </p>
      ) : (
        <ul key={filter} className={`wall${refreshing ? " is-refreshing" : ""}`}>
          {visibleTodos.length === 0 ? (
            <li className="empty">
              <Inbox size={28} />
              <p>{needle ? "No notes match that search." : "No tasks in this view."}</p>
            </li>
          ) : null}
          {visibleTodos.map((todo, index) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              index={index}
              leaving={leavingIds.includes(todo.id)}
              onOpen={(item) => setOpenedId(item.id)}
              onToggle={setPendingToggle}
              onDelete={(item) => void onDelete(item)}
              onSave={onSave}
              onError={setError}
            />
          ))}
          <li>
            <button type="button" className="sticky-add" onClick={() => showView("new")}>
              <Plus size={32} />
              <span>Add a task</span>
            </button>
          </li>
        </ul>
      )}
      </section>
      )}
      </div>
      {opened ? (
        <PaperSheet
          todo={opened}
          onClose={() => setOpenedId(null)}
          onToggle={setPendingToggle}
          onDelete={(item) => void onDelete(item)}
          onSave={onSave}
          onColor={(item, nextColor) => void onColor(item, nextColor)}
          onError={setError}
        />
      ) : null}
      {pendingToggle ? (
        <div className="confirm-backdrop" onClick={() => setPendingToggle(null)}>
          <div
            className="confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-title">
              {pendingToggle.done ? "Mark this note as not done?" : "Mark this note as done?"}
            </h2>
            <p>{pendingToggle.title}</p>
            <div className="confirm-actions">
              <button type="button" className="ghost" onClick={() => setPendingToggle(null)} autoFocus>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const todo = pendingToggle
                  setPendingToggle(null)
                  void onToggle(todo)
                }}
              >
                {pendingToggle.done ? "Mark open" : "Mark done"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
