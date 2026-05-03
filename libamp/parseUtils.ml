open Utils
open Ast

type syntax_kind =
  | Keyword [@mel.as "keyword"]
  | Identifier [@mel.as "identifier"]
  | Constructor [@mel.as "constructor"]
  | Number [@mel.as "number"]
  | Comment [@mel.as "comment"]
  | Punctuation [@mel.as "punctuation"]

type syntax_range = { kind : syntax_kind; from : int; to_ : int }

module M = struct
  type 'a t = StringSet.t -> Cmd.t IntMap.t -> int -> Cmd.t IntMap.t * int * 'a

  let unit (x : 'a) : 'a t = fun _ ctrl label -> (ctrl, label, x)

  let bind (m : 'a t) (f : 'a -> 'b t) : 'b t =
   fun funNames ctrl label ->
    let ctrl, label', x = m funNames ctrl label in
    f x funNames ctrl label'

  let is_fun (ident : string) : bool t =
   fun funNames ctrl label -> (ctrl, label, StringSet.mem ident funNames)

  let alloc : int t = fun _ ctrl label -> (ctrl, label + 1, label)

  let put (label : int) (cmd : Cmd.t) : Cmd.t t =
   fun _ ctrl label' -> (IntMap.add label cmd ctrl, label', cmd)
end

let ( let* ) = M.bind
let ( >>= ) = M.bind

let seq (xs : 'a M.t list) : 'a list M.t =
  let* xs =
    List.fold_left
      (fun acc x ->
        let* acc = acc in
        let* x = x in
        M.unit (x :: acc))
      (M.unit []) xs
  in
  M.unit (List.rev xs)

let e (from, to_) desc =
  M.unit
    {
      desc;
      Exp.loc = { from = from.Lexing.pos_cnum; to_ = to_.Lexing.pos_cnum };
    }

let b (from, to_) tag vars body =
  M.unit
    {
      tag;
      vars;
      body;
      Cmd.loc = { from = from.Lexing.pos_cnum; to_ = to_.Lexing.pos_cnum };
    }

let c (from, to_) desc =
  let* label = M.alloc in
  M.put label
    {
      desc;
      loc = { from = from.Lexing.pos_cnum; to_ = to_.Lexing.pos_cnum };
      label;
    }

let let_ loc x (exp : Exp.t) body =
  match exp.desc with
  | Prim ({ callee; _ } as e) ->
      let* is_fun = M.is_fun callee in
      if is_fun then c loc (Cmd.letCall { x; e; body })
      else c loc (Cmd.let_ { x; exp; body })
  | _ -> c loc (Cmd.let_ { x; exp; body })

let d (from, to_) name params body =
  {
    name;
    params;
    body;
    loc = { from = from.Lexing.pos_cnum; to_ = to_.Lexing.pos_cnum };
  }

let p defs =
  let funNames =
    defs |> List.map (fun { name; _ } -> name) |> StringSet.of_list
  in
  let mainName =
    if StringSet.mem "main" funNames then "main"
    else
      (* last function in the list; the grammar enforces at least one function *)
      List.fold_left (fun _ { name; _ } -> name) "" defs
  in
  let ctrl, _, defs =
    seq
      (List.map
         (fun { name; params; body; loc } ->
           let* body = body in
           M.unit { name; params; body; loc })
         defs)
      funNames IntMap.empty 0
  in
  {
    defs = StringMap.of_list (List.map (fun def -> (def.name, def)) defs);
    mainName;
    ctrl;
  }
