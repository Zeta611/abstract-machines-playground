import { vCtor, vInt } from "./values"
import type { Env, Val } from "./values"

/**
 * Tiny parser for initial environments.
 *
 * Syntax (one binding per line):
 *
 *   x = <value-literal>
 *
 * where <value-literal> is:
 *
 *   Integer                  e.g. 42, -3
 *   Tag ( <values>? )        e.g. true(), Fun(0), Cons(Int(1), Nil())
 *
 * Blank lines and `#`-comments are ignored.
 */

export class EnvParseError extends Error {
  public readonly pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.pos = pos
  }
}

class Lexer {
  private i = 0
  constructor(private readonly src: string) {}

  pos(): number {
    return this.i
  }

  peek(): string {
    return this.src[this.i] ?? ""
  }

  skipSpace(): void {
    while (this.i < this.src.length) {
      const c = this.src[this.i]
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        this.i++
        continue
      }
      break
    }
  }

  eatChar(c: string): boolean {
    this.skipSpace()
    if (this.src[this.i] === c) {
      this.i++
      return true
    }
    return false
  }

  expectChar(c: string): void {
    this.skipSpace()
    if (this.src[this.i] !== c) {
      throw new EnvParseError(
        `expected '${c}' at position ${this.i}, got '${this.src[this.i] ?? "<eof>"}'`,
        this.i
      )
    }
    this.i++
  }

  readIdent(): string {
    this.skipSpace()
    const start = this.i
    const c0 = this.src[this.i]
    if (!c0 || !/[A-Za-z_]/.test(c0)) {
      throw new EnvParseError(
        `expected identifier at position ${this.i}`,
        this.i
      )
    }
    while (this.i < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.i]!)) {
      this.i++
    }
    return this.src.slice(start, this.i)
  }

  readInt(): number | null {
    this.skipSpace()
    const start = this.i
    if (this.src[this.i] === "-") this.i++
    const digitsStart = this.i
    while (this.i < this.src.length && /[0-9]/.test(this.src[this.i]!)) {
      this.i++
    }
    if (this.i === digitsStart) {
      this.i = start
      return null
    }
    return Number(this.src.slice(start, this.i))
  }

  atEof(): boolean {
    this.skipSpace()
    return this.i >= this.src.length
  }
}

function isTagName(name: string): boolean {
  if (name === "true" || name === "false") return true
  return name.length > 0 && name[0] >= "A" && name[0] <= "Z"
}

function parseValue(lex: Lexer): Val {
  lex.skipSpace()
  const n = lex.readInt()
  if (n !== null) return vInt(n)

  const name = lex.readIdent()
  if (!isTagName(name)) {
    throw new EnvParseError(
      `expected integer or constructor tag (UpperCase or true/false), got '${name}'`,
      lex.pos() - name.length
    )
  }
  const args: Val[] = []
  if (lex.eatChar("(")) {
    if (!lex.eatChar(")")) {
      args.push(parseValue(lex))
      while (lex.eatChar(",")) {
        args.push(parseValue(lex))
      }
      lex.expectChar(")")
    }
  }
  return vCtor(name, args)
}

export function parseValue1(src: string): Val {
  const lex = new Lexer(src)
  const v = parseValue(lex)
  if (!lex.atEof()) {
    throw new EnvParseError(`unexpected trailing input`, lex.pos())
  }
  return v
}

/** Parse one binding line: `name = value`. */
export function parseBinding(line: string): [string, Val] {
  const lex = new Lexer(line)
  const name = lex.readIdent()
  if (!lex.eatChar("=")) {
    throw new EnvParseError(
      `expected '=' after binding name '${name}'`,
      lex.pos()
    )
  }
  const v = parseValue(lex)
  if (!lex.atEof()) {
    throw new EnvParseError(`unexpected trailing input after value`, lex.pos())
  }
  return [name, v]
}

/** Parse a multi-line env text. Lines beginning with `#` (after optional
 * whitespace) and blank lines are skipped. */
export function parseEnv(src: string): Env {
  const env: Env = new Map()
  const lines = src.split(/\r?\n/)
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    if (trimmed.startsWith("#")) continue
    try {
      const [name, v] = parseBinding(raw)
      env.set(name, v)
    } catch (err) {
      if (err instanceof EnvParseError) {
        throw new EnvParseError(`line ${li + 1}: ${err.message}`, err.pos)
      }
      throw err
    }
  }
  return env
}
