/**
 * Reference programs used by the playground and smoke tests.
 *
 * `INTERPRETER_S_T` implements the definitional interpreter `I_S^T`.
 * `INTERPRETER_S_T_ALPHA_CONV` is alpha-converted for abstract interpretation.
 */

export const INTERPRETER_S_T = `# Interpreter I_S^T for language T.
#
# T syntax (encoded as S constructor values):
#   prog  ::= Prog(defs, exp)
#   defs  ::= Defs(Fun(int), exp, defs) | Nil()
#   env   ::= Env(Var(int, int), int, env) | Nil()
#   exp   ::= Int(int, int) | Var(int, int) | Sub(int, exp, exp) | Mul(int, exp, exp)
#           | Let(int, Var(int, int), exp, exp) | App(int, Fun(int), exp)
#           | Ifz(int, exp, exp, exp)

fundef(defs, fid) =
  match defs with
  | Defs(f, body, rest) =>
    match f with
    | Fun(fid2) =>
      match iszero(sub(fid, fid2)) with
      | True() => body
      | False() => let r = fundef(rest, fid) in r
      end
    end
  end

lookup(env, xid) =
  match env with
  | Env(x, val, rest) =>
    match x with
    | Var(l, xid2) =>
      match iszero(sub(xid, xid2)) with
      | True() => val
      | False() => let r = lookup(rest, xid) in r
      end
    end
  end

extend(env, x, val) =
  let r = Env(x, val, env) in r

eval(e, env, defs) =
  match e with
  | Int(l, n) => n
  | Var(l, xid) =>
    let v = lookup(env, xid) in v
  | Sub(l, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let v2 = eval(e2, env, defs) in
    sub(v1, v2)
  | Mul(l, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let v2 = eval(e2, env, defs) in
    mul(v1, v2)
  | Let(l, x, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let new_env = extend(env, x, v1) in
    let r = eval(e2, new_env, defs) in r
  | App(l, f, e1) =>
    match f with
    | Fun(fid) =>
      let v = eval(e1, env, defs) in
      let body = fundef(defs, fid) in
      let empty_env = Nil() in
      let x = Var(0, 0) in
      let call_env = extend(empty_env, x, v) in
      let r = eval(body, call_env, defs) in r
    end
  | Ifz(l, e1, e2, e3) =>
    let v1 = eval(e1, env, defs) in
    match iszero(v1) with
    | True() => let r = eval(e2, env, defs) in r
    | False() => let r = eval(e3, env, defs) in r
    end
  end

main(p, arg) =
  match p with
  | Prog(defs, e) =>
    let empty_env = Nil() in
    let x = Var(0, 0) in
    let initial_env = extend(empty_env, x, arg) in
    let r = eval(e, initial_env, defs) in r
  end
`

export const INTERPRETER_S_T_ALPHA_CONV = `# Interpreter I_S^T for language T.
#
# T syntax (encoded as S constructor values):
#   prog  ::= Prog(defs, exp)
#   defs  ::= Defs(Fun(int), exp, defs) | Nil()
#   env   ::= Env(Var(int, int), int, env) | Nil()
#   exp   ::= Int(int, int) | Var(int, int) | Sub(int, exp, exp) | Mul(int, exp, exp)
#           | Let(int, Var(int, int), exp, exp) | App(int, Fun(int), exp)
#           | Ifz(int, exp, exp, exp)

fundef(defs1, fid1) =
  match defs1 with
  | Defs(f1, body1, rest1) =>
    match f1 with
    | Fun(fid2) =>
      match iszero(sub(fid1, fid2)) with
      | True() => body1
      | False() => let r1 = fundef(rest1, fid1) in r1
      end
    end
  end

lookup(env1, xid1) =
  match env1 with
  | Env(x1, val1, rest2) =>
    match x1 with
    | Var(l1, xid2) =>
      match iszero(sub(xid1, xid2)) with
      | True() => val1
      | False() => let r2 = lookup(rest2, xid1) in r2
      end
    end
  end

extend(env2, x2, val2) =
  let r3 = Env(x2, val2, env2) in r3

eval(e1, env3, defs2) =
  match e1 with
  | Int(l2, n1) => n1
  | Var(l3, xid3) =>
    let v1 = lookup(env3, xid3) in v1
  | Sub(l4, e2, e3) =>
    let v2 = eval(e2, env3, defs2) in
    let v3 = eval(e3, env3, defs2) in
    let r4 = sub(v2, v3) in r4
  | Mul(l5, e4, e5) =>
    let v4 = eval(e4, env3, defs2) in
    let v5 = eval(e5, env3, defs2) in
    let r5 = mul(v4, v5) in r5
  | Let(l6, x3, e6, e7) =>
    let v6 = eval(e6, env3, defs2) in
    let env4 = extend(env3, x3, v6) in
    let r6 = eval(e7, env4, defs2) in r6
  | App(l7, f2, e8) =>
    match f2 with
    | Fun(fid3) =>
      let v7 = eval(e8, env3, defs2) in
      let body2 = fundef(defs2, fid3) in
      let env5 = Nil() in
      let x4 = Var(0, 0) in
      let env6 = extend(env5, x4, v7) in
      let r7 = eval(body2, env6, defs2) in r7
    end
  | Ifz(l8, e9, e10, e11) =>
    let v8 = eval(e9, env3, defs2) in
    match iszero(v8) with
    | True() => let r8 = eval(e10, env3, defs2) in r8
    | False() => let r9 = eval(e11, env3, defs2) in r9
    end
  end

main(p1, arg1) =
  match p1 with
  | Prog(defs3, e12) =>
    let env7 = Nil() in
    let x5 = Var(0, 0) in
    let env8 = extend(env7, x5, arg1) in
    let r10 = eval(e12, env8, defs3) in r10
  end
`

/** A trivial S program used for sanity checks. */
export const TRIVIAL = `main(x) =
  let y = sub(x, 1) in y
`

/**
 * Default initial environment for the playground
 */
export const INITIAL_ENV = `# A T program computing factorial, encoded as S constructor values.
#   fact(n) = ifz n then 1 else n * fact(n - 1)
# Fun(0) is fact; main applies it to the input arg.
p1 = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg1 = 5
`

export interface ProgramPreset {
  id: string
  name: string
  source: string
  envText: string
}

export interface AbstractProgramPreset {
  id: string
  name: string
  source: string
  absEnvText: string
}

export const DEFAULT_PRESET_ID = "definitional-interpreter"

const FACTORIAL = `fact(n1) =
  match iszero(n1) with
  | True() =>
    let x1 = 1 in x1
  | False() =>
    let n2 = sub(n1, 1) in
    let m1 = fact(n2) in
    let r1 = mul(n1, m1) in r1
  end
`

const FACTORIAL_ENV = `n1 = 10
`

const FIBONACCI = `fib(n1) =
  match iszero(n1) with
  | True() =>
    let x1 = 0 in x1
  | False() =>
    match iszero(sub(n1, 1)) with
    | True() =>
      let x2 = 1 in x2
    | False() =>
      let n2 = sub(n1, 1) in
      let a1 = fib(n2) in
      let n3 = sub(n1, 2) in
      let b1 = fib(n3) in
      let r1 = add(a1, b1) in r1
    end
  end
`

const FIBONACCI_ENV = `n1 = 7
`

const MUTUAL_PARITY = `even(n1) =
  match iszero(n1) with
  | True() =>
    let x1 = True() in x1
  | False() =>
    let n2 = sub(n1, 1) in
    let r1 = odd(n2) in r1
  end

odd(n3) =
  match iszero(n3) with
  | True() =>
    let x2 = False() in x2
  | False() =>
    let n4 = sub(n3, 1) in
    let r2 = even(n4) in r2
  end

main(n5) =
  let r3 = even(n5) in r3
`

const MUTUAL_PARITY_ENV = `n5 = 7
`

const PEANO_ADDITION = `addPeano(pair1) =
  match pair1 with
  | Pair(x1, y1) =>
    match x1 with
    | Z() => y1
    | S(x2) =>
      let y2 = S(y1) in
      let pair2 = Pair(x2, y2) in
      let r1 = addPeano(pair2) in r1
    end
  end
`

const PEANO_ADDITION_ENV = `pair1 = Pair(S(S(S(Z()))), S(S(Z())))
`

const FACTORIAL_ABS_ENV = `n1 = {0|1|2|3}
`

const FIBONACCI_ABS_ENV = `n1 = {0|1|2|3|4}
`

const MUTUAL_PARITY_ABS_ENV = `n5 = {0|1|2|3|4|5}
`

const PEANO_ADDITION_ABS_ENV = `pair1 = {Pair(Z(), S(Z()))|Pair(S(Z()), S(S(Z())))|Pair(S(S(Z())), S(Z()))}
`

const INTERPRETER_ABS_ENV = `p1 = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg1 = {0|1|2|3|4|5}
`

export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    id: DEFAULT_PRESET_ID,
    name: "definitional interpreter",
    source: INTERPRETER_S_T,
    envText: INITIAL_ENV,
  },
  {
    id: "factorial",
    name: "factorial",
    source: FACTORIAL,
    envText: FACTORIAL_ENV,
  },
  {
    id: "fibonacci",
    name: "fibonacci",
    source: FIBONACCI,
    envText: FIBONACCI_ENV,
  },
  {
    id: "mutual-parity",
    name: "mutual parity",
    source: MUTUAL_PARITY,
    envText: MUTUAL_PARITY_ENV,
  },
  {
    id: "peano-addition",
    name: "Peano addition",
    source: PEANO_ADDITION,
    envText: PEANO_ADDITION_ENV,
  },
]

export const ABSTRACT_PROGRAM_PRESETS: AbstractProgramPreset[] = [
  {
    id: "definitional-interpreter-abs",
    name: "definitional interpreter",
    source: INTERPRETER_S_T_ALPHA_CONV,
    absEnvText: INTERPRETER_ABS_ENV,
  },
  {
    id: "factorial-abs",
    name: "factorial",
    source: FACTORIAL,
    absEnvText: FACTORIAL_ABS_ENV,
  },
  {
    id: "fibonacci-abs",
    name: "fibonacci",
    source: FIBONACCI,
    absEnvText: FIBONACCI_ABS_ENV,
  },
  {
    id: "mutual-parity-abs",
    name: "mutual parity",
    source: MUTUAL_PARITY,
    absEnvText: MUTUAL_PARITY_ABS_ENV,
  },
  {
    id: "peano-addition-abs",
    name: "Peano addition",
    source: PEANO_ADDITION,
    absEnvText: PEANO_ADDITION_ABS_ENV,
  },
]
