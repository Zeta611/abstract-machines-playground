declare module "@/lib/libamp/libamp" { }

declare module "@/lib/libamp/prims" {
  import { Result } from "melange/result"
  import type { Val } from "@/lib/libamp/values"

  export function evalPrim(op: string, args: Val[]): Result<Val, string>
  export function isPrim(name: string): boolean
}

declare module "@/lib/libamp/utils" {
  const mapBrand: unique symbol
  export type Map<K, V> = { readonly [mapBrand]: [K, V] }
  export type MapModule<K> = {
    of_array<V>(arr: [K, V][]): Map<K, V>
    bindings<V>(map: Map<K, V>): [K, V][]
    cardinal<V>(map: Map<K, V>): number
    find_opt<V>(key: K, map: Map<K, V>): V | undefined
    add<V>(key: K, value: V, map: Map<K, V>): Map<K, V>
  }

  export const StringMap: MapModule<string>
  export const IntMap: MapModule<number>
}

declare module "@/lib/libamp/values" {
  import type { Map } from "@/lib/libamp/utils"

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
  export type EnvEntry = [string, Val]

  export function vInt(n: number): Val
  export function vCtor(tag: string, args: Val[]): Val

  export const vTrue: Val
  export const vFalse: Val

  export function withVal<T>(
    value: Val,
    visitor: {
      int: (payload: IntPayload) => T
      ctor: (payload: CtorPayload) => T
    }
  ): T

  export function isTrue(value: Val): boolean
  export function valEq(a: Val, b: Val): boolean
  export function showVal(value: Val): string
}

declare module "@/lib/libamp/ast" {
  import type { Map } from "@/lib/libamp/utils";

  export type Label = number

  export interface Loc {
    from: number
    to_: number
  }

  const expDescBrand: unique symbol

  export type ExpDesc = { readonly [expDescBrand]: never }
  export interface AppPayload {
    callee: string
    args: Expression[]
  }
  export interface Expression {
    desc: ExpDesc
    loc: Loc
  }

  export type ExpVisitor<T> = {
    num: (n: number) => T
    var_: (name: string) => T
    ctor: (payload: AppPayload) => T
    prim: (payload: AppPayload) => T
  }

  export namespace Exp {
    function visit<T>(
      exp: Expression,
      visitor: ExpVisitor<T>
    ): T
    function summary(exp: Expression): string
  }

  const cmdDescBrand: unique symbol

  export type CmdDesc = { readonly [cmdDescBrand]: never }
  export interface LetPayload {
    x: string
    exp: Expression
    body: Command
  }
  export interface LetCallPayload {
    x: string
    e: AppPayload
    body: Command
  }
  export interface MatchPayload {
    scrutinee: Expression
    branches: Branch[]
  }
  export interface Branch {
    tag: string
    vars: string[]
    body: Command
    loc: Loc
  }
  export interface Command {
    desc: CmdDesc
    loc: Loc
    label: Label
  }

  export type CmdVisitor<T> = {
    return: (exp: Expression) => T
    let_: (payload: LetPayload) => T
    letCall: (payload: LetCallPayload) => T
    match_: (payload: MatchPayload) => T
  }

  export namespace Cmd {
    function visit<T>(
      cmd: Command,
      visitor: CmdVisitor<T>
    ): T
    function summary(cmd: Command): string
  }

  export interface Def {
    name: string
    params: string[]
    body: Command
    loc: Loc
  }

  export interface Program {
    defs: Map<string, Def>
    mainName: string
    ctrl: Map<Label, Command>
  }
}

declare module "@/lib/libamp/parser" {
  import type { Program } from "@/lib/libamp/ast"
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
