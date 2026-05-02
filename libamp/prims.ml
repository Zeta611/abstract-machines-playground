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

let prims : (value array -> prim_result) StringMap.t =
  StringMap.of_list
    [
      ( "sub",
        fun args ->
          let* () = expectArity "sub" args 2 in
          let* x = expectInt "sub" 0 args.(0) in
          let* y = expectInt "sub" 1 args.(1) in
          Ok (vInt (x - y)) );
      ( "add",
        fun args ->
          let* () = expectArity "add" args 2 in
          let* x = expectInt "add" 0 args.(0) in
          let* y = expectInt "add" 1 args.(1) in
          Ok (vInt (x + y)) );
      ( "mul",
        fun args ->
          let* () = expectArity "mul" args 2 in
          let* x = expectInt "mul" 0 args.(0) in
          let* y = expectInt "mul" 1 args.(1) in
          Ok (vInt (x * y)) );
      ( "iszero",
        fun args ->
          let* () = expectArity "iszero" args 1 in
          let* x = expectInt "iszero" 0 args.(0) in
          Ok (boolValue (x = 0)) );
      ( "eq",
        fun args ->
          let* () = expectArity "eq" args 2 in
          Ok (boolValue (valEq args.(0) args.(1))) );
      ( "lt",
        fun args ->
          let* () = expectArity "lt" args 2 in
          let* x = expectInt "lt" 0 args.(0) in
          let* y = expectInt "lt" 1 args.(1) in
          Ok (boolValue (x < y)) );
      ( "not",
        fun args ->
          let* () = expectArity "not" args 1 in
          let* tag = expectBoolean "not" args.(0) in
          Ok (if tag = "True" then vFalse else vTrue) );
    ]

let isPrim op = StringMap.mem op prims

let evalPrim op args =
  match StringMap.find_opt op prims with
  | Some f -> f args
  | None -> Error ("unknown primitive '" ^ op ^ "'")
