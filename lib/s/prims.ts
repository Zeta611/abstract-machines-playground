import {
  vFalse,
  vInt,
  vTrue,
  valEq,
  withVal,
  type Val,
} from "@/lib/libamp/values"

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
  return withVal(v, {
    int: ({ n }) => n,
    ctor: ({ tag }) => {
      throw new PrimError(
        `primitive ${op}: argument ${idx} expected int, got ${tag}(...)`
      )
    },
  })
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
    return expectInt(args[0], "iszero", 0) === 0 ? vTrue : vFalse
  },
  eq: (args) => {
    expectArity("eq", args, 2)
    return valEq(args[0], args[1]) ? vTrue : vFalse
  },
  lt: (args) => {
    expectArity("lt", args, 2)
    return expectInt(args[0], "lt", 0) < expectInt(args[1], "lt", 1)
      ? vTrue
      : vFalse
  },
  not: (args) => {
    expectArity("not", args, 1)
    return withVal(args[0], {
      int: () => {
        throw new PrimError(`primitive not: expected boolean, got non-boolean`)
      },
      ctor: ({ tag }) => {
        if (tag !== "True" && tag !== "False") {
          throw new PrimError(
            `primitive not: expected boolean, got non-boolean`
          )
        }
        return tag === "True" ? vFalse : vTrue
      },
    })
  },
}

export function isPrim(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRIMS, name)
}
