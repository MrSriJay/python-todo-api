import { useEffect, useState } from "react"
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react"
import { ApiError } from "./api"
import { NotePad, NoteText } from "./NotePad"
import type { Todo } from "./types"

type TaskRowProps = {
  todo: Todo
  index: number
  leaving: boolean
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onSave: (id: number, title: string, description: string | null) => Promise<void>
  onError: (message: string) => void
}

export function TaskRow({
  todo,
  index,
  leaving,
  onToggle,
  onDelete,
  onSave,
  onError,
}: TaskRowProps) {
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
    <li
      className={`task${todo.done ? " is-done" : ""}${leaving ? " is-leaving" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <button
        type="button"
        className={`check${todo.done ? " is-on" : ""}`}
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
        onClick={() => onToggle(todo)}
      >
        <Check size={15} strokeWidth={3} />
      </button>

      {editing ? (
        <div className="edit">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            aria-label="Title"
          />
          <NotePad
            value={description}
            onChange={setDescription}
            label="Description"
            placeholder="Optional note. Bold a word, or start a list."
          />
          <div className="row-actions">
            <button type="button" className="primary" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              {saving ? "Saving" : "Save"}
            </button>
            <button type="button" className="ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="task-body">
          <p className="task-title">{todo.title}</p>
          {todo.description ? (
            <div className="task-description">
              <NoteText value={todo.description} />
            </div>
          ) : null}
        </div>
      )}

      {editing ? null : (
        <div className="row-actions">
          <button type="button" className="icon-button" onClick={() => setEditing(true)}>
            <Pencil size={16} />
            <span>Edit</span>
          </button>
          <button type="button" className="icon-button danger" onClick={() => onDelete(todo)}>
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </li>
  )
}
