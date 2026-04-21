import type { RuleName } from "./cek"

export type TraceQueryField = "rule" | "detail" | "l"

export type TraceQueryAst =
  | { kind: "and"; left: TraceQueryAst; right: TraceQueryAst }
  | { kind: "or"; left: TraceQueryAst; right: TraceQueryAst }
  | { kind: "term"; field: TraceQueryField | null; value: string }

export type TraceQueryParseResult =
  | { ok: true; ast: TraceQueryAst | null }
  | { ok: false; message: string; at: number }

type TokenKind = "word" | "string" | "lparen" | "rparen" | "and" | "or" | "eq"

interface Token {
  kind: TokenKind
  text: string
  at: number
}

const FIELD_NAMES = new Set<TraceQueryField>(["rule", "detail", "l"])

export function parseTraceQuery(input: string): TraceQueryParseResult {
  const tokenized = tokenize(input)
  if (!tokenized.ok) return tokenized

  const tokens = tokenized.tokens
  if (tokens.length === 0) return { ok: true, ast: null }

  let pos = 0

  function current(): Token | undefined {
    return tokens[pos]
  }

  function consume(): Token {
    return tokens[pos++]
  }

  function parseOr(): TraceQueryParseResult {
    const first = parseAnd()
    if (!first.ok || first.ast === null) return first

    let ast = first.ast
    while (current()?.kind === "or") {
      const op = consume()
      const right = parseAnd()
      if (!right.ok) return right
      if (right.ast === null) {
        return { ok: false, message: "expected term after ||", at: op.at + 2 }
      }
      ast = { kind: "or", left: ast, right: right.ast }
    }
    return { ok: true, ast }
  }

  function parseAnd(): TraceQueryParseResult {
    const first = parsePrimary()
    if (!first.ok || first.ast === null) return first

    let ast = first.ast
    while (current()?.kind === "and") {
      const op = consume()
      const right = parsePrimary()
      if (!right.ok) return right
      if (right.ast === null) {
        return { ok: false, message: "expected term after &&", at: op.at + 2 }
      }
      ast = { kind: "and", left: ast, right: right.ast }
    }
    return { ok: true, ast }
  }

  function parsePrimary(): TraceQueryParseResult {
    const tok = current()
    if (!tok) {
      return { ok: true, ast: null }
    }

    if (tok.kind === "lparen") {
      consume()
      const inner = parseOr()
      if (!inner.ok) return inner
      if (inner.ast === null) {
        return { ok: false, message: "expected term after (", at: tok.at + 1 }
      }
      const close = current()
      if (close?.kind !== "rparen") {
        return {
          ok: false,
          message: "expected )",
          at: close?.at ?? input.length,
        }
      }
      consume()
      return inner
    }

    if (tok.kind === "word" || tok.kind === "string") {
      return parseTerm()
    }

    const suffix =
      tok.kind === "rparen"
        ? "before )"
        : tok.kind === "and"
          ? "before &&"
          : "before ||"
    return { ok: false, message: `expected term ${suffix}`, at: tok.at }
  }

  function parseTerm(): TraceQueryParseResult {
    const tok = consume()
    const eq = current()

    if (tok.kind === "word" && eq?.kind === "eq") {
      const field = tok.text.toLowerCase()
      if (!isTraceQueryField(field)) {
        return { ok: false, message: `unknown field ${tok.text}`, at: tok.at }
      }

      consume()
      const value = current()
      if (!value || (value.kind !== "word" && value.kind !== "string")) {
        return {
          ok: false,
          message: `expected value after ${tok.text}=`,
          at: value?.at ?? input.length,
        }
      }
      consume()
      if (value.text.length === 0) {
        return {
          ok: false,
          message: `expected value after ${tok.text}=`,
          at: value.at,
        }
      }
      return { ok: true, ast: { kind: "term", field, value: value.text } }
    }

    if (tok.text.length === 0) {
      return { ok: false, message: "expected term", at: tok.at }
    }
    return { ok: true, ast: { kind: "term", field: null, value: tok.text } }
  }

  const parsed = parseOr()
  if (!parsed.ok) return parsed

  const extra = current()
  if (extra) {
    if (extra.kind === "rparen") {
      return { ok: false, message: "unexpected )", at: extra.at }
    }
    return { ok: false, message: `unexpected ${extra.text}`, at: extra.at }
  }

  return parsed
}

export function traceQueryMatches(
  ast: TraceQueryAst | null,
  row: {
    index: number
    rule?: RuleName
    detail?: string
    value?: string
    label: number
  }
): boolean {
  if (ast === null) return true

  switch (ast.kind) {
    case "and":
      return (
        traceQueryMatches(ast.left, row) && traceQueryMatches(ast.right, row)
      )
    case "or":
      return (
        traceQueryMatches(ast.left, row) || traceQueryMatches(ast.right, row)
      )
    case "term":
      return termMatches(ast, row)
  }
}

function termMatches(
  term: Extract<TraceQueryAst, { kind: "term" }>,
  row: {
    rule?: RuleName
    detail?: string
    value?: string
    label: number
  }
): boolean {
  const needle = normalize(term.value)
  const label = String(row.label)

  if (term.field === "rule") return normalize(row.rule ?? "").includes(needle)
  if (term.field === "detail")
    return normalize(row.detail ?? "").includes(needle)
  if (term.field === "l") return normalize(label).includes(needle)

  return normalize(
    [row.rule ?? "", row.detail ?? "", row.value ?? "", label].join(" ")
  ).includes(needle)
}

function normalize(value: string): string {
  return value.toLowerCase()
}

function isTraceQueryField(value: string): value is TraceQueryField {
  return FIELD_NAMES.has(value as TraceQueryField)
}

function tokenize(
  input: string
): { ok: true; tokens: Token[] } | { ok: false; message: string; at: number } {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === "(") {
      tokens.push({ kind: "lparen", text: ch, at: i })
      i++
      continue
    }

    if (ch === ")") {
      tokens.push({ kind: "rparen", text: ch, at: i })
      i++
      continue
    }

    if (ch === "=") {
      tokens.push({ kind: "eq", text: ch, at: i })
      i++
      continue
    }

    if (ch === "&" || ch === "|") {
      const next = input[i + 1]
      if (ch === "&" && next === "&") {
        tokens.push({ kind: "and", text: "&&", at: i })
        i += 2
        continue
      }
      if (ch === "|" && next === "|") {
        tokens.push({ kind: "or", text: "||", at: i })
        i += 2
        continue
      }
      return { ok: false, message: `expected ${ch}${ch}`, at: i }
    }

    if (ch === '"') {
      const start = i
      i++
      let text = ""
      let closed = false
      while (i < input.length) {
        const q = input[i]
        if (q === '"') {
          i++
          tokens.push({ kind: "string", text, at: start })
          closed = true
          break
        }
        if (q === "\\" && i + 1 < input.length) {
          text += input[i + 1]
          i += 2
          continue
        }
        text += q
        i++
      }
      if (!closed) {
        return { ok: false, message: "unterminated string", at: start }
      }
      continue
    }

    const start = i
    let text = ""
    while (i < input.length) {
      const q = input[i]
      if (
        /\s/.test(q) ||
        q === "(" ||
        q === ")" ||
        q === "=" ||
        q === "&" ||
        q === "|"
      ) {
        break
      }
      if (q === '"') {
        return { ok: false, message: "unexpected string quote", at: i }
      }
      text += q
      i++
    }
    tokens.push({ kind: "word", text, at: start })
  }

  return { ok: true, tokens }
}
