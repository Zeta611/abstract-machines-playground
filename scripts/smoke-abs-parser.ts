/**
 * Smoke tests for the abstract env/store parser. Run with
 *
 *     bun run scripts/smoke-abs-parser.ts
 *
 * The script exits non-zero on failure.
 */

import { parse } from "@/lib/s/parser"
import { parseAbsEnvStore, parseAbsValue1 } from "@/lib/s/absEnvParser"
import { run_abs, view_cfg } from "@/lib/s/abs"
import { ABSTRACT_PROGRAM_PRESETS, PROGRAM_PRESETS } from "@/lib/examples"
import * as Result from "melange/result"

let failed = 0

function expect(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}${detail ? " \u2014 " + detail : ""}`)
  }
}

function expectOk<T>(name: string, result: any): T | null {
  return Result.fold(
    (value) => {
      expect(name, true)
      return value as T
    },
    (message) => {
      expect(name, false, String(message))
      return null
    },
    result
  )
}

function expectError(name: string, result: any, needle?: string): void {
  Result.fold(
    () => expect(name, false, "parsed successfully"),
    (message) =>
      expect(
        name,
        needle ? String(message).includes(needle) : true,
        String(message)
      ),
    result
  )
}

console.log("1. abstract value parser")
{
  expectOk("singleton int parses", parseAbsValue1("3"))
  expectOk("joined value parses", parseAbsValue1("{1|2|Foo(3,4)}"))
  expectOk("constructor arg can itself be joined", parseAbsValue1("Bar({5|6})"))
  expectError("lowercase ctor is rejected", parseAbsValue1("foo(3)"))
}

console.log("")
console.log("2. abstract env/store parser")
{
  expectOk(
    "env/store with nested joins parses",
    parseAbsEnvStore(`x = {1|2|Foo(3,4)}
y = Bar({5|6})
`)
  )

  expectOk(
    "blank lines between bindings parse",
    parseAbsEnvStore(`
x = 1

y = {2|3}
`)
  )

  expectError(
    "comma at top level is rejected",
    parseAbsEnvStore("x = 1, y = 2"),
    "syntax error"
  )
  expectError(
    "unterminated join is rejected",
    parseAbsEnvStore("x = {1|2"),
    "syntax error"
  )
}

console.log("")
console.log("3. abstract run integration")
{
  const source =
    PROGRAM_PRESETS.find((preset) => preset.id === "factorial")?.source ??
    PROGRAM_PRESETS[0].source

  const program = expectOk<{ program: any }>("factorial source parses", parse(source))
  const init = expectOk<any>(
    "abstract factorial input parses",
    parseAbsEnvStore("n = {0|1|2}")
  )

  if (program && init) {
    const run = expectOk<{ cfg: any; steps: number }>(
      "abstract run completes",
      run_abs(program.program, init, 12)
    )
    if (run) {
      const view = view_cfg(run.cfg)
      expect("reachable frames are exposed", view.frames.length > 0)
      expect("run records step count", run.steps > 0)
    }
  }
}

console.log("")
console.log("4. abstract presets parse")
{
  for (const preset of ABSTRACT_PROGRAM_PRESETS) {
    expectOk(`${preset.name} abstract env parses`, parseAbsEnvStore(preset.absEnvText))
  }
}

console.log("")
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`)
  process.exit(1)
}
console.log("all abstract parser smoke tests passed")
