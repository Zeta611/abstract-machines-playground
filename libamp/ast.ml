open Utils

type loc = { from : int; to_ : int }

module Exp = struct
  type desc =
    | Num of int
    | Var_ of string
    | Ctor of app_payload
    | Prim of app_payload

  and app_payload = { callee : string; args : t array }
  and t = { desc : desc; loc : loc }

  type 'a visitor = {
    num : int -> 'a;
    var_ : string -> 'a;
    ctor : app_payload -> 'a;
    prim : app_payload -> 'a;
  }

  let visit e visitor =
    match e.desc with
    | Num payload -> visitor.num payload
    | Var_ payload -> visitor.var_ payload
    | Ctor payload -> visitor.ctor payload
    | Prim payload -> visitor.prim payload

  let rec summary (e : t) =
    match e.desc with
    | Num n -> string_of_int n
    | Var_ name -> name
    | Ctor { callee; args } ->
        callee ^ "("
        ^ (args |> Array.map summary |> Array.to_list |> String.concat ", ")
        ^ ")"
    | Prim { callee; args } ->
        callee ^ "("
        ^ (args |> Array.map summary |> Array.to_list |> String.concat ", ")
        ^ ")"
end

module Cmd = struct
  type desc =
    | Return of Exp.t
    | Let_ of let_payload
    | LetCall of let_call_payload
    | Match_ of match_payload

  and let_payload = { x : string; exp : Exp.t; body : t }
  and let_call_payload = { x : string; e : Exp.app_payload; body : t }
  and match_payload = { scrutinee : Exp.t; branches : branch array }
  and branch = { tag : string; vars : string array; body : t; loc : loc }
  and t = { desc : desc; loc : loc; label : int }

  type 'a visitor = {
    return : Exp.t -> 'a;
    let_ : let_payload -> 'a;
    letCall : let_call_payload -> 'a;
    match_ : match_payload -> 'a;
  }

  let visit c visitor =
    match c.desc with
    | Return payload -> visitor.return payload
    | Let_ payload -> visitor.let_ payload
    | LetCall payload -> visitor.letCall payload
    | Match_ payload -> visitor.match_ payload

  let summary (c : t) =
    match c.desc with
    | Return exp -> "return " ^ Exp.summary exp
    | Let_ { x; exp; _ } -> "let " ^ x ^ " = " ^ Exp.summary exp ^ " in ..."
    | LetCall { x; e = { callee; args }; _ } ->
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
