import type { Cmd, Label, Prog } from "./ast"
import { EvalError, evalExp } from "./eval-exp"
import { envExtend, envExtendMany, isTrue } from "./values"
import type { Env, Val } from "./values"

/**
 * CEK machine for language S.
 *
 * State   sigma = <ell, rho, kappa>
 *   ell    : label of current command
 *   rho    : environment
 *   kappa  : continuation, a list of suspended-call frames <ell_call, rho'>
 *
 * The machine implements five transition kinds corresponding to the four
 * reduction rules, plus [Return] which is triggered when control is at
 * a bare-expression ("return") command with a non-empty continuation.
 */

export interface Frame {
  label: Label
  env: Env
}

export interface State {
  label: Label
  env: Env
  kont: Frame[]
}

export type RuleName = "LetExp" | "LetCall" | "Match" | "Assert" | "Return"

export interface TraceStep {
  rule: RuleName
  /** Short human-readable annotation, e.g. "| true() matched at branch 0". */
  detail?: string
  /** Any intermediate value produced (bound by let, returned, matched, ...). */
  value?: Val
}

export type TraceEnd =
  | { kind: "final"; value: Val }
  | { kind: "stuck"; reason: string; at: State }
  | { kind: "maxed"; reason: string }

export interface Trace {
  states: State[]
  steps: TraceStep[]
  end: TraceEnd
}

/** Construct the initial state for program P with main(x_i) supplied by `rho`. */
export function inject(prog: Prog, rho: Env): State {
  const main = prog.defs.get(prog.mainName)
  if (!main) {
    throw new Error(`program has no entry function '${prog.mainName}'`)
  }
  // Main's formal params are looked up by name in `rho`; missing ones only
  // surface as EvalError('undefined variable ...') if actually referenced.
  return { label: main.body.label, env: rho, kont: [] }
}

/** Do one small-step. Returns the successor state and the step record, or
 *  a terminal result when no transition applies. */
export function step(
  s: State,
  prog: Prog
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "final"; value: Val }
  | { kind: "stuck"; reason: string } {
  const cmd = prog.ctrl.get(s.label)
  if (!cmd) {
    return { kind: "stuck", reason: `no command for label ${s.label}` }
  }

  try {
    switch (cmd.kind) {
      case "Return":
        return stepReturn(s, cmd, prog)
      case "Let":
        return stepLet(s, cmd)
      case "LetCall":
        return stepLetCall(s, cmd, prog)
      case "Match":
        return stepMatch(s, cmd)
      case "Assert":
        return stepAssert(s, cmd)
    }
  } catch (err) {
    if (err instanceof EvalError) {
      return { kind: "stuck", reason: err.message }
    }
    throw err
  }
}

function stepLet(
  s: State,
  cmd: Extract<Cmd, { kind: "Let" }>
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "stuck"; reason: string } {
  const v = evalExp(cmd.exp, s.env)
  const next: State = {
    label: cmd.body.label,
    env: envExtend(s.env, cmd.x, v),
    kont: s.kont,
  }
  return {
    kind: "step",
    next,
    record: { rule: "LetExp", value: v, detail: `${cmd.x} := ...` },
  }
}

function stepLetCall(
  s: State,
  cmd: Extract<Cmd, { kind: "LetCall" }>,
  prog: Prog
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "stuck"; reason: string } {
  const def = prog.defs.get(cmd.fn)
  if (!def) {
    return { kind: "stuck", reason: `undefined function '${cmd.fn}'` }
  }
  if (def.params.length !== cmd.args.length) {
    return {
      kind: "stuck",
      reason: `arity mismatch calling '${cmd.fn}': expected ${def.params.length}, got ${cmd.args.length}`,
    }
  }
  const argVals = cmd.args.map((a) => evalExp(a, s.env))
  const calleeEnv: Env = new Map()
  def.params.forEach((p, i) => calleeEnv.set(p, argVals[i]))

  const frame: Frame = { label: cmd.label, env: s.env }
  const next: State = {
    label: def.body.label,
    env: calleeEnv,
    kont: [frame, ...s.kont],
  }
  return {
    kind: "step",
    next,
    record: {
      rule: "LetCall",
      detail: `call ${cmd.fn}(${argVals.length} args) -> let ${cmd.x}`,
    },
  }
}

function stepMatch(
  s: State,
  cmd: Extract<Cmd, { kind: "Match" }>
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "stuck"; reason: string } {
  const v = evalExp(cmd.scrutinee, s.env)
  if (v.kind !== "ctor") {
    return {
      kind: "stuck",
      reason: `match on non-constructor value (got int ${v.n})`,
    }
  }
  for (let i = 0; i < cmd.branches.length; i++) {
    const b = cmd.branches[i]
    if (b.tag !== v.tag) continue
    if (b.vars.length !== v.args.length) {
      return {
        kind: "stuck",
        reason: `branch '${b.tag}' arity ${b.vars.length} vs value arity ${v.args.length}`,
      }
    }
    const bindings: [string, Val][] = b.vars.map((x, j) => [x, v.args[j]])
    const next: State = {
      label: b.body.label,
      env: envExtendMany(s.env, bindings),
      kont: s.kont,
    }
    return {
      kind: "step",
      next,
      record: {
        rule: "Match",
        value: v,
        detail: `| ${b.tag}(${b.vars.join(", ")}) matched (branch ${i})`,
      },
    }
  }
  return {
    kind: "stuck",
    reason: `no branch matched tag '${v.tag}'`,
  }
}

function stepAssert(
  s: State,
  cmd: Extract<Cmd, { kind: "Assert" }>
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "stuck"; reason: string } {
  const v = evalExp(cmd.exp, s.env)
  if (!isTrue(v)) {
    return { kind: "stuck", reason: `assertion failed (value is not true())` }
  }
  const next: State = {
    label: cmd.body.label,
    env: s.env,
    kont: s.kont,
  }
  return { kind: "step", next, record: { rule: "Assert", value: v } }
}

function stepReturn(
  s: State,
  cmd: Extract<Cmd, { kind: "Return" }>,
  prog: Prog
):
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "final"; value: Val }
  | { kind: "stuck"; reason: string } {
  const v = evalExp(cmd.exp, s.env)
  if (s.kont.length === 0) {
    return { kind: "final", value: v }
  }
  const [top, ...rest] = s.kont
  const suspended = prog.ctrl.get(top.label)
  if (!suspended || suspended.kind !== "LetCall") {
    return {
      kind: "stuck",
      reason: `continuation head is not a let-call (found ${suspended?.kind ?? "<unknown>"})`,
    }
  }
  const next: State = {
    label: suspended.body.label,
    env: envExtend(top.env, suspended.x, v),
    kont: rest,
  }
  return {
    kind: "step",
    next,
    record: {
      rule: "Return",
      value: v,
      detail: `return into ${suspended.x}`,
    },
  }
}

export interface RunOptions {
  maxSteps?: number
}

export function run(prog: Prog, initEnv: Env, opts: RunOptions = {}): Trace {
  const maxSteps = opts.maxSteps ?? 10_000
  const s0 = inject(prog, initEnv)
  const states: State[] = [s0]
  const steps: TraceStep[] = []

  let cur = s0
  for (let i = 0; i < maxSteps; i++) {
    const r = step(cur, prog)
    if (r.kind === "final") {
      return { states, steps, end: { kind: "final", value: r.value } }
    }
    if (r.kind === "stuck") {
      return {
        states,
        steps,
        end: { kind: "stuck", reason: r.reason, at: cur },
      }
    }
    states.push(r.next)
    steps.push(r.record)
    cur = r.next
  }
  return {
    states,
    steps,
    end: {
      kind: "maxed",
      reason: `exceeded maxSteps=${maxSteps}`,
    },
  }
}
