open Utils
open Ast

module M = struct
  type 'a t = StringSet.t -> Cmd.t LabelMap.t -> Label.t -> Cmd.t LabelMap.t * Label.t * 'a

  let unit (x : 'a) : 'a t = fun _ ctrl label -> (ctrl, label, x)

  let bind (m : 'a t) (f : 'a -> 'b t) : 'b t =
   fun funNames ctrl label ->
    let ctrl, label', x = m funNames ctrl label in
    f x funNames ctrl label'

  let is_fun (ident : string) : bool t =
   fun funNames ctrl label -> (ctrl, label, StringSet.mem ident funNames)

  let alloc : Label.t t = fun _ ctrl (L label) -> (ctrl, L (label + 1), L label)

  let put (label : Label.t) (cmd : Cmd.t) : Cmd.t t =
   fun _ ctrl label' -> (LabelMap.add (label) cmd ctrl, label', cmd)
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
  let* desc = desc in
  M.put label
    {
      desc;
      loc = { from = from.Lexing.pos_cnum; to_ = to_.Lexing.pos_cnum };
      label;
    }

let let_ loc x (exp : Exp.t M.t) body =
  c loc
    (let* exp = exp in
     let* body = body in
     match exp.desc with
     | Prim ({ op; args }) ->
         let* is_fun = M.is_fun op in
         if is_fun then M.unit (Cmd.LetCall { x; callee = op; args; body })
         else M.unit (Cmd.Let_ { x; exp; body })
     | _ -> M.unit (Cmd.Let_ { x; exp; body }))

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
      funNames LabelMap.empty (Label.L 0)
  in
  {
    defs = StringMap.of_list (List.map (fun def -> (def.name, def)) defs);
    mainName;
    ctrl;
  }
