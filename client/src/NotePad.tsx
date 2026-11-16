import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react"
import { isBlankNote, plainText, sanitizeHtml, toEditorHtml } from "./note"

const MAX_NOTE = 2000

const tools = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "strikeThrough", icon: Strikethrough, label: "Strikethrough" },
  { command: "insertUnorderedList", icon: List, label: "Bullet list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { command: "removeFormat", icon: RemoveFormatting, label: "Clear formatting" },
] as const

type ToolCommand = (typeof tools)[number]["command"]

type NotePadProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
}

function selectionInside(editor: HTMLElement): boolean {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return false
  const node = selection.anchorNode
  return node ? editor.contains(node) : false
}

export function NotePad({ value, onChange, placeholder, label }: NotePadProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValue = useRef(value)
  const seeded = useRef(false)
  const [active, setActive] = useState<Partial<Record<ToolCommand, boolean>>>({})

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (!seeded.current) {
      editor.innerHTML = toEditorHtml(value)
      lastValue.current = value
      seeded.current = true
      return
    }
    if (value === lastValue.current) return
    editor.innerHTML = toEditorHtml(value)
    lastValue.current = value
  }, [value])

  useEffect(() => {
    function refresh() {
      const editor = editorRef.current
      if (!editor || !selectionInside(editor)) {
        setActive({})
        return
      }
      const next: Partial<Record<ToolCommand, boolean>> = {}
      for (const tool of tools) {
        if (tool.command === "removeFormat") continue
        try {
          next[tool.command] = document.queryCommandState(tool.command)
        } catch {
          next[tool.command] = false
        }
      }
      setActive(next)
    }
    document.addEventListener("selectionchange", refresh)
    return () => document.removeEventListener("selectionchange", refresh)
  }, [])

  function publish() {
    const editor = editorRef.current
    if (!editor) return
    const clean = sanitizeHtml(editor.innerHTML)
    const stored = plainText(clean) ? clean : ""
    if (stored.length > MAX_NOTE) {
      editor.innerHTML = toEditorHtml(lastValue.current)
      return
    }
    if (stored === lastValue.current) return
    lastValue.current = stored
    onChange(stored)
  }

  function apply(command: ToolCommand) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false)
    publish()
  }

  const empty = isBlankNote(value)

  return (
    <div className="notepad">
      <div className="note-tools" role="toolbar" aria-label={`${label} formatting`}>
        {tools.map((tool) => {
          const Icon = tool.icon
          const pressed = Boolean(active[tool.command])
          return (
            <button
              key={tool.command}
              type="button"
              className={pressed ? "is-active" : ""}
              aria-label={tool.label}
              aria-pressed={tool.command === "removeFormat" ? undefined : pressed}
              title={tool.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => apply(tool.command)}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>
      <div
        ref={editorRef}
        className={`note-editor${empty ? " is-empty" : ""}`}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder ?? ""}
        onInput={publish}
        onPaste={(event) => {
          event.preventDefault()
          const text = event.clipboardData.getData("text/plain")
          document.execCommand("insertText", false, text)
          publish()
        }}
      />
      <p className="note-count">
        {value.length}/{MAX_NOTE}
      </p>
    </div>
  )
}

function renderNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (!(node instanceof HTMLElement)) return null
  const children = [...node.childNodes].map((child, index) => renderNode(child, index))
  if (node.tagName === "BR") return <br key={key} />
  if (node.tagName === "STRONG" || node.tagName === "B") return <strong key={key}>{children}</strong>
  if (node.tagName === "EM" || node.tagName === "I") return <em key={key}>{children}</em>
  if (node.tagName === "U") return <u key={key}>{children}</u>
  if (node.tagName === "S") return <s key={key}>{children}</s>
  if (node.tagName === "UL") return <ul key={key}>{children}</ul>
  if (node.tagName === "OL") return <ol key={key}>{children}</ol>
  if (node.tagName === "LI") return <li key={key}>{children}</li>
  if (node.tagName === "DIV") return <div key={key}>{children}</div>
  return <span key={key}>{children}</span>
}

export function NoteText({ value }: { value: string }) {
  if (!/<(strong|em|u|s|ul|ol|li|br|div)\b/i.test(value)) {
    return <div className="note note-plain">{value}</div>
  }
  const html = toEditorHtml(value)
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild
  if (!root) return null
  return (
    <div className="note">
      {[...root.childNodes].map((node, index) => renderNode(node, index))}
    </div>
  )
}
