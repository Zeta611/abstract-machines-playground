import { buildParser } from "@lezer/generator"
import type { LRParser } from "@lezer/lr"

/**
 * Lezer grammar for language S.
 *
 * Conventions used to disambiguate the grammar:
 *  - Uppercase identifiers (and the keyword-tags `true` / `false`) are
 *    constructor tags. `t<e>` is written `Tag(e, ...)`.
 *  - Lowercase identifiers followed by `(...)` are either function calls
 *    or primitive applications. The AST builder disambiguates this based
 *    on whether the name is a top-level function `def`.
 *  - In a `let x = RHS in c`, if the RHS is a call whose name is a
 *    function def, it is lowered to a [LetCall] node; otherwise it stays
 *    a [Let] with the call as a primitive Exp. The grammar itself does
 *    not need to make this distinction.
 *  - Each `match` must be closed by an explicit `end` keyword. This is
 *    a small deviation from the informal notation in the examples (which
 *    relies on indentation to delimit nested matches).
 */
const grammar = `
@top Program { FunDef+ }

FunDef { FunName ParamList "=" Cmd }

FunName { LowerIdent }

ParamList { "(" (LowerIdent ("," LowerIdent)*)? ")" }

Cmd { LetCmd | MatchCmd | AssertCmd | ReturnCmd }

LetCmd { kw<"let"> LowerIdent "=" Exp kw<"in"> Cmd }

MatchCmd { kw<"match"> Exp kw<"with"> Branch+ kw<"end"> }

Branch { "|" Pattern "=>" Cmd }

Pattern { Tag PatternArgs }

PatternArgs { "(" (LowerIdent ("," LowerIdent)*)? ")" }

AssertCmd { kw<"assert"> Exp kw<"in"> Cmd }

ReturnCmd { Exp }

Exp { Integer | App | Var }

Var { LowerIdent }

App { Name CallArgs }

Name { LowerIdent | Tag }

Tag { UpperIdent | True | False }

True { @specialize<LowerIdent, "true"> }
False { @specialize<LowerIdent, "false"> }

CallArgs { "(" (Exp ("," Exp)*)? ")" }

kw<term> { @specialize[@name={term}]<LowerIdent, term> }

@tokens {
  LowerIdent { $[a-z_] $[a-zA-Z0-9_]* }
  UpperIdent { $[A-Z] $[a-zA-Z0-9_]* }
  Integer { "-"? $[0-9]+ }
  LineComment { "#" ![\n]* }
  space { $[ \\t\\n\\r]+ }
  "=" "=>" "|" "(" ")" ","
  @precedence { "=>", "=" }
}

@skip { space | LineComment }
`

let cached: LRParser | null = null

export function sParser(): LRParser {
  if (cached) return cached
  cached = buildParser(grammar, { includeNames: true })
  return cached
}
