import type { Exp } from "./ast"
import { PRIMS, PrimError } from "./prims"
import { vCtor, vInt } from "./values"
import type { Env, Val } from "./values"

/**
 * Pure expression interpretation from PDF Section 4.1:
 *
 *   E[[n]] rho         = n
 *   E[[x]] rho         = rho(x)
 *   E[[t<e_i>]] rho    = t<E[[e_i]] rho>
 *   E[[o(e_i)]] rho    = O[[o]](E[[e_i]] rho)
 *
 * Throws `EvalError` on an undefined variable or a failing primitive;
 * the CEK machine catches these to produce a `Stuck` trace step.
 */

export class EvalError extends Error {
  public readonly exp?: Exp
  constructor(message: string, exp?: Exp) {
    super(message)
    this.exp = exp
  }
}

export function evalExp(e: Exp, rho: Env): Val {
  switch (e.kind) {
    case "Num":
      return vInt(e.n)
    case "Var": {
      const v = rho.get(e.name)
      if (v === undefined) {
        throw new EvalError(`undefined variable '${e.name}'`, e)
      }
      return v
    }
    case "Ctor":
      return vCtor(
        e.tag,
        e.args.map((a) => evalExp(a, rho))
      )
    case "Prim": {
      const fn = PRIMS[e.op]
      if (!fn) {
        throw new EvalError(`unknown primitive '${e.op}'`, e)
      }
      const args = e.args.map((a) => evalExp(a, rho))
      try {
        return fn(args)
      } catch (err) {
        if (err instanceof PrimError) {
          throw new EvalError(err.message, e)
        }
        throw err
      }
    }
  }
}
