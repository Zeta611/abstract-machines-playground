import { withExp, type Exp } from "@/lib/libamp/ast"
import { envGet, vCtor, vInt, type Env, type Val } from "@/lib/libamp/values"
import { PRIMS, PrimError } from "./prims"

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
  return withExp(e, {
    num: ({ n }, _loc) => vInt(n),
    var: ({ name }, _loc) => {
      const v = envGet(rho, name)
      if (v === undefined) {
        throw new EvalError(`undefined variable '${name}'`, e)
      }
      return v
    },
    ctor: ({ tag, args }, _loc) => vCtor(
      tag,
      args.map((a) => evalExp(a, rho))
    ),
    prim: ({ op, args }, _loc) => {
      const fn = PRIMS[op]
      if (!fn) {
        throw new EvalError(`unknown primitive '${op}'`, e)
      }
      const vals = args.map((a) => evalExp(a, rho))
      try {
        return fn(vals)
      } catch (err) {
        if (err instanceof PrimError) {
          throw new EvalError(err.message, e)
        }
        throw err
      }
    },
  })
}
