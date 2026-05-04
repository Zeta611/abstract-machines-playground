/**
 * Smoke tests for trace timeline query parsing and matching. Run with
 *
 *     bun run scripts/smoke-trace-query.ts
 *
 * The script exits non-zero on failure.
 */

import {
  parseTraceQuery,
  traceQueryMatches,
  type TraceQueryAst,
} from "@/lib/s/traceQuery"
import { type RuleName } from "@/lib/s/cek"
import * as Result from "melange/result"

let failed = 0

function matches(ast: TraceQueryAst | null, row: (typeof rows)[keyof typeof rows]) {
  return traceQueryMatches(ast ?? undefined, row)
}

type QueryParseState =
  | { ok: true; ast: TraceQueryAst | null }
  | { ok: false; message: string; at: number }

function normalizeParse(query: string): QueryParseState {
  return Result.fold(
    (ast) => ({ ok: true, ast: ast ?? null }),
    ({ message, at }) => ({ ok: false, message, at }),
    parseTraceQuery(query)
  )
}

function expect(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}${detail ? " \u2014 " + detail : ""}`)
  }
}

function parseOk(query: string): TraceQueryAst | null {
  const parsed = normalizeParse(query)
  expect(
    query || "empty query",
    parsed.ok,
    parsed.ok ? undefined : parsed.message
  )
  if (!parsed.ok) return null
  return parsed.ast
}

function parseBad(query: string): void {
  const parsed = normalizeParse(query)
  expect(
    `${query} is invalid`,
    !parsed.ok,
    parsed.ok ? "parsed successfully" : undefined
  )
}

const rows = {
  start0: {
    index: 0,
    label: 0,
  },
  matchIfz: {
    index: 7,
    rule: "Match",
    detail: "| Ifz(e1, e2, e3) matched (branch 5)",
    value: "Ifz(X(), Int(1), Int(2))",
    label: 7,
  },
  matchBranch25: {
    index: 25,
    rule: "Match",
    detail: "| Z() matched (branch 0)",
    value: "Z()",
    label: 25,
  },
  letExp5: {
    index: 41,
    rule: "LetExp",
    value: "True()",
    label: 5,
  },
  return25: {
    index: 31,
    rule: "Return",
    detail: "return to let y",
    value: "Int(10)",
    label: 25,
  },
  letCall: {
    index: 12,
    rule: "LetCall",
    detail: "call eval(3 args) -> let r",
    label: 42,
  },
} satisfies Record<
  string,
  {
    index: number
    rule?: RuleName
    detail?: string
    value?: string
    label: number
  }
>

console.log("1. empty query")
{
  const parsed = normalizeParse("")
  expect("empty parses to null", parsed.ok && parsed.ast === null)
}

console.log("")
console.log("2. field filters")
{
  const rule = parseOk("rule=Match")
  expect("rule=Match matches Match", matches(rule, rows.matchIfz))
  expect("rule=Match excludes Return", !matches(rule, rows.return25))
  expect(
    "rule=match is case-insensitive",
    matches(parseOk("rule=match"), rows.matchIfz)
  )
  expect(
    "rule=mat does not partial-match Match",
    !matches(parseOk("rule=mat"), rows.matchIfz)
  )

  const detail = parseOk("detail=branch && rule=Match")
  expect("detail and rule both match", matches(detail, rows.matchBranch25))
  expect("detail and rule excludes Return", !matches(detail, rows.return25))
}

console.log("")
console.log("3. plain text and labels")
{
  const text = parseOk("Ifz")
  expect("plain text searches detail", matches(text, rows.matchIfz))
  expect("plain text searches value", matches(text, rows.matchIfz))
  expect("plain text excludes unrelated rows", !matches(text, rows.letCall))

  const label = parseOk("l=5")
  expect("label exact match", matches(label, rows.letExp5))
  expect("label exact excludes 25", !matches(label, rows.matchBranch25))
  expect("label exact excludes 7", !matches(label, rows.matchIfz))

  const labelEqAlias = parseOk("l == 5")
  expect("label == alias matches", matches(labelEqAlias, rows.letExp5))
}

console.log("")
console.log("4. numeric comparisons")
{
  const inclusive = parseOk("l >= 0 && l <= 3")
  expect("inclusive range matches lower bound", matches(inclusive, rows.start0))
  expect(
    "inclusive range excludes values above upper bound",
    !matches(inclusive, rows.letExp5)
  )

  const negated = parseOk("!(l >= 0 && l <= 3)")
  expect("negated range excludes values inside range", !matches(negated, rows.start0))
  expect("negated range keeps values outside range", matches(negated, rows.letExp5))

  const strict = parseOk("l > 5 && l < 25")
  expect("strict range matches middle value", matches(strict, rows.matchIfz))
  expect("strict range excludes lower bound", !matches(strict, rows.letExp5))
  expect("strict range excludes upper bound", !matches(strict, rows.return25))
}

console.log("")
console.log("5. logical operators")
{
  const or = parseOk("rule=Match || rule=Return")
  expect("or matches left side", matches(or, rows.matchIfz))
  expect("or matches right side", matches(or, rows.return25))
  expect("or excludes neither side", !matches(or, rows.letCall))

  const implicitPrecedence = parseOk("rule=Match || rule=Return && l=25")
  const grouped = parseOk("(rule=Match || rule=Return) && l=25")
  expect("precedence keeps Match row visible", matches(implicitPrecedence, rows.matchIfz))
  expect("parentheses require l=25 for Match row", !matches(grouped, rows.matchIfz))
  expect("parentheses still match Return l=25", matches(grouped, rows.return25))
}

console.log("")
console.log("6. negation")
{
  const notGrouped = parseOk("!(rule=Match && l=7)")
  expect("not grouped excludes matching row", !matches(notGrouped, rows.matchIfz))
  expect("not grouped keeps non-matching row", matches(notGrouped, rows.matchBranch25))

  const notEquals = parseOk("rule!=Match || l!=25")
  expect("field != excludes row matching both equalities", !matches(notEquals, rows.matchBranch25))
  expect("field != keeps row with different label", matches(notEquals, rows.matchIfz))
  expect("field != keeps row with different rule", matches(notEquals, rows.return25))
}

console.log("")
console.log("7. invalid queries")
{
  parseBad("rule=")
  parseBad("rule!=")
  parseBad("rule=Match &&")
  parseBad("!")
  parseBad("(rule=Match")
  parseBad("foo=bar")
  parseBad("rule>Match")
  parseBad("detail<=branch")
  parseBad("l>foo")
  parseBad("l>=3.5")
}

console.log("")
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`)
  process.exit(1)
}
console.log("all trace query smoke tests passed")
