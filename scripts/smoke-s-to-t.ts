/**
 * Smoke tests for extracting the T abstract machine from S CEK traces.
 *
 *     bun run scripts/smoke-s-to-t.ts
 */

import { run, visit_trace_end } from "@/lib/s/cek"
import { parseEnv } from "@/lib/s/envParser"
import { parse } from "@/lib/s/parser"
import {
  extract_trace,
  projected_length,
  verify_trace,
  view_trace,
} from "@/lib/s/s_to_t"
import {
  INITIAL_ENV,
  INTERPRETER_S_T,
  INTERPRETER_S_T_ALPHA_CONV,
} from "@/lib/examples"
import * as Result from "melange/result"

let failed = 0

function expect(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  OK ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? " - " + detail : ""}`)
  }
}

function parseProgram(src: string) {
  return Result.fold(
    (value) => value.program,
    (message) => {
      throw new Error(`parse error: ${message}`)
    },
    parse(src)
  )
}

function parseEnvOrThrow(src: string) {
  return Result.fold(
    (env) => env,
    (message) => {
      throw new Error(`env parse error: ${message}`)
    },
    parseEnv(src)
  )
}

function parseFails(name: string, src: string): void {
  expect(
    name,
    Result.fold(
      () => false,
      () => true,
      parse(src)
    )
  )
}

function envForArg(arg: number): string {
  return INITIAL_ENV.replace("arg = 5", `arg = ${arg}`)
}

function alphaEnvForArg(arg: number): string {
  return envForArg(arg)
    .replace(/^p =/m, "p1 =")
    .replace(/^arg =/m, "arg1 =")
}

function runExtract(source: string, envText: string, maxSteps = 20_000) {
  const program = parseProgram(source)
  const trace = run(program, parseEnvOrThrow(envText), { maxSteps })
  const end = visit_trace_end(trace.end, {
    final: () => "final",
    stuck: (reason: string) => `stuck: ${reason}`,
    maxed: (reason: string) => `maxed: ${reason}`,
  })
  const extracted = Result.fold(
    (value) => value,
    (message) => {
      throw new Error(`extract error: ${message}`)
    },
    extract_trace(program, trace)
  )
  return { program, trace, end, extracted }
}

function expectFinalControl(
  name: string,
  source: string,
  envText: string,
  value: string
): void {
  const { program, trace, end, extracted } = runExtract(source, envText)
  expect(`${name}: S trace terminates`, end === "final", end)
  expect(
    `${name}: projected trace verifies`,
    Result.fold(
      () => true,
      (message) => {
        console.log(`   verify error: ${message}`)
        return false
      },
      verify_trace(program, trace)
    )
  )
  const rows = view_trace(extracted)
  const last = rows[rows.length - 1]
  expect(`${name}: projection is nonempty`, projected_length(extracted) > 0)
  expect(
    `${name}: final projected control is ${value}`,
    last?.control === value,
    last ? `got ${last.control}` : "got no projected rows"
  )
}

console.log("1. parser rejects non-ANF function and tag arguments")
parseFails(
  "nested function call rejected",
  `f(n1) =
  let r = f(f(n1)) in r`
)
parseFails(
  "function call with primitive argument rejected",
  `f(n1) =
  let r = f(sub(n1, 1)) in r`
)
parseFails(
  "constructor with integer argument rejected",
  `main(x, y) =
  let p = Pair(1, y) in p`
)
parseFails(
  "constructor with primitive argument rejected",
  `main(x, y) =
  let p = Pair(sub(x, 1), y) in p`
)
expect(
  "variable-only constructor accepted",
  Result.fold(
    () => true,
    () => false,
    parse(`main(x, y) =
  let p = Pair(x, y) in p`)
  )
)

console.log("")
console.log("2. canonical interpreter projections")
expectFinalControl("factorial arg=1", INTERPRETER_S_T, envForArg(1), "1")
expectFinalControl("factorial arg=5", INTERPRETER_S_T, envForArg(5), "120")

console.log("")
console.log("3. alpha-converted interpreter projection")
expectFinalControl(
  "alpha factorial arg=1",
  INTERPRETER_S_T_ALPHA_CONV,
  alphaEnvForArg(1),
  "1"
)

console.log("")
console.log("4. malformed extraction inputs return Error")
{
  const program = parseProgram(INTERPRETER_S_T)
  const trace = run(program, parseEnvOrThrow("arg = 1"), { maxSteps: 10 })
  expect(
    "missing program binding returns Error",
    Result.fold(
      () => false,
      () => true,
      extract_trace(program, trace)
    )
  )
}

console.log("")
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`)
  process.exit(1)
}
console.log("all S-to-T smoke tests passed")
