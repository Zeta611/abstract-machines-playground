open Utils

type loc = { from : int; to_ : int }

module Label = struct
  type t = L of int [@@unboxed]

  let compare (x : t) (y : t) : int = compare x y
end

module LabelMap = Map.Make (Label)

module Exp = struct
  type desc =
    | Num of int
    | Var_ of string
    | Prim of { op : string; args : t array }

  and t = { desc : desc; loc : loc }

  let rec summary (e : t) =
    match e.desc with
    | Num n -> string_of_int n
    | Var_ name -> name
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
    | LetTag of { x : string; tag : string; args : Exp.t array; body : t }
    | Match_ of { scrutinee : Exp.t; branches : branch array }

  and branch = { tag : string; vars : string array; body : t; loc : loc }
  and t = { desc : desc; loc : loc; label : Label.t }

  let summary (c : t) =
    match c.desc with
    | Return exp -> "return " ^ Exp.summary exp
    | Let_ { x; exp; _ } -> "let " ^ x ^ " = " ^ Exp.summary exp ^ " in ..."
    | LetCall { x; callee; args; _ } ->
        "let " ^ x ^ " = " ^ callee ^ "("
        ^ (args |> Array.map Exp.summary |> Array.to_list |> String.concat ", ")
        ^ ") in ..."
    | LetTag { x; tag; args; _ } ->
        "let " ^ x ^ " = " ^ tag ^ "("
        ^ (args |> Array.map Exp.summary |> Array.to_list |> String.concat ", ")
        ^ ") in ..."
    | Match_ { scrutinee; _ } -> "match " ^ Exp.summary scrutinee ^ " with ..."
end

type 'a def' = { name : string; params : string array; body : 'a; loc : loc }
type def = Cmd.t def'

type program = {
  defs : def StringMap.t;
  mainName : string;
  ctrl : Cmd.t LabelMap.t;
}
