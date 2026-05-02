declare module "@/lib/libamp/foo" {
  export function bar(x: string): string
}

declare module "@/lib/libamp/libamp" {}

declare module "@/lib/libamp/prims" {
  import type { Result } from "melange/result.js"
  import type { Val } from "@/lib/libamp/values"

  export function evalPrim(op: string, args: Val[]): Result<Val, string>
  export function isPrim(name: string): boolean
}

declare module "melange/result.js" {
  export type Result<T, E> = { TAG: 0; _0: T } | { TAG: 1; _0: E }

  export function ok<T>(value: T): Result<T, never>
  export function error<E>(error: E): Result<never, E>
  export function value<T, E>(result: Result<T, E>, defaultValue: T): T
  export function get_ok<T, E>(result: Result<T, E>): T
  export function get_error<T, E>(result: Result<T, E>): E
  export function error_to_failure<T>(result: Result<T, string>): T
  export function bind<T, U, E>(
    result: Result<T, E>,
    f: (value: T) => Result<U, E>
  ): Result<U, E>
  export function join<T, E>(result: Result<Result<T, E>, E>): Result<T, E>
  export function map<T, U, E>(
    f: (value: T) => U,
    result: Result<T, E>
  ): Result<U, E>
  export function map_error<T, E, F>(
    f: (error: E) => F,
    result: Result<T, E>
  ): Result<T, F>
  export function fold<T, E, R>(
    ok: (value: T) => R,
    error: (error: E) => R,
    result: Result<T, E>
  ): R
  export function is_ok<T, E>(result: Result<T, E>): boolean
  export function is_error<T, E>(result: Result<T, E>): boolean
}

declare module "@/lib/libamp/values" {
  declare const valBrand: unique symbol
  declare const envBrand: unique symbol

  export type Val = { readonly [valBrand]: never }

  export interface IntPayload {
    n: number
  }

  export interface CtorPayload {
    tag: string
    args: Val[]
  }

  export type Env = { readonly [envBrand]: never }
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

  export function envGet(env: Env, name: string): Val | undefined
  export function envEntries(env: Env): EnvEntry[]
  export function envSize(env: Env): number
  export function envExtend(env: Env, name: string, value: Val): Env
  export function envExtendMany(env: Env, bindings: EnvEntry[]): Env
  export function envFromEntries(bindings: EnvEntry[]): Env
}

declare module "@/lib/libamp/ast" {
  export type Label = number

  export interface Loc {
    from: number
    to: number
  }

  declare const expBrand: unique symbol
  declare const cmdBrand: unique symbol

  export type Exp = { readonly [expBrand]: never }
  export type Cmd = { readonly [cmdBrand]: never }

  export interface Branch {
    tag: string
    vars: string[]
    body: Cmd
    loc: Loc
  }

  export interface Def {
    name: string
    params: string[]
    body: Cmd
    loc: Loc
  }

  export type ControlMap = Record<Label, Cmd>

  export interface Prog {
    defs: Record<string, Def>
    mainName: string
    ctrl: ControlMap
  }

  export function num(payload: { n: number }, loc: Loc): Exp
  export function var_(payload: { name: string }, loc: Loc): Exp
  export function ctor(payload: { tag: string; args: Exp[] }, loc: Loc): Exp
  export function prim(payload: { op: string; args: Exp[] }, loc: Loc): Exp

  export function return_(payload: { label: Label; exp: Exp }, loc: Loc): Cmd
  export { return_ as return }
  export function let_(
    payload: { label: Label; x: string; exp: Exp; body: Cmd },
    loc: Loc
  ): Cmd
  export { let_ as let }
  export function letCall(
    payload: {
      label: Label
      x: string
      fn: string
      args: Exp[]
      body: Cmd
    },
    loc: Loc
  ): Cmd
  export function match_(
    payload: { label: Label; scrutinee: Exp; branches: Branch[] },
    loc: Loc
  ): Cmd
  export { match_ as match }

  export function cmdLabel(cmd: Cmd): Label
  export function cmdLoc(cmd: Cmd): Loc

  export function withExp<T>(
    exp: Exp,
    visitor: {
      num: (payload: { n: number }, loc: Loc) => T
      var: (payload: { name: string }, loc: Loc) => T
      ctor: (payload: { tag: string; args: Exp[] }, loc: Loc) => T
      prim: (payload: { op: string; args: Exp[] }, loc: Loc) => T
    }
  ): T

  export function withCmd<T>(
    cmd: Cmd,
    visitor: {
      return: (payload: { label: Label; exp: Exp }, loc: Loc) => T
      let_: (
        payload: { label: Label; x: string; exp: Exp; body: Cmd },
        loc: Loc
      ) => T
      letCall: (
        payload: {
          label: Label
          x: string
          fn: string
          args: Exp[]
          body: Cmd
        },
        loc: Loc
      ) => T
      match_: (
        payload: { label: Label; scrutinee: Exp; branches: Branch[] },
        loc: Loc
      ) => T
    }
  ): T

  export function expSummary(exp: Exp): string
  export function cmdSummary(cmd: Cmd): string
}
