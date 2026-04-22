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
} from "../lib/s/trace-query"
import type { RuleName } from "../lib/s/cek"

let failed = 0

function expect(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}${detail ? " \u2014 " + detail : ""}`)
  }
}

function parseOk(query: string): TraceQueryAst | null {
  const parsed = parseTraceQuery(query)
  expect(
    query || "empty query",
    parsed.ok,
    parsed.ok ? undefined : parsed.message
  )
  if (!parsed.ok) return null
  return parsed.ast
}

function parseBad(query: string): void {
  const parsed = parseTraceQuery(query)
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
    rule: "Match" as RuleName,
    detail: "| Ifz(e1, e2, e3) matched (branch 5)",
    value: "Ifz(X(), Int(1), Int(2))",
    label: 7,
  },
  matchBranch25: {
    index: 25,
    rule: "Match" as RuleName,
    detail: "| Z() matched (branch 0)",
    value: "Z()",
    label: 25,
  },
  assert5: {
    index: 41,
    rule: "Assert" as RuleName,
    value: "true()",
    label: 5,
  },
  return25: {
    index: 31,
    rule: "Return" as RuleName,
    detail: "return to let y",
    value: "Int(10)",
    label: 25,
  },
  letCall: {
    index: 12,
    rule: "LetCall" as RuleName,
    detail: "call eval(3 args) -> let r",
    label: 42,
  },
}

console.log("1. empty query")
{
  const parsed = parseTraceQuery("")
  expect("empty parses to null", parsed.ok && parsed.ast === null)
}

console.log("")
console.log("2. field filters")
{
  const rule = parseOk("rule=Match")
  expect("rule=Match matches Match", traceQueryMatches(rule, rows.matchIfz))
  expect("rule=Match excludes Return", !traceQueryMatches(rule, rows.return25))
  expect(
    "rule=match is case-insensitive",
    traceQueryMatches(parseOk("rule=match"), rows.matchIfz)
  )
  expect(
    "rule=mat does not partial-match Match",
    !traceQueryMatches(parseOk("rule=mat"), rows.matchIfz)
  )

  const detail = parseOk("detail=branch && rule=Match")
  expect(
    "detail and rule both match",
    traceQueryMatches(detail, rows.matchBranch25)
  )
  expect(
    "detail and rule excludes Return",
    !traceQueryMatches(detail, rows.return25)
  )
}

console.log("")
console.log("3. plain text and labels")
{
  const text = parseOk("Ifz")
  expect("plain text searches detail", traceQueryMatches(text, rows.matchIfz))
  expect("plain text searches value", traceQueryMatches(text, rows.matchIfz))
  expect(
    "plain text excludes unrelated rows",
    !traceQueryMatches(text, rows.letCall)
  )

  const label = parseOk("l=5")
  expect("label exact match", traceQueryMatches(label, rows.assert5))
  expect(
    "label exact excludes 25",
    !traceQueryMatches(label, rows.matchBranch25)
  )
  expect("label exact excludes 7", !traceQueryMatches(label, rows.matchIfz))

  const labelEqAlias = parseOk("l == 5")
  expect(
    "label == alias matches",
    traceQueryMatches(labelEqAlias, rows.assert5)
  )
}

console.log("")
console.log("4. numeric comparisons")
{
  const inclusive = parseOk("l >= 0 && l <= 3")
  expect(
    "inclusive range matches lower bound",
    traceQueryMatches(inclusive, rows.start0)
  )
  expect(
    "inclusive range excludes values above upper bound",
    !traceQueryMatches(inclusive, rows.assert5)
  )

  const negated = parseOk("!(l >= 0 && l <= 3)")
  expect(
    "negated range excludes values inside range",
    !traceQueryMatches(negated, rows.start0)
  )
  expect(
    "negated range keeps values outside range",
    traceQueryMatches(negated, rows.assert5)
  )

  const strict = parseOk("l > 5 && l < 25")
  expect(
    "strict range matches middle value",
    traceQueryMatches(strict, rows.matchIfz)
  )
  expect(
    "strict range excludes lower bound",
    !traceQueryMatches(strict, rows.assert5)
  )
  expect(
    "strict range excludes upper bound",
    !traceQueryMatches(strict, rows.return25)
  )
}

console.log("")
console.log("5. logical operators")
{
  const or = parseOk("rule=Match || rule=Return")
  expect("or matches left side", traceQueryMatches(or, rows.matchIfz))
  expect("or matches right side", traceQueryMatches(or, rows.return25))
  expect("or excludes neither side", !traceQueryMatches(or, rows.letCall))

  const implicitPrecedence = parseOk("rule=Match || rule=Return && l=25")
  const grouped = parseOk("(rule=Match || rule=Return) && l=25")
  expect(
    "precedence keeps Match row visible",
    traceQueryMatches(implicitPrecedence, rows.matchIfz)
  )
  expect(
    "parentheses require l=25 for Match row",
    !traceQueryMatches(grouped, rows.matchIfz)
  )
  expect(
    "parentheses still match Return l=25",
    traceQueryMatches(grouped, rows.return25)
  )
}

console.log("")
console.log("6. negation")
{
  const notGrouped = parseOk("!(rule=Match && l=7)")
  expect(
    "not grouped excludes matching row",
    !traceQueryMatches(notGrouped, rows.matchIfz)
  )
  expect(
    "not grouped keeps non-matching row",
    traceQueryMatches(notGrouped, rows.matchBranch25)
  )

  const notEquals = parseOk("rule!=Match || l!=25")
  expect(
    "field != excludes row matching both equalities",
    !traceQueryMatches(notEquals, rows.matchBranch25)
  )
  expect(
    "field != keeps row with different label",
    traceQueryMatches(notEquals, rows.matchIfz)
  )
  expect(
    "field != keeps row with different rule",
    traceQueryMatches(notEquals, rows.return25)
  )
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
