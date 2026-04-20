"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Val } from "@/lib/s/values"

interface Props {
  value: Val
  depth?: number
  autoCollapseAt?: number
}

/** Renders a constructor / integer value as an inline, collapsible tree. */
export function ValueView({ value, depth = 0, autoCollapseAt = 4 }: Props) {
  if (value.kind === "int") {
    return (
      <span className="text-sky-700 tabular-nums dark:text-sky-300">
        {value.n}
      </span>
    )
  }
  if (value.args.length === 0) {
    return (
      <span className="text-violet-700 dark:text-violet-300">
        {value.tag}
        <span className="text-muted-foreground">()</span>
      </span>
    )
  }
  return (
    <CtorValue value={value} depth={depth} autoCollapseAt={autoCollapseAt} />
  )
}

function CtorValue({
  value,
  depth,
  autoCollapseAt,
}: {
  value: Extract<Val, { kind: "ctor" }>
  depth: number
  autoCollapseAt: number
}) {
  const [open, setOpen] = useState(depth < autoCollapseAt)
  const nestedCount = countNodes(value)
  return (
    <span className="inline-flex items-start">
      <button
        type="button"
        className={cn(
          "cursor-pointer text-violet-700 dark:text-violet-300",
          "hover:underline"
        )}
        onClick={() => setOpen((o) => !o)}
        title={`${nestedCount} nodes`}
      >
        {value.tag}
        <span className="text-muted-foreground">{open ? "(" : "(…)"}</span>
      </button>
      {open && (
        <>
          <span className="inline-flex flex-wrap gap-x-1">
            {value.args.map((a, i) => (
              <span key={i}>
                <ValueView
                  value={a}
                  depth={depth + 1}
                  autoCollapseAt={autoCollapseAt}
                />
                {i < value.args.length - 1 && (
                  <span className="text-muted-foreground">,</span>
                )}
              </span>
            ))}
          </span>
          <span className="text-muted-foreground">)</span>
        </>
      )}
    </span>
  )
}

function countNodes(v: Val): number {
  if (v.kind === "int") return 1
  let n = 1
  for (const a of v.args) n += countNodes(a)
  return n
}
