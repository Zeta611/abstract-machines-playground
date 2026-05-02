import {
  cmdLabel,
  withCmd,
  type Branch,
  type Cmd,
  type Exp,
  type Label,
  type Prog,
} from "@/lib/libamp/ast"
import {
  withVal,
  type Env,
  type Val,
} from "@/lib/libamp/values"
import { EvalError, evalExp } from "./eval-exp"
import * as StringMap from "@/lib/libamp/stringMap"

/**
 * CEK machine for language S.
 *
 * State   sigma = <ell, rho, kappa>
 *   ell    : label of current command
 *   rho    : environment
 *   kappa  : continuation, a list of suspended-call frames <ell_call, rho'>
 *
 * The machine implements transition kinds for let-expressions, let-calls,
 * matches, and [Return], which is triggered when control is at a
 * bare-expression ("return") command with a non-empty continuation.
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

export type RuleName = "LetExp" | "LetCall" | "Match" | "Return"

export interface TraceStep {
  rule: RuleName
  /** Short human-readable annotation, e.g. "| True() matched at branch 0". */
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

type StepResult =
  | { kind: "step"; next: State; record: TraceStep }
  | { kind: "final"; value: Val }
  | { kind: "stuck"; reason: string }

/** Construct the initial state for program P with main(x_i) supplied by `rho`. */
export function inject(prog: Prog, rho: Env): State {
  const main = prog.defs[prog.mainName]
  if (!main) {
    throw new Error(`program has no entry function '${prog.mainName}'`)
  }
  // Main's formal params are looked up by name in `rho`; missing ones only
  // surface as EvalError('undefined variable ...') if actually referenced.
  return { label: cmdLabel(main.body), env: rho, kont: [] }
}

/** Do one small-step. Returns the successor state and the step record, or
 *  a terminal result when no transition applies. */
export function step(s: State, prog: Prog): StepResult {
  const cmd = prog.ctrl[s.label]
  if (!cmd) {
    return { kind: "stuck", reason: `no command for label ${s.label}` }
  }

  try {
    return withCmd(cmd, {
      return: (payload, _loc) => stepReturn(s, payload, prog),
      let_: (payload, _loc) => stepLet(s, payload),
      letCall: (payload, _loc) => stepLetCall(s, payload, prog),
      match_: (payload, _loc) => stepMatch(s, payload),
    })
  } catch (err) {
    if (err instanceof EvalError) {
      return { kind: "stuck", reason: err.message }
    }
    throw err
  }
}

const stepLet = (
  s: State,
  cmd: { label: Label; x: string; exp: Exp; body: Cmd }
): StepResult => {
  const v = evalExp(cmd.exp, s.env)
  const next: State = {
    label: cmdLabel(cmd.body),
    env: StringMap.add(cmd.x, v, s.env),
    kont: s.kont,
  }
  return {
    kind: "step",
    next,
    record: { rule: "LetExp", value: v, detail: `${cmd.x} := ...` },
  }
}

const stepLetCall = (
  s: State,
  cmd: { label: Label; x: string; fn: string; args: Exp[]; body: Cmd },
  prog: Prog
): StepResult => {
  const def = prog.defs[cmd.fn]
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
  const calleeEnv = StringMap.of_array(def.params.map((p, i) => [p, argVals[i]]))

  const frame: Frame = { label: cmd.label, env: s.env }
  const next: State = {
    label: cmdLabel(def.body),
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

const stepMatch = (
  s: State,
  cmd: { label: Label; scrutinee: Exp; branches: Branch[] }
): StepResult => {
  const v = evalExp(cmd.scrutinee, s.env)
  return withVal<StepResult>(v, {
    int: ({ n }) => ({
      kind: "stuck",
      reason: `match on non-constructor value (got int ${n})`,
    }),
    ctor: ({ tag, args }) => {
      for (let i = 0; i < cmd.branches.length; i++) {
        const b = cmd.branches[i]
        if (b.tag !== tag) continue
        if (b.vars.length !== args.length) {
          return {
            kind: "stuck",
            reason: `branch '${b.tag}' arity ${b.vars.length} vs value arity ${args.length}`,
          }
        }
        const bindings: [string, Val][] = b.vars.map((x, j) => [x, args[j]])
        const next: State = {
          label: cmdLabel(b.body),
          env: bindings.reduce(((env, [x, v]) => StringMap.add(x, v, env)), s.env),
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
        reason: `no branch matched tag '${tag}'`,
      }
    },
  })
}

const stepReturn = (
  s: State,
  cmd: { label: Label; exp: Exp },
  prog: Prog
): StepResult => {
  const v = evalExp(cmd.exp, s.env)
  if (s.kont.length === 0) {
    return { kind: "final", value: v }
  }
  const [top, ...rest] = s.kont
  const suspended = prog.ctrl[top.label]
  if (!suspended) {
    return {
      kind: "stuck",
      reason: "continuation head is not a let-call (found <unknown>)",
    }
  }
  return withCmd<StepResult>(suspended, {
    letCall: ({ x, body }, _loc) => {
      const next: State = {
        label: cmdLabel(body),
        env: StringMap.add(x, v, top.env),
        kont: rest,
      }
      return {
        kind: "step",
        next,
        record: {
          rule: "Return",
          value: v,
          detail: `return into ${x}`,
        },
      }
    },
    return: (_payload, _loc) => ({
      kind: "stuck",
      reason: "continuation head is not a let-call (found Return)",
    }),
    let_: (_payload, _loc) => ({
      kind: "stuck",
      reason: "continuation head is not a let-call (found Let)",
    }),
    match_: (_payload, _loc) => ({
      kind: "stuck",
      reason: "continuation head is not a let-call (found Match)",
    }),
  })
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
