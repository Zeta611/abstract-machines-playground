"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { Loc } from "@/lib/s/ast"

interface Props {
  source: string
  highlight?: Loc | null
  kontHighlights?: Loc[]
}

/**
 * Read-only source display with a line-numbered gutter (matching
 * `SourceEditor` so the locked/unlocked switch doesn't shift the text),
 * an optional highlighted range for the current command label, and softer
 * highlights for labels that currently occupy continuation frames.
 */
export function SourceView({ source, highlight, kontHighlights = [] }: Props) {
  const highlightRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    }
  }, [highlight?.from, highlight?.to])

  const ranges = buildRanges(source.length, highlight ?? null, kontHighlights)
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
          if (r.kind === "plain") {
            return <span key={i}>{text}</span>
          }
          if (r.kind === "kont") {
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
          }
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
        })}
      </pre>
    </div>
  )
}

type Range =
  | { kind: "plain"; from: number; to: number }
  | { kind: "kont"; from: number; to: number }
  | { kind: "current"; from: number; to: number }

/**
 * Build a non-overlapping sequence of ranges that cover [0, length).
 * The `current` highlight wins over any overlapping `kont` highlight.
 */
function buildRanges(
  length: number,
  current: Loc | null,
  kont: Loc[]
): Range[] {
  // Prepare candidate highlights, sorted by `from`, with non-overlap.
  type Cand = { kind: "kont" | "current"; from: number; to: number }
  const cands: Cand[] = []
  for (const k of kont) {
    cands.push({ kind: "kont", from: k.from, to: k.to })
  }
  if (current) {
    cands.push({ kind: "current", from: current.from, to: current.to })
  }
  // Normalize: clamp to [0, length] and drop empty/reversed.
  for (const c of cands) {
    c.from = Math.max(0, Math.min(length, c.from))
    c.to = Math.max(0, Math.min(length, c.to))
  }
  const usable = cands.filter((c) => c.to > c.from)

  // Paint a mask: for each char, the winning highlight kind (or "plain").
  // `current` beats `kont`.
  const mask: ("plain" | "kont" | "current")[] = new Array(length).fill("plain")
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

  // Convert mask to ranges.
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
