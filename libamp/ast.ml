open Utils

type loc = { from : int; to_ : int }

module Exp = struct
  type desc =
    | Num of int
    | Var_ of string
    | Ctor of { tag : string; args : t array }
    | Prim of { op : string; args : t array }

  and t = { desc : desc; loc : loc }

  let rec summary (e : t) =
    match e.desc with
    | Num n -> string_of_int n
    | Var_ name -> name
    | Ctor { tag; args } ->
        tag ^ "("
        ^ (args |> Array.map summary |> Array.to_list |> String.concat ", ")
        ^ ")"
    | Prim { op; args } ->
        op ^ "("
        ^ (args |> Array.map summary |> Array.to_list |> String.concat ", ")
        ^ ")"
end

module Cmd = struct
  type desc =
    | Return of Exp.t
    | Let_ of { x : string; exp : Exp.t; body : t }
    | LetCall of { x : string; callee : string; args : Exp.t array; body : t }
    | Match_ of { scrutinee : Exp.t; branches : branch array }

  and branch = { tag : string; vars : string array; body : t; loc : loc }
  and t = { desc : desc; loc : loc; label : int }

  let summary (c : t) =
    match c.desc with
    | Return exp -> "return " ^ Exp.summary exp
    | Let_ { x; exp; _ } -> "let " ^ x ^ " = " ^ Exp.summary exp ^ " in ..."
    | LetCall { x; callee; args; _ } ->
        "let " ^ x ^ " = " ^ callee ^ "("
        ^ (args |> Array.map Exp.summary |> Array.to_list |> String.concat ", ")
        ^ ") in ..."
    | Match_ { scrutinee; _ } -> "match " ^ Exp.summary scrutinee ^ " with ..."
end

type 'a def' = { name : string; params : string array; body : 'a; loc : loc }
type def = Cmd.t def'

type program = {
  defs : def StringMap.t;
  mainName : string;
  ctrl : Cmd.t IntMap.t;
}
