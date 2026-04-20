import type { SyntaxNode, Tree } from "@lezer/common"
import { sParser } from "./grammar"
import type { Branch, Cmd, ControlMap, Def, Exp, Label, Loc, Prog } from "./ast"

/**
 * Build a labeled AST `Prog` (plus a `ControlMap`) from S source text.
 *
 * The Lezer parser produces a lossless CST. This module walks that CST,
 * resolves the `name(args)` Var/App/Prim/Ctor/Call ambiguity via the
 * set of function names declared in the program, and assigns a unique
 * `Label` to every `Cmd` node while populating the `ControlMap`.
 */

export class SParseError extends Error {
  public readonly from: number
  public readonly to: number
  constructor(message: string, from: number, to: number) {
    super(message)
    this.from = from
    this.to = to
  }
}

interface BuildCtx {
  src: string
  ctrl: ControlMap
  nextLabel: Label
  funNames: Set<string>
}

function loc(node: SyntaxNode): Loc {
  return { from: node.from, to: node.to }
}

function text(node: SyntaxNode, src: string): string {
  return src.slice(node.from, node.to)
}

/** Collect first-level children of `node` that have a given `type.name`. */
function childrenOf(node: SyntaxNode, name: string): SyntaxNode[] {
  const out: SyntaxNode[] = []
  let c = node.firstChild
  while (c) {
    if (c.name === name) out.push(c)
    c = c.nextSibling
  }
  return out
}

function firstChild(node: SyntaxNode, name: string): SyntaxNode | null {
  let c = node.firstChild
  while (c) {
    if (c.name === name) return c
    c = c.nextSibling
  }
  return null
}

/** Expect a single named child and return it. */
function requireChild(node: SyntaxNode, name: string, src: string): SyntaxNode {
  const c = firstChild(node, name)
  if (!c) {
    throw new SParseError(
      `expected child <${name}> inside <${node.name}> (${JSON.stringify(text(node, src).slice(0, 40))})`,
      node.from,
      node.to
    )
  }
  return c
}

function fresh(ctx: BuildCtx): Label {
  return ctx.nextLabel++
}

function record<T extends Cmd>(ctx: BuildCtx, c: T): T {
  ctx.ctrl.set(c.label, c)
  return c
}

// -- Expression ---------------------------------------------------------------

function buildExp(node: SyntaxNode, ctx: BuildCtx): Exp {
  // Exp = Integer | App | Var
  const inner = node.firstChild
  if (!inner) {
    throw new SParseError(`empty Exp node at ${node.from}`, node.from, node.to)
  }
  switch (inner.name) {
    case "Integer": {
      const t = text(inner, ctx.src)
      const n = Number(t)
      if (!Number.isFinite(n)) {
        throw new SParseError(`invalid integer ${t}`, inner.from, inner.to)
      }
      return { kind: "Num", n, loc: loc(inner) }
    }
    case "Var": {
      const ident = requireChild(inner, "LowerIdent", ctx.src)
      return { kind: "Var", name: text(ident, ctx.src), loc: loc(inner) }
    }
    case "App":
      return buildAppAsExp(inner, ctx)
    default:
      throw new SParseError(
        `unexpected Exp child <${inner.name}>`,
        inner.from,
        inner.to
      )
  }
}

/**
 * Build an App node in an expression position. Inside any Exp, a
 * LowerIdent application is ALWAYS a primitive (per PDF grammar:
 * function calls only appear as `let x = f(e) in c`). Uppercase /
 * true / false names are always constructors.
 */
function buildAppAsExp(app: SyntaxNode, ctx: BuildCtx): Exp {
  const nameNode = requireChild(app, "Name", ctx.src)
  const callArgs = requireChild(app, "CallArgs", ctx.src)
  const args = parseCallArgs(callArgs, ctx)

  const tagChild = firstChild(nameNode, "Tag")
  if (tagChild) {
    const tagText = text(tagChild, ctx.src)
    return { kind: "Ctor", tag: tagText, args, loc: loc(app) }
  }
  const lower = firstChild(nameNode, "LowerIdent")
  if (!lower) {
    throw new SParseError("App has no Name", app.from, app.to)
  }
  const op = text(lower, ctx.src)
  return { kind: "Prim", op, args, loc: loc(app) }
}

function parseCallArgs(callArgs: SyntaxNode, ctx: BuildCtx): Exp[] {
  return childrenOf(callArgs, "Exp").map((e) => buildExp(e, ctx))
}

// -- Command ------------------------------------------------------------------

function buildCmd(node: SyntaxNode, ctx: BuildCtx): Cmd {
  // Cmd = LetCmd | MatchCmd | AssertCmd | ReturnCmd
  const inner = node.firstChild
  if (!inner) {
    throw new SParseError("empty Cmd node", node.from, node.to)
  }
  switch (inner.name) {
    case "LetCmd":
      return buildLet(inner, ctx)
    case "MatchCmd":
      return buildMatch(inner, ctx)
    case "AssertCmd":
      return buildAssert(inner, ctx)
    case "ReturnCmd":
      return buildReturn(inner, ctx)
    default:
      throw new SParseError(
        `unexpected Cmd child <${inner.name}>`,
        inner.from,
        inner.to
      )
  }
}

function buildReturn(node: SyntaxNode, ctx: BuildCtx): Cmd {
  const exp = requireChild(node, "Exp", ctx.src)
  return record(ctx, {
    kind: "Return",
    label: fresh(ctx),
    exp: buildExp(exp, ctx),
    loc: loc(node),
  })
}

function buildLet(node: SyntaxNode, ctx: BuildCtx): Cmd {
  // LetCmd { let LowerIdent "=" Exp in Cmd }
  const idents = childrenOf(node, "LowerIdent")
  if (idents.length < 1) {
    throw new SParseError("let: missing bound var", node.from, node.to)
  }
  const x = text(idents[0], ctx.src)
  const exp = requireChild(node, "Exp", ctx.src)
  const cmd = requireChild(node, "Cmd", ctx.src)
  const body = buildCmd(cmd, ctx)

  // If the RHS is an App whose function name matches a declared def,
  // lower this into a LetCall node (triggers the CEK [LetCall] rule).
  const appInside = firstChild(exp, "App")
  if (appInside) {
    const nameNode = requireChild(appInside, "Name", ctx.src)
    const lower = firstChild(nameNode, "LowerIdent")
    if (lower) {
      const fn = text(lower, ctx.src)
      if (ctx.funNames.has(fn)) {
        const callArgs = requireChild(appInside, "CallArgs", ctx.src)
        const args = parseCallArgs(callArgs, ctx)
        return record(ctx, {
          kind: "LetCall",
          label: fresh(ctx),
          x,
          fn,
          args,
          body,
          loc: loc(node),
        })
      }
    }
  }

  return record(ctx, {
    kind: "Let",
    label: fresh(ctx),
    x,
    exp: buildExp(exp, ctx),
    body,
    loc: loc(node),
  })
}

function buildAssert(node: SyntaxNode, ctx: BuildCtx): Cmd {
  const exp = requireChild(node, "Exp", ctx.src)
  const cmd = requireChild(node, "Cmd", ctx.src)
  return record(ctx, {
    kind: "Assert",
    label: fresh(ctx),
    exp: buildExp(exp, ctx),
    body: buildCmd(cmd, ctx),
    loc: loc(node),
  })
}

function buildMatch(node: SyntaxNode, ctx: BuildCtx): Cmd {
  const exp = requireChild(node, "Exp", ctx.src)
  const branchNodes = childrenOf(node, "Branch")
  const branches: Branch[] = branchNodes.map((b) => buildBranch(b, ctx))
  return record(ctx, {
    kind: "Match",
    label: fresh(ctx),
    scrutinee: buildExp(exp, ctx),
    branches,
    loc: loc(node),
  })
}

function buildBranch(node: SyntaxNode, ctx: BuildCtx): Branch {
  const pattern = requireChild(node, "Pattern", ctx.src)
  const tagNode = requireChild(pattern, "Tag", ctx.src)
  const tag = text(tagNode, ctx.src)
  const patArgs = requireChild(pattern, "PatternArgs", ctx.src)
  const vars = childrenOf(patArgs, "LowerIdent").map((n) => text(n, ctx.src))
  const cmd = requireChild(node, "Cmd", ctx.src)
  return {
    tag,
    vars,
    body: buildCmd(cmd, ctx),
    loc: loc(node),
  }
}

// -- Top level ---------------------------------------------------------------

function buildDef(node: SyntaxNode, ctx: BuildCtx): Def {
  const funName = requireChild(node, "FunName", ctx.src)
  const nameIdent = requireChild(funName, "LowerIdent", ctx.src)
  const name = text(nameIdent, ctx.src)
  const paramList = requireChild(node, "ParamList", ctx.src)
  const params = childrenOf(paramList, "LowerIdent").map((n) =>
    text(n, ctx.src)
  )
  const cmdNode = requireChild(node, "Cmd", ctx.src)
  const body = buildCmd(cmdNode, ctx)
  return { name, params, body, loc: loc(node) }
}

function collectFunNames(tree: Tree, src: string): Set<string> {
  const out = new Set<string>()
  const cursor = tree.cursor()
  if (!cursor.firstChild()) return out
  do {
    if (cursor.name === "FunDef") {
      // Dive to FunName > LowerIdent.
      const node = cursor.node
      const funName = firstChild(node, "FunName")
      if (funName) {
        const lower = firstChild(funName, "LowerIdent")
        if (lower) out.add(src.slice(lower.from, lower.to))
      }
    }
  } while (cursor.nextSibling())
  return out
}

function collectParseErrors(tree: Tree, src: string): SParseError | null {
  let firstErr: SParseError | null = null
  const cursor = tree.cursor()
  do {
    if (cursor.type.isError) {
      if (!firstErr) {
        const snippet = src.slice(
          cursor.from,
          Math.min(cursor.to, cursor.from + 40)
        )
        firstErr = new SParseError(
          `syntax error near ${JSON.stringify(snippet)}`,
          cursor.from,
          cursor.to
        )
      }
    }
  } while (cursor.next())
  return firstErr
}

export interface ParseResult {
  prog: Prog
  tree: Tree
}

export function parseS(src: string): ParseResult {
  const parser = sParser()
  const tree = parser.parse(src)

  const err = collectParseErrors(tree, src)
  if (err) throw err

  const funNames = collectFunNames(tree, src)
  const ctx: BuildCtx = {
    src,
    ctrl: new Map(),
    nextLabel: 0,
    funNames,
  }

  const defs = new Map<string, Def>()
  const top = tree.topNode
  const funDefs = childrenOf(top, "FunDef")
  for (const d of funDefs) {
    const def = buildDef(d, ctx)
    if (defs.has(def.name)) {
      throw new SParseError(
        `duplicate function definition '${def.name}'`,
        d.from,
        d.to
      )
    }
    defs.set(def.name, def)
  }
  if (defs.size === 0) {
    throw new SParseError("program has no function definitions", 0, src.length)
  }
  const mainName = defs.has("main")
    ? "main"
    : funDefs[funDefs.length - 1]
      ? [...defs.keys()].pop()!
      : "main"

  return {
    prog: {
      defs,
      mainName,
      ctrl: ctx.ctrl,
    },
    tree,
  }
}
