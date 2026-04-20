/**
 * Smoke tests for the S lexer / parser / CEK machine. Run with
 *
 *     bun run scripts/smoke-cek.ts
 *
 * The script exits non-zero on failure.
 */

import { run } from "../lib/s/cek"
import { parseEnv, parseValue1 } from "../lib/s/env-parser"
import { INITIAL_ENV, INTERPRETER_S_T, TRIVIAL } from "../lib/s/examples"
import { parseS } from "../lib/s/parser"
import { showVal, valEq, vInt } from "../lib/s/values"
import type { Val } from "../lib/s/values"

let failed = 0

function expect(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}${detail ? " \u2014 " + detail : ""}`)
  }
}

function expectVal(name: string, got: Val | undefined, want: Val): void {
  expect(
    name,
    got !== undefined && valEq(got, want),
    got === undefined
      ? "got undefined"
      : `got ${showVal(got)}, want ${showVal(want)}`
  )
}

console.log("1. trivial: main(x) = let y = sub(x, 1) in y, x=3 -> 2")
{
  const { prog } = parseS(TRIVIAL)
  const env = parseEnv("x = 3")
  const trace = run(prog, env, { maxSteps: 100 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("value is 2", trace.end.value, vInt(2))
  }
  console.log(
    `   states=${trace.states.length}, steps=${trace.steps.length}, end=${trace.end.kind}`
  )
}

console.log("")
console.log("2. I_S^T on a T program")
{
  const { prog } = parseS(INTERPRETER_S_T)
  const env = parseEnv(INITIAL_ENV)
  const trace = run(prog, env, { maxSteps: 2_000 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("evaluates (0 - 1) to -1", trace.end.value, vInt(-1))
  }
  console.log(
    `   states=${trace.states.length}, steps=${trace.steps.length}, end=${trace.end.kind}`
  )
}

console.log("")
console.log("3. I_S^T: Ifz(X, Int(10), Int(20)) at X=0 -> 10")
{
  const { prog } = parseS(INTERPRETER_S_T)
  const env = new Map<string, Val>([
    ["p", parseValue1("Prog(Nil(), Ifz(X(), Int(10), Int(20)))")],
    ["arg", vInt(0)],
  ])
  const trace = run(prog, env, { maxSteps: 5_000 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("yields 10", trace.end.value, vInt(10))
  }
}

console.log("")
console.log("4. I_S^T: Ifz at X=5 -> 20 (else branch)")
{
  const { prog } = parseS(INTERPRETER_S_T)
  const env = new Map<string, Val>([
    ["p", parseValue1("Prog(Nil(), Ifz(X(), Int(10), Int(20)))")],
    ["arg", vInt(5)],
  ])
  const trace = run(prog, env, { maxSteps: 5_000 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("yields 20", trace.end.value, vInt(20))
  }
}

console.log("")
console.log("5. I_S^T: recursive T function (identity-ish)")
{
  // T program:
  //   f(x) = if x == 0 then 0 else f(x - 1) + 1 ... but T only has Sub and Ifz.
  //   Use: f(x) = Ifz(X, Int(0), App(Fun(0), Sub(X, Int(1)))).  Then f(3) = 0.
  const { prog } = parseS(INTERPRETER_S_T)
  const env = new Map<string, Val>([
    [
      "p",
      parseValue1(
        "Prog(Defs(Fun(0), Ifz(X(), Int(0), App(Fun(0), Sub(X(), Int(1)))), Nil()), App(Fun(0), Int(3)))"
      ),
    ],
    ["arg", vInt(0)],
  ])
  const trace = run(prog, env, { maxSteps: 20_000 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("yields 0", trace.end.value, vInt(0))
  }
  console.log(
    `   states=${trace.states.length}, steps=${trace.steps.length}, end=${trace.end.kind}`
  )
}

console.log("")
console.log("6. Stuck: undefined variable surfaces as trace.end = stuck")
{
  const { prog } = parseS(`main() = let y = nope in y`)
  const trace = run(prog, new Map(), { maxSteps: 10 })
  expect("stuck", trace.end.kind === "stuck")
  if (trace.end.kind === "stuck") {
    console.log(`   reason: ${trace.end.reason}`)
  }
}

console.log("")
console.log("7. Stuck: bad match surfaces cleanly")
{
  const { prog } = parseS(`main(x) =
  match x with
  | A(a) => a
  end
`)
  const env = parseEnv("x = 3")
  const trace = run(prog, env, { maxSteps: 10 })
  expect("stuck", trace.end.kind === "stuck")
  if (trace.end.kind === "stuck") {
    console.log(`   reason: ${trace.end.reason}`)
  }
}

console.log("")
console.log("8. Env parser: nested T program literal")
{
  const v = parseValue1(
    "Prog(Defs(Fun(0), Sub(X(), Int(1)), Nil()), App(Fun(0), Int(5)))"
  )
  expect(
    "shape",
    v.kind === "ctor" && v.tag === "Prog" && v.args.length === 2,
    `got ${showVal(v)}`
  )
}

console.log("")
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`)
  process.exit(1)
}
console.log("all smoke tests passed")
