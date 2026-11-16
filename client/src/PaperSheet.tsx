import { useEffect, useState } from "react"
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react"
import { ApiError } from "./api"
import { noteColor } from "./colors"
import { createdOn } from "./dates"
import { ColorSwatches } from "./ColorSwatches"
import { NotePad, NoteText } from "./NotePad"
import { PenCross } from "./PenCross"
import type { NoteColor, Todo } from "./types"

type PaperSheetProps = {
  todo: Todo
  onClose: () => void
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onSave: (id: number, title: string, description: string | null) => Promise<void>
  onColor: (todo: Todo, color: NoteColor) => void
  onError: (message: string) => void
}

export function PaperSheet({
  todo,
  onClose,
  onToggle,
  onDelete,
  onSave,
  onColor,
  onError,
}: PaperSheetProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description ?? "")
  const [saving, setSaving] = useState(false)
  const color = noteColor(todo.color)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (todo.done) setEditing(false)
  }, [todo.done])

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
    <div className="paper-backdrop" onClick={onClose}>
      <article
        className={`paper tone-${color}${todo.done ? " is-done" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={todo.title}
        onClick={(event) => event.stopPropagation()}
      >
        {todo.done ? <PenCross className="paper-cross" /> : null}
        <div className="paper-bar">
          <button
            type="button"
            className={`done-toggle${todo.done ? " is-on" : ""}`}
            role="checkbox"
            aria-checked={todo.done}
            aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
            onClick={() => onToggle(todo)}
          >
            <span className={`check${todo.done ? " is-on" : ""}`} aria-hidden="true">
              <Check size={15} strokeWidth={3} />
            </span>
            Done
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

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
            <time className="paper-date" dateTime={todo.created_at}>
              {createdOn(todo.created_at)}
            </time>
            <div className="row-actions">
              <button type="button" className="primary" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                {saving ? "Saving" : "Save"}
              </button>
              <button type="button" className="ghost" onClick={() => setEditing(false)} disabled={saving}>
                <X size={16} />
                Cancel
              </button>
              <ColorSwatches value={color} onChange={(next) => onColor(todo, next)} />
            </div>
          </div>
        ) : (
          <>
            <div className="paper-scroll">
              <h3 className="paper-title">{todo.title}</h3>
              {todo.description ? (
                <div className="paper-body">
                  <NoteText value={todo.description} />
                </div>
              ) : (
                <p className="paper-empty">No note yet.</p>
              )}
            </div>
            <time className="paper-date" dateTime={todo.created_at}>
              {createdOn(todo.created_at)}
            </time>
            <div className="paper-actions">
              {todo.done ? null : (
                <button type="button" className="ghost" onClick={() => setEditing(true)}>
                  <Pencil size={16} />
                  Edit
                </button>
              )}
              <button
                type="button"
                className="ghost danger"
                onClick={() => {
                  onClose()
                  onDelete(todo)
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
              {todo.done ? null : (
                <ColorSwatches value={color} onChange={(next) => onColor(todo, next)} />
              )}
            </div>
          </>
        )}
      </article>
    </div>
  )
}
