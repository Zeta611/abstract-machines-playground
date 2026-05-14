open Utils

type value = Int of int_payload | Ctor of ctor_payload
and int_payload = { n : int }
and ctor_payload = { tag : string; args : value list }

type env = value StringMap.t
type 'a val_visitor = { int : int_payload -> 'a; ctor : ctor_payload -> 'a }
type t = value

let vInt n = Int { n }
let vCtor tag args = Ctor { tag; args }
let vTrue = vCtor "True" []
let vFalse = vCtor "False" []

let visit v visitor =
  match v with
  | Int payload -> visitor.int payload
  | Ctor payload -> visitor.ctor payload

let isTrue = function
  | Ctor { tag = "True"; args } -> List.length args = 0
  | _ -> false

let valEq a b = a = b

let rec showVal = function
  | Int { n } -> string_of_int n
  | Ctor { tag; args } ->
      if List.length args = 0 then tag ^ "()"
      else tag ^ "(" ^ (args |> List.map showVal |> String.concat ", ") ^ ")"

let bindMany env xs vs =
  List.fold_left2 (fun env x v -> StringMap.add x v env) env xs vs
