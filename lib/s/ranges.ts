import type { SyntaxNode } from "@lezer/common"
import { sParser } from "./grammar"

export type SyntaxKind =
  | "keyword"
  | "definition"
  | "callee"
  | "identifier"
  | "constructor"
  | "number"
  | "comment"
  | "operator"
  | "punctuation"

export type SyntaxRange = { kind: SyntaxKind; from: number; to: number }

const KEYWORD_NODES = new Set(["let", "in", "match", "with", "end"])
const OPERATOR_NODES = new Set(["=", "=>", "|"])
const PUNCTUATION_NODES = new Set(["(", ")", ","])

export function buildSyntaxRanges(source: string): SyntaxRange[] {
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
