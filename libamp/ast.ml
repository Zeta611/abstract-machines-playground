type loc = { from : int; to_ : int }

type exp =
  | Num of { n : int; loc : loc }
  | Var of { name : string; loc : loc }
  | Ctor of { tag : string; args : exp array; loc : loc }
  | Prim of { op : string; args : exp array; loc : loc }

type cmd =
  | Return of { label : int; exp : exp; loc : loc }
  | Let of { label : int; x : string; exp : exp; body : cmd; loc : loc }
  | LetCall of {
      label : int;
      x : string;
      fn : string;
      args : exp array;
      body : cmd;
      loc : loc;
    }
  | Match of {
      label : int;
      scrutinee : exp;
      branches : branch array;
      loc : loc;
    }

and branch = { tag : string; vars : string array; body : cmd; loc : loc }

type def = { name : string; params : string array; body : cmd; loc : loc }

type prog = {
  defs : def Js.Dict.t;
  mainName : string;
  ctrl : cmd Js.Dict.t;
}

type num_payload = { n : int }
type var_payload = { name : string }
type app_payload = { tag : string; args : exp array }
type prim_payload = { op : string; args : exp array }
type return_payload = { label : int; exp : exp }
type let_payload = { label : int; x : string; exp : exp; body : cmd }

type let_call_payload = {
  label : int;
  x : string;
  fn : string;
  args : exp array;
  body : cmd;
}

type match_payload = { label : int; scrutinee : exp; branches : branch array }

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

let num (payload : num_payload) loc = Num { n = payload.n; loc }
let var_ (payload : var_payload) loc = Var { name = payload.name; loc }
let ctor (payload : app_payload) loc = Ctor { tag = payload.tag; args = payload.args; loc }
let prim (payload : prim_payload) loc = Prim { op = payload.op; args = payload.args; loc }

let return_ (payload : return_payload) loc =
  Return { label = payload.label; exp = payload.exp; loc }

let let_ (payload : let_payload) loc =
  Let
    {
      label = payload.label;
      x = payload.x;
      exp = payload.exp;
      body = payload.body;
      loc;
    }

let letCall (payload : let_call_payload) loc =
  LetCall
    {
      label = payload.label;
      x = payload.x;
      fn = payload.fn;
      args = payload.args;
      body = payload.body;
      loc;
    }

let match_ (payload : match_payload) loc =
  Match
    {
      label = payload.label;
      scrutinee = payload.scrutinee;
      branches = payload.branches;
      loc;
    }

let cmdLabel = function
  | Return { label; _ }
  | Let { label; _ }
  | LetCall { label; _ }
  | Match { label; _ } ->
      label

let cmdLoc = function
  | Return { loc; _ } | Let { loc; _ } | LetCall { loc; _ } | Match { loc; _ }
    ->
      loc

let withExp e visitor =
  match e with
  | Num { n; loc } -> visitor.num { n } loc
  | Var { name; loc } -> visitor.var { name } loc
  | Ctor { tag; args; loc } -> visitor.ctor { tag; args } loc
  | Prim { op; args; loc } -> visitor.prim { op; args } loc

let withCmd c visitor =
  match c with
  | Return { label; exp; loc } -> visitor.return { label; exp } loc
  | Let { label; x; exp; body; loc } ->
      visitor.let_ { label; x; exp; body } loc
  | LetCall { label; x; fn; args; body; loc } ->
      visitor.letCall { label; x; fn; args; body } loc
  | Match { label; scrutinee; branches; loc } ->
      visitor.match_ { label; scrutinee; branches } loc

let rec expSummary e =
  match e with
  | Num { n; _ } -> string_of_int n
  | Var { name; _ } -> name
  | Ctor { tag; args; _ } ->
      tag ^ "(" ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ") ^ ")"
  | Prim { op; args; _ } ->
      op ^ "(" ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ") ^ ")"

let cmdSummary c =
  match c with
  | Return { exp; _ } -> "return " ^ expSummary exp
  | Let { x; exp; _ } -> "let " ^ x ^ " = " ^ expSummary exp ^ " in ..."
  | LetCall { x; fn; args; _ } ->
      "let " ^ x ^ " = " ^ fn ^ "("
      ^ (args |> Array.map expSummary |> Array.to_list |> String.concat ", ")
      ^ ") in ..."
  | Match { scrutinee; _ } -> "match " ^ expSummary scrutinee ^ " with ..."
