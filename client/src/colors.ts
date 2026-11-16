import type { NoteColor } from "./types"

export const noteColors: { id: NoteColor; label: string }[] = [
  { id: "sun", label: "Yellow" },
  { id: "sky", label: "Blue" },
  { id: "blush", label: "Pink" },
  { id: "peach", label: "Orange" },
  { id: "leaf", label: "Green" },
]

export function noteColor(value: string | null | undefined): NoteColor {
  return noteColors.some((item) => item.id === value) ? (value as NoteColor) : "sun"
}
