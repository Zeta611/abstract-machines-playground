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
#   exp   ::= Int(int) | X() | Sub(exp, exp)
#           | App(Fun(int), exp) | Ifz(exp, exp, exp)

lookup(defs, fid) =
  match defs with
  | Defs(f, body, rest) =>
    match f with
    | Fun(fid2) =>
      let d = sub(fid, fid2) in
      match iszero(d) with
      | true() => body
      | false() => let r = lookup(rest, fid) in r
      end
    end
  end

evalExp(e, arg, defs) =
  match e with
  | Int(n) => n
  | X() => arg
  | Sub(e1, e2) =>
    let v1 = evalExp(e1, arg, defs) in
    let v2 = evalExp(e2, arg, defs) in
    sub(v1, v2)
  | App(f, e1) =>
    match f with
    | Fun(fid) =>
      let v = evalExp(e1, arg, defs) in
      let body = lookup(defs, fid) in
      let r = evalExp(body, v, defs) in r
    end
  | Ifz(e1, e2, e3) =>
    let v1 = evalExp(e1, arg, defs) in
    match iszero(v1) with
    | true() => let r = evalExp(e2, arg, defs) in r
    | false() => let r = evalExp(e3, arg, defs) in r
    end
  end

eval(p, arg) =
  match p with
  | Prog(defs, e) => let r = evalExp(e, arg, defs) in r
  end

main(p, arg) =
  let r = eval(p, arg) in r
`

/** A trivial S program used for sanity checks. */
export const TRIVIAL = `main(x) =
  let y = sub(x, 1) in y
`

/**
 * Default initial environment for the playground: a tiny T program that
 * computes \`x - 1\` and the argument \`0\`.
 *
 * In T: \`p = Prog(Nil, Sub(X, Int(1)))\`, applied to arg=0, should yield -1.
 */
export const INITIAL_ENV = `# A sample T program, encoded as S constructor values.

p = Prog(Nil(), Sub(X(), Int(1)))
arg = 0
`

export interface ProgramPreset {
  id: string
  name: string
  source: string
  envText: string
}

export const DEFAULT_PRESET_ID = "definitional-interpreter"

const FACTORIAL = `fact(n) =
  match iszero(n) with
  | true() => 1
  | false() =>
    let m = fact(sub(n, 1)) in
    mul(n, m)
  end
`

const FACTORIAL_ENV = `n = 10
`

const FIBONACCI = `fib(n) =
  match iszero(n) with
  | true() => 0
  | false() =>
    match iszero(sub(n, 1)) with
    | true() => 1
    | false() =>
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
  | true() => true()
  | false() =>
    let r = odd(sub(n, 1)) in r
  end

odd(n) =
  match iszero(n) with
  | true() => false()
  | false() =>
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
      let r = addPeano(Pair(x1, S(y))) in r
    end
  end
`

const PEANO_ADDITION_ENV = `pair = Pair(S(S(S(Z()))), S(S(Z())))
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
