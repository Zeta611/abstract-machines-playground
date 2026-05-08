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
    | Prim of { op : string; args : t list }

  and t = { desc : desc; loc : loc }

  let rec summary (e : t) =
    match e.desc with
    | Num n -> string_of_int n
    | Var_ name -> name
    | Prim { op; args } ->
        op ^ "(" ^ (args |> List.map summary |> String.concat ", ") ^ ")"
end

module Cmd = struct
  type desc =
    | Return of string
    | Let_ of { x : string; exp : Exp.t; body : t }
    | LetCall of { x : string; callee : string; args : string list; body : t }
    | LetTag of { x : string; tag : string; args : Exp.t list; body : t }
    | Match_ of { scrutinee : Exp.t; branches : branch list }

  and branch = { tag : string; vars : string list; body : t; loc : loc }
  and t = { desc : desc; loc : loc; label : Label.t }

  let summary (c : t) =
    match c.desc with
    | Return name -> "return " ^ name
    | Let_ { x; exp; _ } -> "let " ^ x ^ " = " ^ Exp.summary exp ^ " in ..."
    | LetCall { x; callee; args; _ } ->
        "let " ^ x ^ " = " ^ callee ^ "("
        ^ (args |> String.concat ", ")
        ^ ") in ..."
    | LetTag { x; tag; args; _ } ->
        "let " ^ x ^ " = " ^ tag ^ "("
        ^ (args |> List.map Exp.summary |> String.concat ", ")
        ^ ") in ..."
    | Match_ { scrutinee; _ } -> "match " ^ Exp.summary scrutinee ^ " with ..."
end

type 'a def' = { name : string; params : string list; body : 'a; loc : loc }
type def = Cmd.t def'

type program = {
  defs : def StringMap.t;
  mainName : string;
  ctrl : Cmd.t LabelMap.t;
}
