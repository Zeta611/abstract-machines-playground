open Utils
open Ast
open Values

type frame = { label : Label.t; env : env }
type state = { label : Label.t; env : env; kont : frame list }

type rule_name =
  | LetExp [@mel.as "LetExp"]
  | LetCall [@mel.as "LetCall"]
  | LetTag [@mel.as "LetTag"]
  | Match [@mel.as "Match"]
  | Return [@mel.as "Return"]

type trace_step = {
  rule : rule_name;
  detail : string option;
  value : value option;
}

type trace_end =
  | Final of { value : value }
  | Stuck of { reason : string; at : state }
  | Maxed of { reason : string }

type 'a trace_end_visitor = {
  final : value -> 'a;
  stuck : string -> state -> 'a;
  maxed : string -> 'a;
}

type trace = {
  states : state array;
  steps : trace_step array;
  end_ : trace_end; [@mel.as "end"]
}

type step_success =
  | Step of { next : state; record : trace_step }
  | FinalValue of { value : value }

type run_options = { maxSteps : int option }

let ( let* ) = Result.bind

let visit_trace_end end_ visitor =
  match end_ with
  | Final { value } -> visitor.final value
  | Stuck { reason; at } -> visitor.stuck reason at
  | Maxed { reason } -> visitor.maxed reason

let seq (rs : ('a, string) result list) : ('a list, string) result =
  let+ l =
    List.fold_left
      (fun acc r ->
        let* xs = acc in
        let+ x = r in
        x :: xs)
      (Ok []) rs
  in
  List.rev l

let rec eval_exp (e : Exp.t) (rho : env) : (value, string) result =
  match e.desc with
  | Num n -> Ok (vInt n)
  | Var_ x ->
      begin match StringMap.find_opt x rho with
      | Some v -> Ok v
      | None -> Error ("undefined variable '" ^ x ^ "'")
      end
  | Prim { op; args } ->
      let* argVals = args |> List.map (fun arg -> eval_exp arg rho) |> seq in
      Prims.evalPrim op argVals

let inject (prog : program) (rho : env) : state =
  let main = StringMap.find prog.mainName prog.defs in
  { label = main.body.label; env = rho; kont = [] }

let mk_step ((label, env, kont, rule) : Label.t * env * frame list * rule_name)
    ?(value : value option) detail =
  Printf.ksprintf
    (fun s ->
      Ok
        (Step
           {
             next = { label; env; kont };
             record = { rule; detail = Some s; value };
           }))
    detail

let ffail reason = Printf.ksprintf (fun s -> Error s) reason
let sfail reason = Error reason

let step (s : state) (prog : program) : (step_success, string) result =
  let cmd = LabelMap.find s.label prog.ctrl in
  match cmd.desc with
  | Return exp ->
      let* v = eval_exp exp s.env in
      begin match s.kont with
      | [] -> Ok (FinalValue { value = v })
      | top :: rest ->
          let suspended = LabelMap.find top.label prog.ctrl in
          begin match suspended.desc with
          | LetCall { x; body; _ } ->
              mk_step
                (body.label, StringMap.add x v top.env, rest, Return)
                ~value:v "return into %s" x
          | _ ->
              sfail
                ("invalid continuation frame for return: expected LetCall, got "
               ^ Cmd.summary suspended)
          end
      end
  | LetCall { x; callee; args; _ } ->
      begin match StringMap.find_opt callee prog.defs with
      | None -> Error ("undefined function " ^ callee)
      | Some def ->
          let* argVals =
            args |> List.map (fun arg -> eval_exp arg s.env) |> seq
          in
          let calleeEnv = bindMany StringMap.empty def.params argVals in
          let frame = { label = s.label; env = s.env } in
          mk_step
            (def.body.label, calleeEnv, frame :: s.kont, LetCall)
            "call %s(%d args) -> let %s" callee (List.length argVals) x
      end
  | LetTag { x; tag; args; body } ->
      let* argVals = args |> List.map (fun arg -> eval_exp arg s.env) |> seq in
      let v = vCtor tag argVals in
      mk_step
        (body.label, StringMap.add x v s.env, s.kont, LetTag)
        ~value:v "let %s = %s(%d args)" x tag (List.length argVals)
  | Let_ { x; exp; body } ->
      let* v = eval_exp exp s.env in
      mk_step
        (body.label, StringMap.add x v s.env, s.kont, LetExp)
        ~value:v "%s := ..." x
  | Match_ { scrutinee; branches } ->
      let* v = eval_exp scrutinee s.env in
      begin match v with
      | Int { n } -> ffail "match on non-constructor value (got int %d)" n
      | Ctor { tag; args } ->
          List.find_map
            (fun branch ->
              if branch.Cmd.tag = tag then
                let env' = bindMany s.env branch.vars args in
                mk_step
                  (branch.body.label, env', s.kont, Match)
                  ~value:v "%s(%s) matched" branch.tag
                  (String.concat ", " branch.vars)
                |> Option.some
              else None)
            branches
          |> Option.to_result ~none:("no matching branch for tag '" ^ tag ^ "'")
          |> Result.join
      end

let run_impl ?(opts = { maxSteps = None }) (prog : program) (initEnv : env) :
    trace =
  let maxSteps = Option.value opts.maxSteps ~default:10_000 in
  let s0 = inject prog initEnv in
  let rec loop i cur states steps =
    if i >= maxSteps then
      {
        states = Array.of_list (List.rev states);
        steps = Array.of_list (List.rev steps);
        end_ = Maxed { reason = Printf.sprintf "exceeded maxSteps=%d" maxSteps };
      }
    else
      match step cur prog with
      | Ok (FinalValue { value }) ->
          {
            states = Array.of_list (List.rev states);
            steps = Array.of_list (List.rev steps);
            end_ = Final { value };
          }
      | Ok (Step { next; record }) ->
          loop (i + 1) next (next :: states) (record :: steps)
      | Error reason ->
          {
            states = Array.of_list (List.rev states);
            steps = Array.of_list (List.rev steps);
            end_ = Stuck { reason; at = cur };
          }
  in
  loop 0 s0 [ s0 ] []

let run (prog : program) (initEnv : env) (opts : run_options option) : trace =
  match opts with
  | None -> run_impl prog initEnv
  | Some opts -> run_impl ~opts prog initEnv
