declare module "@/lib/s/cek" {
  import type { Program, Label } from "@/lib/s/ast"
  import type { Env, Val } from "@/lib/s/values"
  import type { List } from "melange/list"

  export interface Frame {
    label: Label
    env: Env
  }

  export interface State {
    label: Label
    env: Env
    kont: List<Frame>
  }

  export type RuleName = "LetExp" | "LetTag" | "LetCall" | "Match" | "Return"

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
  import type { List } from "melange/list"
  const mapBrand: unique symbol
  export type Map<K, V> = { readonly [mapBrand]: [K, V] }
  export type MapModule<K> = {
    of_list<V>(arr: List<[K, V]>): Map<K, V>
    to_list<V>(map: Map<K, V>): List<[K, V]>
    cardinal<V>(map: Map<K, V>): number
    find_opt<V>(key: K, map: Map<K, V>): V | undefined
  }

  export const StringMap: MapModule<string>
  export const IntMap: MapModule<number>
}

declare module "@/lib/s/values" {
  import type { Map } from "@/lib/s/utils"
  import type { List } from "melange/list"

  const valBrand: unique symbol

  export type Val = { readonly [valBrand]: never }
  export interface IntPayload {
    n: number
  }

  export interface CtorPayload {
    tag: string
    args: List<Val>
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
  import type { Map, MapModule } from "@/lib/s/utils"

  const labelBrand: unique symbol
  export type Label = number & { readonly [labelBrand]: never }
  export const LabelMap: MapModule<Label>

  export interface Loc {
    from: number
    to_: number
  }

  export namespace Exp {
    interface Exp {
      loc: Loc
    }
    function summary(exp: Exp): string
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

declare module "@/lib/s/s_to_t" {
  import type { Program } from "@/lib/s/ast"
  import type { Trace } from "@/lib/s/cek"
  import type { Result } from "melange/result"

  const extractedTraceBrand: unique symbol
  export type ExtractedTrace = { readonly [extractedTraceBrand]: never }

  export interface ProjectedRowView {
    source_index: number
    control: string
    env: string
    kont: string[]
  }

  export function extract_trace(
    prog: Program,
    trace: Trace
  ): Result<ExtractedTrace, string>
  export function verify_trace(
    prog: Program,
    trace: Trace
  ): Result<void, string>
  export function view_trace(trace: ExtractedTrace): ProjectedRowView[]
  export function projected_length(trace: ExtractedTrace): number
}

declare module "@/lib/s/absEnvParser" {
  import type { Result } from "melange/result"
  import type { AbsEnv, AbsVStore } from "@/lib/s/abs"

  export function parseAbsValue1(input: string): Result<unknown, string>
  export function parseAbsEnvStore(
    input: string
  ): Result<[AbsEnv, AbsVStore], string>
}

declare module "@/lib/s/abs" {
  import type { Program } from "@/lib/s/ast"
  import type { Result } from "melange/result"

  const absEnvBrand: unique symbol
  const absVStoreBrand: unique symbol
  const absCfgBrand: unique symbol

  export type AbsEnv = { readonly [absEnvBrand]: never }
  export type AbsVStore = { readonly [absVStoreBrand]: never }
  export type AbsCfg = { readonly [absCfgBrand]: never }

  export interface AbsRun {
    cfg: AbsCfg
    steps: number
    stabilized: boolean
  }

  export interface AbsEnvRow {
    name: string
    addrs: string[]
  }

  export interface AbsVStoreRow {
    addr: string
    value: string
  }

  export interface AbsKStoreRow {
    addr: string
    time: string
    label: string
    env: AbsEnvRow[]
    kont: string[]
  }

  export interface AbsFrameRow {
    time: string
    label_ptn: string
    env: AbsEnvRow[]
    kont: string[]
  }

  export interface AbsCfgView {
    frames: AbsFrameRow[]
    vstore: AbsVStoreRow[]
    kstore: AbsKStoreRow[]
  }

  const mIntfBrand: unique symbol
  export interface MIntf {
    [mIntfBrand]: never
    run_abs(init: [AbsEnv, AbsVStore], fuel: number): Result<AbsRun, string>
    abs_inject(init: [AbsEnv, AbsVStore]): AbsCfg
    abs_transfer(cfg: AbsCfg): Result<AbsCfg, string>
    view_cfg(cfg: AbsCfg): AbsCfgView
  }

  export interface Param<LabelPtn> {
    ptn_of_label: (label: Label) => LabelPtn
    labels_of_ptn: (ptn: LabelPtn) => Label[]
    prog: Program
  }
  export function M(p: Param<LabelPtn>): MIntf
}

declare module "@/lib/s/abs_preset" {
  import type { Program } from "@/lib/s/ast"
  import type { Param } from "@/lib/s/abs"

  export function all_labels(prog: Program): Param<undefined>
  export function by_function(prog: Program): Param<string>
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
