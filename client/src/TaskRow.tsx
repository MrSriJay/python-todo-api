import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react"
import { ApiError } from "./api"
import { noteColor } from "./colors"
import { NotePad, NoteText } from "./NotePad"
import { PenCross } from "./PenCross"
import type { Todo } from "./types"

type TaskRowProps = {
  todo: Todo
  index: number
  leaving: boolean
  onOpen: (todo: Todo) => void
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onSave: (id: number, title: string, description: string | null) => Promise<void>
  onError: (message: string) => void
}

export function TaskRow({
  todo,
  index,
  leaving,
  onOpen,
  onToggle,
  onDelete,
  onSave,
  onError,
}: TaskRowProps) {
  const noteRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description ?? "")
  const [saving, setSaving] = useState(false)
  const [moreAt, setMoreAt] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (todo.done) setEditing(false)
  }, [todo.done])

  useEffect(() => {
    if (!editing) {
      setTitle(todo.title)
      setDescription(todo.description ?? "")
    }
  }, [editing, todo.title, todo.description])

  useEffect(() => {
    const node = noteRef.current
    if (!node) {
      setMoreAt(null)
      return
    }
    const measure = () => {
      if (node.scrollHeight <= node.clientHeight + 1) {
        setMoreAt(null)
        return
      }
      const box = node.getBoundingClientRect()
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let lastWord: { left: number; top: number } | null = null
      let word: { left: number; top: number } | null = null
      let textNode = walker.nextNode()
      while (textNode) {
        const parent = textNode.parentElement
        if (parent?.closest(".sticky-more")) {
          textNode = walker.nextNode()
          continue
        }
        const text = textNode.textContent ?? ""
        for (let index = 0; index < text.length; index += 1) {
          const character = text[index]
          if (character.trim() === "") {
            if (word) lastWord = word
            word = null
            continue
          }
          const range = document.createRange()
          range.setStart(textNode, index)
          range.setEnd(textNode, index + 1)
          const rect = range.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) continue
          if (rect.bottom > box.bottom + 1) {
            if (word && index === 0) lastWord = word
            word = null
            textNode = null
            break
          }
          word = { left: rect.right - box.left, top: rect.top - box.top }
        }
        if (!textNode) break
        textNode = walker.nextNode()
      }
      const spot = lastWord ?? word
      if (!spot) {
        setMoreAt(null)
        return
      }
      setMoreAt({
        left: Math.min(Math.max(spot.left + 1, 0), box.width - 28),
        top: spot.top,
      })
    }
    measure()
    void document.fonts.ready.then(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [todo.description, editing])

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

  const tone = noteColor(todo.color)

  return (
    <li
      className={`sticky tone-${tone}${todo.done ? " is-done" : ""}${leaving ? " is-leaving" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="sticky-bar">
        <button
          type="button"
          className={`done-toggle${todo.done ? " is-on" : ""}`}
          role="checkbox"
          aria-checked={todo.done}
          aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(todo)
          }}
        >
          <span className={`check${todo.done ? " is-on" : ""}`} aria-hidden="true">
            <Check size={15} strokeWidth={3} />
          </span>
          Done
        </button>
        {editing ? null : (
          <div className="row-actions">
            {todo.done ? null : (
              <button
                type="button"
                className="icon-button"
                onClick={(event) => {
                  event.stopPropagation()
                  setEditing(true)
                }}
                aria-label="Edit"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-button danger"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(todo)
              }}
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {todo.done ? <PenCross className="sticky-cross" /> : null}

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
        <>
          <button type="button" className="sticky-open" onClick={() => onOpen(todo)}>
            <p className="sticky-title">{todo.title}</p>
            {todo.description ? (
              <div ref={noteRef} className="sticky-note">
                <NoteText value={todo.description} />
                {moreAt === null ? null : (
                  <span className="sticky-more" style={{ left: moreAt.left, top: moreAt.top }}>
                    ...
                  </span>
                )}
              </div>
            ) : null}
          </button>
        </>
      )}
    </li>
  )
}
