import { noteColors } from "./colors"
import type { NoteColor } from "./types"

type ColorSwatchesProps = {
  value: NoteColor
  onChange: (color: NoteColor) => void
  label?: string
}

export function ColorSwatches({ value, onChange, label = "Note color" }: ColorSwatchesProps) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {noteColors.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={item.id === value}
          aria-label={item.label}
          title={item.label}
          className={`swatch tone-${item.id}${item.id === value ? " is-selected" : ""}`}
          onClick={() => onChange(item.id)}
        />
      ))}
    </div>
  )
}
