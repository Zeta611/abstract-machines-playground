type loc = { from : int; to_ : int }
type 'a located = { payload : 'a; loc : loc }

[@@@warning "-30"]

type exp =
  | Num of num_payload located
  | Var of var_payload located
  | Ctor of app_payload located
  | Prim of prim_payload located

and cmd =
  | Return of return_payload located
  | Let of let_payload located
  | LetCall of let_call_payload located
  | Match of match_payload located

and branch = { tag : string; vars : string array; body : cmd; loc : loc }
and num_payload = { n : int }
and var_payload = { name : string }
and app_payload = { tag : string; args : exp array }
and prim_payload = { op : string; args : exp array }
and return_payload = { label : int; exp : exp }
and let_payload = { label : int; x : string; exp : exp; body : cmd }

and let_call_payload = {
  label : int;
  x : string;
  fn : string;
  args : exp array;
  body : cmd;
}

and match_payload = { label : int; scrutinee : exp; branches : branch array }

[@@@warning "+30"]

type def = { name : string; params : string array; body : cmd; loc : loc }
type prog = { defs : def Js.Dict.t; mainName : string; ctrl : cmd Js.Dict.t }

type 'a exp_visitor = {
  num : num_payload -> loc -> 'a;
  var : var_payload -> loc -> 'a;
  ctor : app_payload -> loc -> 'a;
  prim : prim_payload -> loc -> 'a;
}

type 'a cmd_visitor = {
  return : return_payload -> loc -> 'a;
  let_ : let_payload -> loc -> 'a;
  letCall : let_call_payload -> loc -> 'a;
  match_ : match_payload -> loc -> 'a;
}

let num (payload : num_payload) loc = Num { payload; loc }
let var_ (payload : var_payload) loc = Var { payload; loc }
let ctor (payload : app_payload) loc = Ctor { payload; loc }
let prim (payload : prim_payload) loc = Prim { payload; loc }
let return_ (payload : return_payload) loc = Return { payload; loc }
let let_ (payload : let_payload) loc = Let { payload; loc }
let letCall (payload : let_call_payload) loc = LetCall { payload; loc }
let match_ (payload : match_payload) loc = Match { payload; loc }

let cmdLabel = function
  | Return { payload; _ } -> payload.label
  | Let { payload; _ } -> payload.label
  | LetCall { payload; _ } -> payload.label
  | Match { payload; _ } -> payload.label

let cmdLoc = function
  | Return { loc; _ } -> loc
  | Let { loc; _ } -> loc
  | LetCall { loc; _ } -> loc
  | Match { loc; _ } -> loc

let withExp e visitor =
  match e with
  | Num { payload; loc } -> visitor.num payload loc
  | Var { payload; loc } -> visitor.var payload loc
  | Ctor { payload; loc } -> visitor.ctor payload loc
  | Prim { payload; loc } -> visitor.prim payload loc

let withCmd c visitor =
  match c with
  | Return { payload; loc } -> visitor.return payload loc
  | Let { payload; loc } -> visitor.let_ payload loc
  | LetCall { payload; loc } -> visitor.letCall payload loc
  | Match { payload; loc } -> visitor.match_ payload loc

let rec expSummary e =
  match e with
  | Num { payload = { n }; _ } -> string_of_int n
  | Var { payload = { name }; _ } -> name
  | Ctor { payload = { tag; args }; _ } ->
      tag ^ "("
      ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ")
      ^ ")"
  | Prim { payload = { op; args }; _ } ->
      op ^ "("
      ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ")
      ^ ")"

let cmdSummary c =
  match c with
  | Return { payload = { exp; _ }; _ } -> "return " ^ expSummary exp
  | Let { payload = { x; exp; _ }; _ } ->
      "let " ^ x ^ " = " ^ expSummary exp ^ " in ..."
  | LetCall { payload = { x; fn; args; _ }; _ } ->
      "let " ^ x ^ " = " ^ fn ^ "("
      ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ")
      ^ ") in ..."
  | Match { payload = { scrutinee; _ }; _ } ->
      "match " ^ expSummary scrutinee ^ " with ..."
