/**
 * Smoke tests for the S lexer / parser / CEK machine. Run with
 *
 *     bun run scripts/smoke-cek.ts
 *
 * The script exits non-zero on failure.
 */

import * as StringMap from "@/lib/libamp/stringMap"
import { run } from "../lib/s/cek"
import { parseEnv, parseValue1 } from "../lib/s/env-parser"
import {
  INITIAL_ENV,
  INTERPRETER_S_T,
  PROGRAM_PRESETS,
  TRIVIAL,
} from "../lib/s/examples"
import { parseS } from "../lib/s/parser"
import {
  showVal,
  valEq,
  vInt,
  withVal,
  type Val,
} from "@/lib/libamp/values"

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

function expectParseFails(name: string, src: string): void {
  try {
    parseS(src)
    expect(name, false, "parsed successfully")
  } catch {
    expect(name, true)
  }
}

function expectValueParseFails(name: string, src: string): void {
  try {
    parseValue1(src)
    expect(name, false, "parsed successfully")
  } catch {
    expect(name, true)
  }
}

function expectUnknownPrimitive(name: string, src: string): void {
  const { prog } = parseS(src)
  const trace = run(prog, StringMap.of_array([]), { maxSteps: 10 })
  expect(
    name,
    trace.end.kind === "stuck" &&
    trace.end.reason.startsWith("unknown primitive"),
    trace.end.kind === "stuck" ? trace.end.reason : trace.end.kind
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
    expectVal("evaluates fact(5) to 120", trace.end.value, vInt(120))
  }
  console.log(
    `   states=${trace.states.length}, steps=${trace.steps.length}, end=${trace.end.kind}`
  )
}

console.log("")
console.log("3. I_S^T: Ifz(X, Int(10), Int(20)) at X=0 -> 10")
{
  const { prog } = parseS(INTERPRETER_S_T)
  const env = StringMap.of_array([
    [
      "p",
      parseValue1("Prog(Nil(), Ifz(0, Var(1, 0), Int(2, 10), Int(3, 20)))"),
    ],
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
  const env = StringMap.of_array([
    [
      "p",
      parseValue1("Prog(Nil(), Ifz(0, Var(1, 0), Int(2, 10), Int(3, 20)))"),
    ],
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
  //   Use: f(x) = Ifz(x, Int(0), App(Fun(0), Sub(x, Int(1)))).  Then f(3) = 0.
  const { prog } = parseS(INTERPRETER_S_T)
  const env = StringMap.of_array([
    [
      "p",
      parseValue1(
        "Prog(Defs(Fun(0), Ifz(0, Var(1, 0), Int(2, 0), App(3, Fun(0), Sub(4, Var(5, 0), Int(6, 1)))), Nil()), App(7, Fun(0), Int(8, 3)))"
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
console.log("6. I_S^T: Let binds T variables by xid")
{
  const { prog } = parseS(INTERPRETER_S_T)
  const env = StringMap.of_array([
    [
      "p",
      parseValue1(
        "Prog(Nil(), Let(0, Var(1, 1), Int(2, 7), Sub(3, Var(4, 1), Var(5, 0))))"
      ),
    ],
    ["arg", vInt(2)],
  ])
  const trace = run(prog, env, { maxSteps: 5_000 })
  expect("terminates", trace.end.kind === "final")
  if (trace.end.kind === "final") {
    expectVal("yields 5", trace.end.value, vInt(5))
  }
}

console.log("")
console.log("7. Stuck: undefined variable surfaces as trace.end = stuck")
{
  const { prog } = parseS(`main() = let y = nope in y`)
  const trace = run(prog, StringMap.of_array([]), { maxSteps: 10 })
  expect("stuck", trace.end.kind === "stuck")
  if (trace.end.kind === "stuck") {
    console.log(`   reason: ${trace.end.reason}`)
  }
}

console.log("")
console.log("8. Stuck: bad match surfaces cleanly")
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
console.log("9. Presets all parse and terminate")
{
  const expected: Record<string, Val> = {
    "definitional-interpreter": vInt(120),
    factorial: vInt(3628800),
    fibonacci: vInt(13),
    "mutual-parity": parseValue1("False()"),
    "peano-addition": parseValue1("S(S(S(S(S(Z())))))"),
  }

  for (const preset of PROGRAM_PRESETS) {
    const { prog } = parseS(preset.source)
    const env = parseEnv(preset.envText)
    const trace = run(prog, env, { maxSteps: 5_000 })
    expect(`${preset.name} terminates`, trace.end.kind === "final")
    if (trace.end.kind === "final") {
      expectVal(`${preset.name} value`, trace.end.value, expected[preset.id])
    }
    console.log(
      `   ${preset.id}: states=${trace.states.length}, steps=${trace.steps.length}, end=${trace.end.kind}`
    )
  }
}

console.log("")
console.log("10. S grammar rejects removed constructs")
{
  expectParseFails(
    "assert construct no longer parses",
    "main() = assert True() in 1"
  )
  expectUnknownPrimitive(
    "lowercase true is a primitive call",
    "main() = true()"
  )
  expectUnknownPrimitive(
    "lowercase false is a primitive call",
    "main() = false()"
  )
  expectValueParseFails("env lowercase true is rejected", "true()")
  expectValueParseFails("env lowercase false is rejected", "false()")
}

console.log("")
console.log("11. Env parser: nested T program literal")
{
  const v = parseValue1(
    "Prog(Defs(Fun(0), Sub(0, Var(1, 0), Int(2, 1)), Nil()), App(3, Fun(0), Int(4, 5)))"
  )
  expect(
    "shape",
    withVal(v, {
      int: () => false,
      ctor: ({ tag, args }) => tag === "Prog" && args.length === 2,
    }),
    `got ${showVal(v)}`
  )
}

console.log("")
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`)
  process.exit(1)
}
console.log("all smoke tests passed")
