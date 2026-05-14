open Values

type prim_result = (value, string) result

let ( let* ) = Result.bind

let expectArity op args n =
  if Array.length args = n then Ok ()
  else
    Error
      ("primitive " ^ op ^ ": expected " ^ string_of_int n
     ^ " argument(s), got "
      ^ string_of_int (Array.length args))

let expectInt op idx = function
  | Int { n } -> Ok n
  | Ctor { tag; _ } ->
      Error
        ("primitive " ^ op ^ ": argument " ^ string_of_int idx
       ^ " expected int, got " ^ tag ^ "(...)")

let expectBoolean op = function
  | Ctor { tag = ("True" | "False") as tag; _ } -> Ok tag
  | _ -> Error ("primitive " ^ op ^ ": expected boolean, got non-boolean")

let boolValue b = if b then vTrue else vFalse

let evalPrim op args =
  match (op, args) with
  | "sub", [ v1; v2 ] ->
      let* n1 = expectInt "sub" 0 v1 in
      let* n2 = expectInt "sub" 1 v2 in
      Ok (vInt (n1 - n2))
  | "add", [ v1; v2 ] ->
      let* n1 = expectInt "add" 0 v1 in
      let* n2 = expectInt "add" 1 v2 in
      Ok (vInt (n1 + n2))
  | "mul", [ v1; v2 ] ->
      let* n1 = expectInt "mul" 0 v1 in
      let* n2 = expectInt "mul" 1 v2 in
      Ok (vInt (n1 * n2))
  | "iszero", [ v ] ->
      let* n = expectInt "iszero" 0 v in
      Ok (boolValue (n = 0))
  | "eq", [ v1; v2 ] ->
      let* n1 = expectInt "eq" 0 v1 in
      let* n2 = expectInt "eq" 1 v2 in
      Ok (boolValue (n1 = n2))
  | "lt", [ v1; v2 ] ->
      let* n1 = expectInt "lt" 0 v1 in
      let* n2 = expectInt "lt" 1 v2 in
      Ok (boolValue (n1 < n2))
  | "not", [ v ] ->
      let* tag = expectBoolean "not" v in
      Ok (if tag = "True" then vFalse else vTrue)
  | _ -> Error ("unknown primitive or wrong arity: " ^ op)
