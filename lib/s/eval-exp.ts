import { Exp, type Expression } from "@/lib/libamp/ast"
import { evalPrim } from "@/lib/libamp/prims"
import { StringMap } from "@/lib/libamp/utils"
import { vCtor, vInt, type Env, type Val } from "@/lib/libamp/values"
import { fold } from "melange/result"

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
  public readonly exp?: Expression
  constructor(message: string, exp?: Expression) {
    super(message)
    this.exp = exp
  }
}

export function evalExp(e: Expression, rho: Env): Val {
  return Exp.visit(e, {
    num: (n) => vInt(n),
    var_: (name) => {
      const v = StringMap.find_opt(name, rho)
      if (v === undefined) {
        throw new EvalError(`undefined variable '${name}'`, e)
      }
      return v
    },
    ctor: ({ callee: tag, args }) =>
      vCtor(
        tag,
        args.map((a) => evalExp(a, rho))
      ),
    prim: ({ callee: op, args }) => {
      const vals = args.map((a) => evalExp(a, rho))
      return fold(
        (value) => value,
        (message) => {
          throw new EvalError(message, e)
        },
        evalPrim(op, vals)
      )
    },
  })
}
