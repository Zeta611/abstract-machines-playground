/**
 * Reference programs used by the playground and smoke tests.
 *
 * `INTERPRETER_S_T` implements the definitional interpreter `I_S^T`
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
p = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg = 5
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

const FACTORIAL = `fact(n) =
  match iszero(n) with
  | True() => 1
  | False() =>
    let m = fact(sub(n, 1)) in
    mul(n, m)
  end
`

const FACTORIAL_ENV = `n = 10
`

const FIBONACCI = `fib(n) =
  match iszero(n) with
  | True() => 0
  | False() =>
    match iszero(sub(n, 1)) with
    | True() => 1
    | False() =>
      let a = fib(sub(n, 1)) in
      let b = fib(sub(n, 2)) in
      add(a, b)
    end
  end
`

const FIBONACCI_ENV = `n = 7
`

const MUTUAL_PARITY = `even(n) =
  match iszero(n) with
  | True() =>
    let t = True() in t
  | False() =>
    let r = odd(sub(n, 1)) in r
  end

odd(n) =
  match iszero(n) with
  | True() =>
    let f = False() in f
  | False() =>
    let r = even(sub(n, 1)) in r
  end

main(n) =
  let r = even(n) in r
`

const MUTUAL_PARITY_ENV = `n = 7
`

const PEANO_ADDITION = `addPeano(pair) =
  match pair with
  | Pair(x, y) =>
    match x with
    | Z() => y
    | S(x1) =>
      let y1 = S(y) in
      let pair1 = Pair(x1, y1) in
      let r = addPeano(pair1) in r
    end
  end
`

const PEANO_ADDITION_ENV = `pair = Pair(S(S(S(Z()))), S(S(Z())))
`

const FACTORIAL_ABS_ENV = `n = {0|1|2|3}
`

const FIBONACCI_ABS_ENV = `n = {0|1|2|3|4}
`

const MUTUAL_PARITY_ABS_ENV = `n = {0|1|2|3|4|5}
`

const PEANO_ADDITION_ABS_ENV = `pair = {Pair(Z(), S(Z()))|Pair(S(Z()), S(S(Z())))|Pair(S(S(Z())), S(Z()))}
`

const INTERPRETER_ABS_ENV = `p = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg = {0|1|2|3|4|5}
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
    source: INTERPRETER_S_T,
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
