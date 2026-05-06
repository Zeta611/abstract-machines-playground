declare module "@/lib/s/cek" {
  import type { Program } from "@/lib/s/ast"
  import type { Env, Val } from "@/lib/s/values"
  import type { List } from "melange/list"

  export interface Frame {
    label: number
    env: Env
  }

  export interface State {
    label: number
    env: Env
    kont: List<Frame>
  }

  export type RuleName = "LetExp" | "LetCall" | "Match" | "Return"

  export interface TraceStep {
    rule: RuleName
    detail?: string
    value?: Val
  }

  const traceEndBrand: unique symbol
  export type TraceEnd = { readonly [traceEndBrand]: never }
  export interface Trace {
    states: State[]
    steps: TraceStep[]
    end: TraceEnd
  }

  export function visit_trace_end<T>(
    traceEnd: TraceEnd,
    visitor: {
      final: (value: Val) => T
      stuck: (reason: string, at: State) => T
      maxed: (reason: string) => T
    }
  ): T
  export function run(
    prog: Program,
    initEnv: Env,
    opts?: { maxSteps?: number }
  ): Trace
}

declare module "@/lib/s/utils" {
  const mapBrand: unique symbol
  export type Map<K, V> = { readonly [mapBrand]: [K, V] }
  type MapModule<K> = {
    of_array<V>(arr: [K, V][]): Map<K, V>
    bindings<V>(map: Map<K, V>): [K, V][]
    cardinal<V>(map: Map<K, V>): number
    find_opt<V>(key: K, map: Map<K, V>): V | undefined
  }

  export const StringMap: MapModule<string>
  export const IntMap: MapModule<number>
}

declare module "@/lib/s/values" {
  import type { Map } from "@/lib/s/utils"

  const valBrand: unique symbol

  export type Val = { readonly [valBrand]: never }
  export interface IntPayload {
    n: number
  }

  export interface CtorPayload {
    tag: string
    args: Val[]
  }

  export type Env = Map<string, Val>
  export function vInt(n: number): Val

  export function visit<T>(
    value: Val,
    visitor: {
      int: (payload: IntPayload) => T
      ctor: (payload: CtorPayload) => T
    }
  ): T

  export function valEq(a: Val, b: Val): boolean
  export function showVal(value: Val): string
}

declare module "@/lib/s/ast" {
  import type { Map } from "@/lib/s/utils"

  export type Label = number

  export interface Loc {
    from: number
    to_: number
  }

  export namespace Exp {
    interface Exp {
      loc: Loc
    }
  }

  export namespace Cmd {
    interface Cmd {
      loc: Loc
      label: Label
    }
    function summary(cmd: Cmd): string
  }

  export interface Program {
    defs: Map<
      string,
      {
        name: string
        params: string[]
        body: Cmd.Cmd
        loc: Loc
      }
    >
    mainName: string
    ctrl: Map<Label, Cmd.Cmd>
  }
}

declare module "@/lib/s/parser" {
  import type { Program } from "@/lib/s/ast"
  import type { Result } from "melange/result"

  type SyntaxKind =
    | "keyword"
    | "identifier"
    | "constructor"
    | "number"
    | "comment"
    | "punctuation"
  type SyntaxRange = {
    kind: SyntaxKind
    from: number
    to_: number
  }

  type ParseResult = {
    program: Program
    ranges: SyntaxRange[]
  }

  export function parse(input: string): Result<ParseResult, string>
}

declare module "@/lib/s/envParser" {
  import type { Result } from "melange/result"
  import type { Env, Val } from "@/lib/s/values"

  export function parseValue1(input: string): Result<Val, string>
  export function parseEnv(input: string): Result<Env, string>
}

declare module "@/lib/s/traceQuery" {
  import type { Result } from "melange/result"
  import type { RuleName } from "@/lib/s/cek"

  const traceQueryAstBrand: unique symbol
  export type TraceQueryAst = { readonly [traceQueryAstBrand]: never }

  export function parseTraceQuery(
    input: string
  ): Result<TraceQueryAst | undefined, { message: string; at: number }>
  export function traceQueryMatches(
    ast: TraceQueryAst | undefined,
    row: {
      index: number
      rule?: RuleName
      detail?: string
      value?: string
      label: number
    }
  ): boolean
}
