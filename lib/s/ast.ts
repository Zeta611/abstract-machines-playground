/**
 * AST types for language S.
 *
 *   Prog P ::= f(x) = c; c
 *   Exp  e ::= n | x | t<e> | o(e)
 *   Cmd  c ::= e
 *           | let x = e in c
 *           | let x = f(e) in c
 *           | match e with b
 *           | assert e in c
 *   Branch b ::= t<x> => c
 *
 * Every command carries a unique Label.
 * The CEK machine dereferences labels through the ControlMap.
 */

export type Label = number

export interface Loc {
  from: number
  to: number
}

export type Exp =
  | { kind: "Num"; n: number; loc: Loc }
  | { kind: "Var"; name: string; loc: Loc }
  | { kind: "Ctor"; tag: string; args: Exp[]; loc: Loc }
  | { kind: "Prim"; op: string; args: Exp[]; loc: Loc }

export type Cmd =
  | { kind: "Return"; label: Label; exp: Exp; loc: Loc }
  | {
      kind: "Let"
      label: Label
      x: string
      exp: Exp
      body: Cmd
      loc: Loc
    }
  | {
      kind: "LetCall"
      label: Label
      x: string
      fn: string
      args: Exp[]
      body: Cmd
      loc: Loc
    }
  | {
      kind: "Match"
      label: Label
      scrutinee: Exp
      branches: Branch[]
      loc: Loc
    }
  | {
      kind: "Assert"
      label: Label
      exp: Exp
      body: Cmd
      loc: Loc
    }

export interface Branch {
  tag: string
  vars: string[]
  body: Cmd
  loc: Loc
}

export interface Def {
  name: string
  params: string[]
  body: Cmd
  loc: Loc
}

/** Static control map: label -> command node. */
export type ControlMap = Map<Label, Cmd>

export interface Prog {
  defs: Map<string, Def>
  /** Name of the designated entry point (conventionally "main"). */
  mainName: string
  /** Auxiliary info built during parsing. */
  ctrl: ControlMap
}

/** Pretty-print a command header (single-line summary) for UI badges / kont frames. */
export function cmdSummary(c: Cmd): string {
  switch (c.kind) {
    case "Return":
      return `return ${expSummary(c.exp)}`
    case "Let":
      return `let ${c.x} = ${expSummary(c.exp)} in ...`
    case "LetCall":
      return `let ${c.x} = ${c.fn}(${c.args.map(expSummary).join(", ")}) in ...`
    case "Match":
      return `match ${expSummary(c.scrutinee)} with ...`
    case "Assert":
      return `assert ${expSummary(c.exp)} in ...`
  }
}

export function expSummary(e: Exp): string {
  switch (e.kind) {
    case "Num":
      return String(e.n)
    case "Var":
      return e.name
    case "Ctor":
      return `${e.tag}(${e.args.map(expSummary).join(", ")})`
    case "Prim":
      return `${e.op}(${e.args.map(expSummary).join(", ")})`
  }
}
