"use client"

import { useState } from "react"
import { visit, type CtorPayload, type Val } from "@/lib/s/values"
import { cn } from "@/lib/utils"

interface Props {
  value: Val
  depth?: number
  autoCollapseAt?: number
}

/** Renders a constructor / integer value as an inline, collapsible tree. */
export function ValueView({ value, depth = 0, autoCollapseAt = 4 }: Props) {
  return visit(value, {
    int: ({ n }) => (
      <span className="text-sky-700 tabular-nums dark:text-sky-300">{n}</span>
    ),
    ctor: (payload) =>
      payload.args.length === 0 ? (
        <span className="text-violet-700 dark:text-violet-300">
          {payload.tag}
          <span className="text-muted-foreground">()</span>
        </span>
      ) : (
        <CtorValue
          value={payload}
          depth={depth}
          autoCollapseAt={autoCollapseAt}
        />
      ),
  })
}

function CtorValue({
  value,
  depth,
  autoCollapseAt,
}: {
  value: CtorPayload
  depth: number
  autoCollapseAt: number
}) {
  const [open, setOpen] = useState(depth < autoCollapseAt)
  const nestedCount = countCtorNodes(value)
  return (
    <span>
      <button
        type="button"
        className={cn(
          "cursor-pointer whitespace-nowrap text-violet-700 dark:text-violet-300",
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
          {value.args.map((a, i) => (
            <span key={i}>
              <ValueView
                value={a}
                depth={depth + 1}
                autoCollapseAt={autoCollapseAt}
              />
              {i < value.args.length - 1 && (
                <span className="text-muted-foreground">{", "}</span>
              )}
            </span>
          ))}
          <span className="text-muted-foreground">)</span>
        </>
      )}
    </span>
  )
}

function countNodes(v: Val): number {
  return visit(v, {
    int: () => 1,
    ctor: countCtorNodes,
  })
}

function countCtorNodes({ args }: CtorPayload): number {
  return 1 + args.map(countNodes).reduce((a, b) => a + b, 0)
}
