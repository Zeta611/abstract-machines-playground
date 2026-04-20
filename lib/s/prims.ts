import { V_FALSE, V_TRUE, vInt, valEq } from "./values"
import type { Val } from "./values"

/**
 * Primitive registry. Corresponds to `O[[-]] : Prim -> Val* -> Val`.
 * Primitives are total on valid argument shapes and throw `PrimError` otherwise;
 * the CEK machine catches these to produce a `Stuck` trace step.
 */

export class PrimError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export type Prim = (args: Val[]) => Val

function expectInt(v: Val, op: string, idx: number): number {
  if (v.kind !== "int") {
    throw new PrimError(
      `primitive ${op}: argument ${idx} expected int, got ${v.kind === "ctor" ? v.tag + "(...)" : "?"}`
    )
  }
  return v.n
}

function expectArity(op: string, args: Val[], n: number): void {
  if (args.length !== n) {
    throw new PrimError(
      `primitive ${op}: expected ${n} argument(s), got ${args.length}`
    )
  }
}

export const PRIMS: Record<string, Prim> = {
  sub: (args) => {
    expectArity("sub", args, 2)
    return vInt(expectInt(args[0], "sub", 0) - expectInt(args[1], "sub", 1))
  },
  add: (args) => {
    expectArity("add", args, 2)
    return vInt(expectInt(args[0], "add", 0) + expectInt(args[1], "add", 1))
  },
  mul: (args) => {
    expectArity("mul", args, 2)
    return vInt(expectInt(args[0], "mul", 0) * expectInt(args[1], "mul", 1))
  },
  iszero: (args) => {
    expectArity("iszero", args, 1)
    return expectInt(args[0], "iszero", 0) === 0 ? V_TRUE : V_FALSE
  },
  eq: (args) => {
    expectArity("eq", args, 2)
    return valEq(args[0], args[1]) ? V_TRUE : V_FALSE
  },
  lt: (args) => {
    expectArity("lt", args, 2)
    return expectInt(args[0], "lt", 0) < expectInt(args[1], "lt", 1)
      ? V_TRUE
      : V_FALSE
  },
  not: (args) => {
    expectArity("not", args, 1)
    const v = args[0]
    if (v.kind !== "ctor" || (v.tag !== "true" && v.tag !== "false")) {
      throw new PrimError(`primitive not: expected boolean, got non-boolean`)
    }
    return v.tag === "true" ? V_FALSE : V_TRUE
  },
}

export function isPrim(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRIMS, name)
}
