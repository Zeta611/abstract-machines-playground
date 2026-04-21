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
#   exp   ::= Int(int) | X() | Sub(exp, exp) | Mul(exp, exp)
#           | App(Fun(int), exp) | Ifz(exp, exp, exp)

lookup(defs, fid) =
  match defs with
  | Defs(f, body, rest) =>
    match f with
    | Fun(fid2) =>
      match iszero(sub(fid, fid2)) with
      | true() => body
      | false() => let r = lookup(rest, fid) in r
      end
    end
  end

eval(e, arg, defs) =
  match e with
  | Int(n) => n
  | X() => arg
  | Sub(e1, e2) =>
    let v1 = eval(e1, arg, defs) in
    let v2 = eval(e2, arg, defs) in
    sub(v1, v2)
  | Mul(e1, e2) =>
    let v1 = eval(e1, arg, defs) in
    let v2 = eval(e2, arg, defs) in
    mul(v1, v2)
  | App(f, e1) =>
    match f with
    | Fun(fid) =>
      let v = eval(e1, arg, defs) in
      let body = lookup(defs, fid) in
      let r = eval(body, v, defs) in r
    end
  | Ifz(e1, e2, e3) =>
    let v1 = eval(e1, arg, defs) in
    match iszero(v1) with
    | true() => let r = eval(e2, arg, defs) in r
    | false() => let r = eval(e3, arg, defs) in r
    end
  end

main(p, arg) =
  match p with
  | Prog(defs, e) => let r = eval(e, arg, defs) in r
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
p = Prog(Defs(Fun(0), Ifz(X(), Int(1), Mul(X(), App(Fun(0), Sub(X(), Int(1))))), Nil()), App(Fun(0), X()))
arg = 5
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
