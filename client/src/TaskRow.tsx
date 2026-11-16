import { useEffect, useState } from "react"
import { ApiError } from "./api"
import type { Todo } from "./types"

type TaskRowProps = {
  todo: Todo
  leaving: boolean
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onSave: (id: number, title: string, description: string | null) => Promise<void>
  onError: (message: string) => void
}

export function TaskRow({ todo, leaving, onToggle, onDelete, onSave, onError }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setTitle(todo.title)
      setDescription(todo.description ?? "")
    }
  }, [editing, todo.title, todo.description])

  async function save() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      onError("Title must not be empty or whitespace.")
      return
    }
    setSaving(true)
    try {
      await onSave(todo.id, nextTitle, description.trim() || null)
      setEditing(false)
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "Could not save the task.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`task${todo.done ? " is-done" : ""}${leaving ? " is-leaving" : ""}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo)}
          aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
        />
      </label>

      {editing ? (
        <div className="edit">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            aria-label="Title"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={2}
            aria-label="Description"
          />
          <div className="row-actions">
            <button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="task-body">
          <p className="task-title">{todo.title}</p>
          {todo.description ? <p className="task-description">{todo.description}</p> : null}
        </div>
      )}

      {editing ? null : (
        <div className="row-actions">
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="danger" onClick={() => onDelete(todo)}>
            Delete
          </button>
        </div>
      )}
    </li>
  )
}
