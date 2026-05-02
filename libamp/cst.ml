type exp = [ `Int of int | `Var of string | `App of string * exp list ]

type cmd =
  [ `Let of string * exp * cmd
  | `Match of exp * (string * string list * cmd) list
  | `Return of exp ]

type program = (string * string list * cmd) list
