"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import type { SyntaxNode } from "@lezer/common"
import { cn } from "@/lib/utils"
import type { Loc } from "@/lib/s/ast"
import { sParser } from "@/lib/s/grammar"

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

  const traceRanges = buildTraceRanges(
    source.length,
    highlight ?? null,
    kontHighlights,
    hoverHighlight ?? null
  )
  const syntaxRanges = useMemo(() => buildSyntaxRanges(source), [source])
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
        {traceRanges.map((r, i) => {
          const children = renderSyntaxSpans(source, syntaxRanges, r.from, r.to)
          switch (r.kind) {
            case "plain":
              return <span key={i}>{children}</span>
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
                  {children}
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
                  {children}
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
                  {children}
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
type SyntaxKind =
  | "keyword"
  | "definition"
  | "callee"
  | "identifier"
  | "constructor"
  | "number"
  | "comment"
  | "operator"
  | "punctuation"
type SyntaxRange = { kind: SyntaxKind; from: number; to: number }

/**
 * Build a non-overlapping sequence of ranges that cover [0, length).
 * Priority (highest last wins): plain < kont < current < hover.
 */
function buildTraceRanges(
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

const KEYWORD_NODES = new Set(["let", "in", "match", "with", "end", "assert"])
const OPERATOR_NODES = new Set(["=", "=>", "|"])
const PUNCTUATION_NODES = new Set(["(", ")", ","])

function buildSyntaxRanges(source: string): SyntaxRange[] {
  const ranges: SyntaxRange[] = []

  try {
    const cursor = sParser().parse(source).cursor()
    do {
      const kind = syntaxKind(cursor.node)
      if (kind && cursor.to > cursor.from) {
        ranges.push({ kind, from: cursor.from, to: cursor.to })
      }
    } while (cursor.next())
  } catch {
    return []
  }

  return normalizeSyntaxRanges(source.length, ranges)
}

function syntaxKind(node: SyntaxNode): SyntaxKind | null {
  switch (node.name) {
    case "LineComment":
      return "comment"
    case "Integer":
      return "number"
    case "UpperIdent":
    case "True":
    case "False":
      return "constructor"
    case "LowerIdent": {
      const parent = node.parent?.name
      if (parent === "FunName") return "definition"
      if (parent === "Name") return "callee"
      return "identifier"
    }
    default:
      if (KEYWORD_NODES.has(node.name)) return "keyword"
      if (OPERATOR_NODES.has(node.name)) return "operator"
      if (PUNCTUATION_NODES.has(node.name)) return "punctuation"
      return null
  }
}

function normalizeSyntaxRanges(
  length: number,
  ranges: SyntaxRange[]
): SyntaxRange[] {
  const out: SyntaxRange[] = []
  let cursor = 0

  for (const range of ranges
    .slice()
    .sort((a, b) => a.from - b.from || a.to - b.to)) {
    const from = Math.max(cursor, Math.max(0, Math.min(length, range.from)))
    const to = Math.max(0, Math.min(length, range.to))
    if (to <= from) continue
    out.push({ ...range, from, to })
    cursor = to
  }

  return out
}

function renderSyntaxSpans(
  source: string,
  ranges: SyntaxRange[],
  from: number,
  to: number
): ReactNode[] {
  const out: ReactNode[] = []
  let cursor = from

  for (const range of ranges) {
    if (range.to <= from) continue
    if (range.from >= to) break

    const tokenFrom = Math.max(from, range.from)
    const tokenTo = Math.min(to, range.to)
    if (tokenFrom > cursor) {
      out.push(
        <span key={`${cursor}:plain`}>{source.slice(cursor, tokenFrom)}</span>
      )
    }
    out.push(
      <span
        key={`${tokenFrom}:${range.kind}`}
        className={syntaxClassName(range.kind)}
      >
        {source.slice(tokenFrom, tokenTo)}
      </span>
    )
    cursor = tokenTo
  }

  if (cursor < to) {
    out.push(<span key={`${cursor}:plain`}>{source.slice(cursor, to)}</span>)
  }

  return out
}

function syntaxClassName(kind: SyntaxKind): string {
  switch (kind) {
    case "keyword":
      return "text-teal-700 dark:text-teal-300"
    case "definition":
      return "text-sky-700 dark:text-sky-300"
    case "callee":
      return "text-sky-700 dark:text-sky-300"
    case "identifier":
      return "text-foreground"
    case "constructor":
      return "text-violet-700 dark:text-violet-300"
    case "number":
      return "text-sky-700 tabular-nums dark:text-sky-300"
    case "comment":
      return "text-muted-foreground"
    case "operator":
      return "text-rose-700 dark:text-rose-300"
    case "punctuation":
      return "text-muted-foreground"
  }
}
