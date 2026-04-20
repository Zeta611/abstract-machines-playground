/**
 * Runtime values of language S:
 *   Val v ::= n | t<v...>
 *
 * Booleans are encoded as the 0-ary constructors `true()` and `false()`.
 */

export type Val =
  | { kind: "int"; n: number }
  | { kind: "ctor"; tag: string; args: Val[] }

export function vInt(n: number): Val {
  return { kind: "int", n }
}

export function vCtor(tag: string, args: Val[] = []): Val {
  return { kind: "ctor", tag, args }
}

export const V_TRUE: Val = vCtor("true", [])
export const V_FALSE: Val = vCtor("false", [])

export function isTrue(v: Val): boolean {
  return v.kind === "ctor" && v.tag === "true" && v.args.length === 0
}

export function valEq(a: Val, b: Val): boolean {
  if (a.kind === "int" && b.kind === "int") return a.n === b.n
  if (a.kind === "ctor" && b.kind === "ctor") {
    if (a.tag !== b.tag || a.args.length !== b.args.length) return false
    for (let i = 0; i < a.args.length; i++) {
      if (!valEq(a.args[i], b.args[i])) return false
    }
    return true
  }
  return false
}

/** Pretty-print a value on a single line, compact form. */
export function showVal(v: Val): string {
  if (v.kind === "int") return String(v.n)
  if (v.args.length === 0) return `${v.tag}()`
  return `${v.tag}(${v.args.map(showVal).join(", ")})`
}

export type Env = Map<string, Val>

export function envExtend(rho: Env, x: string, v: Val): Env {
  const next = new Map(rho)
  next.set(x, v)
  return next
}

export function envExtendMany(rho: Env, bindings: [string, Val][]): Env {
  const next = new Map(rho)
  for (const [x, v] of bindings) next.set(x, v)
  return next
}
