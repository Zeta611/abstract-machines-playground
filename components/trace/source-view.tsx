"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { Loc } from "@/lib/s/ast"

interface Props {
  source: string
  highlight?: Loc | null
  kontHighlights?: Loc[]
  hoverHighlight?: Loc | null
}

/**
 * Read-only source display with a line-numbered gutter (matching
 * `SourceEditor` so the locked/unlocked switch doesn't shift the text),
 * an optional highlighted range for the current command label, softer
 * highlights for labels that currently occupy continuation frames, and a
 * transient "hover" highlight driven by hovering label badges elsewhere
 * in the UI.
 */
export function SourceView({
  source,
  highlight,
  kontHighlights = [],
  hoverHighlight,
}: Props) {
  const highlightRef = useRef<HTMLSpanElement>(null)
  const hoverRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    }
  }, [highlight?.from, highlight?.to])

  useEffect(() => {
    if (hoverRef.current) {
      hoverRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    }
  }, [hoverHighlight?.from, hoverHighlight?.to])

  const ranges = buildRanges(
    source.length,
    highlight ?? null,
    kontHighlights,
    hoverHighlight ?? null
  )
  const lines = Math.max(source.split("\n").length, 1)

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 overflow-auto rounded border bg-background/40",
        "font-mono text-xs leading-5"
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
      <pre className="m-0 min-w-0 flex-1 px-2 py-2 whitespace-pre">
        {ranges.map((r, i) => {
          const text = source.slice(r.from, r.to)
          switch (r.kind) {
            case "plain":
              return <span key={i}>{text}</span>
            case "kont":
              return (
                <span
                  key={i}
                  className={cn(
                    "rounded-sm",
                    "bg-amber-100/60 dark:bg-amber-900/30",
                    "ring-1 ring-amber-300/50 dark:ring-amber-800/40"
                  )}
                >
                  {text}
                </span>
              )
            case "hover":
              return (
                <span
                  key={i}
                  ref={hoverRef}
                  className={cn(
                    "rounded-sm",
                    "bg-sky-100/70 dark:bg-sky-900/40",
                    "ring-1 ring-sky-400/70 dark:ring-sky-500/50"
                  )}
                >
                  {text}
                </span>
              )
            case "current":
              return (
                <span
                  key={i}
                  ref={highlightRef}
                  className={cn(
                    "rounded-sm",
                    "bg-emerald-100/80 dark:bg-emerald-900/40",
                    "ring-1 ring-emerald-400/70 dark:ring-emerald-500/50"
                  )}
                >
                  {text}
                </span>
              )
          }
        })}
      </pre>
    </div>
  )
}

type RangeKind = "plain" | "kont" | "current" | "hover"
type Range = { kind: RangeKind; from: number; to: number }

/**
 * Build a non-overlapping sequence of ranges that cover [0, length).
 * Priority (highest last wins): plain < kont < current < hover.
 */
function buildRanges(
  length: number,
  current: Loc | null,
  kont: Loc[],
  hover: Loc | null
): Range[] {
  type Cand = { kind: "kont" | "current" | "hover"; from: number; to: number }
  const cands: Cand[] = []
  for (const k of kont) {
    cands.push({ kind: "kont", from: k.from, to: k.to })
  }
  if (current) {
    cands.push({ kind: "current", from: current.from, to: current.to })
  }
  if (hover) {
    cands.push({ kind: "hover", from: hover.from, to: hover.to })
  }
  for (const c of cands) {
    c.from = Math.max(0, Math.min(length, c.from))
    c.to = Math.max(0, Math.min(length, c.to))
  }
  const usable = cands.filter((c) => c.to > c.from)

  const mask: RangeKind[] = new Array(length).fill("plain")
  for (const c of usable) {
    if (c.kind === "kont") {
      for (let i = c.from; i < c.to; i++) {
        if (mask[i] === "plain") mask[i] = "kont"
      }
    }
  }
  for (const c of usable) {
    if (c.kind === "current") {
      for (let i = c.from; i < c.to; i++) mask[i] = "current"
    }
  }
  for (const c of usable) {
    if (c.kind === "hover") {
      for (let i = c.from; i < c.to; i++) mask[i] = "hover"
    }
  }

  const out: Range[] = []
  let i = 0
  while (i < length) {
    const k = mask[i]
    let j = i + 1
    while (j < length && mask[j] === k) j++
    out.push({ kind: k, from: i, to: j })
    i = j
  }
  if (length === 0) out.push({ kind: "plain", from: 0, to: 0 })
  return out
}
