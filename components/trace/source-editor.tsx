"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  readOnly?: boolean
}

/**
 * Minimal monospace code editor with a line-numbered gutter. The textarea
 * owns its own scroll (both axes). The gutter's scrollTop is kept in sync
 * via an onScroll handler — no pixel arithmetic needed.
 */
export function SourceEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  readOnly,
}: Props) {
  const lines = Math.max(value.split("\n").length, 1)
  const gutterRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 overflow-hidden rounded border bg-background",
        "font-mono text-xs"
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="shrink-0 overflow-hidden bg-muted/40 py-2 pr-2 pl-2 text-right text-muted-foreground tabular-nums select-none"
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
        wrap="off"
        onScroll={(e) => {
          if (gutterRef.current)
            gutterRef.current.scrollTop = e.currentTarget.scrollTop
        }}
        className={cn(
          "min-w-0 flex-1 resize-none bg-transparent px-2 py-2 leading-5",
          "outline-none focus-visible:outline-none",
          "overflow-auto text-foreground",
          readOnly && "cursor-default"
        )}
      />
    </div>
  )
}
