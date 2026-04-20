"use client"

import { cn } from "@/lib/utils"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  readOnly?: boolean
}

/**
 * Minimal monospace code editor with a line-numbered gutter. Fills its
 * flex parent vertically and scrolls the gutter + textarea together so
 * the whole widget stays within its container instead of pushing the
 * page layout taller than the viewport.
 */
export function SourceEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  readOnly,
}: Props) {
  const lines = Math.max(value.split("\n").length, 1)
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 overflow-auto rounded border bg-background",
        "font-mono text-xs"
      )}
    >
      <div
        aria-hidden
        className="shrink-0 bg-muted/40 py-2 pr-2 pl-2 text-right text-muted-foreground tabular-nums select-none"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        aria-label={ariaLabel}
        spellCheck={false}
        readOnly={readOnly}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={lines}
        className={cn(
          "min-w-0 flex-1 resize-none bg-transparent px-2 py-2 leading-5",
          "outline-none focus-visible:outline-none",
          "overflow-hidden text-foreground",
          readOnly && "cursor-default"
        )}
      />
    </div>
  )
}
