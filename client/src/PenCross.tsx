type PenCrossProps = {
  className: string
}

export function PenCross({ className }: PenCrossProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0 C 22 28, 78 72, 100 100" />
      <path d="M100 0 C 78 28, 22 72, 0 100" />
    </svg>
  )
}
