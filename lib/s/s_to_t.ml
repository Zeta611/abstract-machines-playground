open Ast
open Utils
open Values

let ( let* ) = Result.bind
let ( let+ ) r f = Result.map f r
let fail fmt = Printf.ksprintf (fun s -> Error s) fmt

let find_env name env =
  StringMap.find_opt name env
  |> Option.to_result ~none:("missing S environment binding '" ^ name ^ "'")

let label_eq (a : Label.t) (b : Label.t) = a = b

module T = struct
  type expr =
    | IntLit of { label : int; value : int }
    | Var of { label : int; name : int }
    | Sub of { label : int; left : expr; right : expr }
    | Mul of { label : int; left : expr; right : expr }
    | Let of { label : int; name : int; bound : expr; body : expr }
    | App of { label : int; fn : int; arg : expr }
    | Ifz of { label : int; test : expr; then_ : expr; else_ : expr }

  type env = int IntMap.t

  type frame =
    | Sub1 of { right : expr; env : env }
    | Sub2 of { left_value : int; env : env }
    | Mul1 of { right : expr; env : env }
    | Mul2 of { left_value : int; env : env }
    | LetK of { name : int; body : expr; env : env }
    | Restore of env
    | AppK of { fn : int; env : env }
    | IfzK of { then_ : expr; else_ : expr; env : env }

  type control = Expr of expr | Value of int
  type state = { control : control; env : env; kont : frame list }
  type defs = expr IntMap.t
  type step_result = Step of state | Final

  let rec show_expr = function
    | IntLit { label; value } -> Printf.sprintf "%d^%d" value label
    | Var { label; name } -> Printf.sprintf "x%d^%d" name label
    | Sub { label; left; right } ->
        Printf.sprintf "(%s - %s)^%d" (show_expr left) (show_expr right) label
    | Mul { label; left; right } ->
        Printf.sprintf "(%s * %s)^%d" (show_expr left) (show_expr right) label
    | Let { label; name; bound; body } ->
        Printf.sprintf "(let x%d = %s in %s)^%d" name (show_expr bound)
          (show_expr body) label
    | App { label; fn; arg } ->
        Printf.sprintf "f%d(%s)^%d" fn (show_expr arg) label
    | Ifz { label; test; then_; else_ } ->
        Printf.sprintf "(ifz %s then %s else %s)^%d" (show_expr test)
          (show_expr then_) (show_expr else_) label

  let show_control = function
    | Expr e -> show_expr e
    | Value n -> string_of_int n

  let show_env env =
    env |> IntMap.bindings
    |> List.map (fun (x, n) -> Printf.sprintf "x%d=%d" x n)
    |> String.concat ", "
    |> fun s -> "{" ^ s ^ "}"

  let show_frame = function
    | Sub1 { right; env } ->
        Printf.sprintf "Sub1<%s,%s>" (show_expr right) (show_env env)
    | Sub2 { left_value; env } ->
        Printf.sprintf "Sub2<%d,%s>" left_value (show_env env)
    | Mul1 { right; env } ->
        Printf.sprintf "Mul1<%s,%s>" (show_expr right) (show_env env)
    | Mul2 { left_value; env } ->
        Printf.sprintf "Mul2<%d,%s>" left_value (show_env env)
    | LetK { name; body; env } ->
        Printf.sprintf "Let<x%d,%s,%s>" name (show_expr body) (show_env env)
    | Restore env -> Printf.sprintf "Restore<%s>" (show_env env)
    | AppK { fn; env } -> Printf.sprintf "App<f%d,%s>" fn (show_env env)
    | IfzK { then_; else_; env } ->
        Printf.sprintf "Ifz<%s,%s,%s>" (show_expr then_) (show_expr else_)
          (show_env env)

  let show_state state =
    Printf.sprintf "<%s, %s, [%s]>"
      (show_control state.control)
      (show_env state.env)
      (state.kont |> List.map show_frame |> String.concat "; ")

  let step defs state =
    match (state.control, state.kont) with
    | Expr (IntLit { value; _ }), kont ->
        Ok (Step { state with control = Value value; kont })
    | Expr (Var { name; _ }), kont ->
        begin match IntMap.find_opt name state.env with
        | Some value -> Ok (Step { state with control = Value value; kont })
        | None -> fail "unbound T variable x%d" name
        end
    | Expr (Sub { left; right; _ }), kont ->
        Ok
          (Step
             {
               control = Expr left;
               env = state.env;
               kont = Sub1 { right; env = state.env } :: kont;
             })
    | Value left_value, Sub1 { right; env } :: kont ->
        Ok
          (Step
             {
               control = Expr right;
               env;
               kont = Sub2 { left_value; env } :: kont;
             })
    | Value right_value, Sub2 { left_value; env } :: kont ->
        Ok (Step { control = Value (left_value - right_value); env; kont })
    | Expr (Mul { left; right; _ }), kont ->
        Ok
          (Step
             {
               control = Expr left;
               env = state.env;
               kont = Mul1 { right; env = state.env } :: kont;
             })
    | Value left_value, Mul1 { right; env } :: kont ->
        Ok
          (Step
             {
               control = Expr right;
               env;
               kont = Mul2 { left_value; env } :: kont;
             })
    | Value right_value, Mul2 { left_value; env } :: kont ->
        Ok (Step { control = Value (left_value * right_value); env; kont })
    | Expr (Let { name; bound; body; _ }), kont ->
        Ok
          (Step
             {
               control = Expr bound;
               env = state.env;
               kont = LetK { name; body; env = state.env } :: kont;
             })
    | Value value, LetK { name; body; env } :: kont ->
        Ok
          (Step
             {
               control = Expr body;
               env = IntMap.add name value env;
               kont = Restore env :: kont;
             })
    | Value value, Restore env :: kont ->
        Ok (Step { control = Value value; env; kont })
    | Expr (App { fn; arg; _ }), kont ->
        Ok
          (Step
             {
               control = Expr arg;
               env = state.env;
               kont = AppK { fn; env = state.env } :: kont;
             })
    | Value value, AppK { fn; env } :: kont ->
        begin match IntMap.find_opt fn defs with
        | Some body ->
            Ok
              (Step
                 {
                   control = Expr body;
                   env = IntMap.singleton 0 value;
                   kont = Restore env :: kont;
                 })
        | None -> fail "unbound T function f%d" fn
        end
    | Expr (Ifz { test; then_; else_; _ }), kont ->
        Ok
          (Step
             {
               control = Expr test;
               env = state.env;
               kont = IfzK { then_; else_; env = state.env } :: kont;
             })
    | Value 0, IfzK { then_; env; _ } :: kont ->
        Ok (Step { control = Expr then_; env; kont })
    | Value _, IfzK { else_; env; _ } :: kont ->
        Ok (Step { control = Expr else_; env; kont })
    | Value _, [] -> Ok Final
end

module Decode = struct
  let int_value context = function
    | Int { n } -> Ok n
    | Ctor { tag; _ } -> fail "%s: expected int, got %s(...)" context tag

  let ctor context expected value =
    match value with
    | Ctor { tag; args } when tag = expected -> Ok args
    | Ctor { tag; _ } ->
        fail "%s: expected %s(...), got %s(...)" context expected tag
    | Int { n } -> fail "%s: expected %s(...), got int %d" context expected n

  let expect_arity context args arity =
    if List.length args = arity then Ok ()
    else
      fail "%s: expected %d argument(s), got %d" context arity
        (List.length args)

  let var_id context value =
    let* args = ctor context "Var" value in
    let* () = expect_arity context args 2 in
    match args with
    | [ _label; name ] -> int_value context name
    | _ -> fail "%s: malformed Var" context

  let fun_id context value =
    let* args = ctor context "Fun" value in
    let* () = expect_arity context args 1 in
    match args with
    | [ name ] -> int_value context name
    | _ -> fail "%s: malformed Fun" context

  let rec expr value =
    match value with
    | Int { n } -> fail "T expression: expected constructor, got int %d" n
    | Ctor { tag = "Int"; args = [ label; n ] } ->
        let* label = int_value "Int label" label in
        let+ value = int_value "Int value" n in
        T.IntLit { label; value }
    | Ctor { tag = "Var"; args = [ label; name ] } ->
        let* label = int_value "Var label" label in
        let+ name = int_value "Var name" name in
        T.Var { label; name }
    | Ctor { tag = "Sub"; args = [ label; left; right ] } ->
        let* label = int_value "Sub label" label in
        let* left = expr left in
        let+ right = expr right in
        T.Sub { label; left; right }
    | Ctor { tag = "Mul"; args = [ label; left; right ] } ->
        let* label = int_value "Mul label" label in
        let* left = expr left in
        let+ right = expr right in
        T.Mul { label; left; right }
    | Ctor { tag = "Let"; args = [ label; name; bound; body ] } ->
        let* label = int_value "Let label" label in
        let* name = var_id "Let variable" name in
        let* bound = expr bound in
        let+ body = expr body in
        T.Let { label; name; bound; body }
    | Ctor { tag = "App"; args = [ label; fn; arg ] } ->
        let* label = int_value "App label" label in
        let* fn = fun_id "App function" fn in
        let+ arg = expr arg in
        T.App { label; fn; arg }
    | Ctor { tag = "Ifz"; args = [ label; test; then_; else_ ] } ->
        let* label = int_value "Ifz label" label in
        let* test = expr test in
        let* then_ = expr then_ in
        let+ else_ = expr else_ in
        T.Ifz { label; test; then_; else_ }
    | Ctor { tag; args } ->
        fail "T expression: unsupported or malformed %s/%d" tag
          (List.length args)

  let rec defs value =
    match value with
    | Ctor { tag = "Nil"; args = [] } -> Ok IntMap.empty
    | Ctor { tag = "Defs"; args = [ fn; body; rest ] } ->
        let* fn = fun_id "Defs function" fn in
        let* body = expr body in
        let+ rest = defs rest in
        IntMap.add fn body rest
    | Ctor { tag; args } ->
        fail "T definitions: unsupported or malformed %s/%d" tag
          (List.length args)
    | Int { n } -> fail "T definitions: expected defs, got int %d" n

  let rec env value =
    match value with
    | Ctor { tag = "Nil"; args = [] } -> Ok IntMap.empty
    | Ctor { tag = "Env"; args = [ name; value; rest ] } ->
        let* name = var_id "Env variable" name in
        let* value = int_value "Env value" value in
        let+ rest = env rest in
        IntMap.add name value rest
    | Ctor { tag; args } ->
        fail "T environment: unsupported or malformed %s/%d" tag
          (List.length args)
    | Int { n } -> fail "T environment: expected env, got int %d" n

  let program value =
    match value with
    | Ctor { tag = "Prog"; args = [ defs_value; expr_value ] } ->
        let* defs = defs defs_value in
        let+ body = expr expr_value in
        (defs, body)
    | Ctor { tag; args } ->
        fail "T program: unsupported or malformed %s/%d" tag (List.length args)
    | Int { n } -> fail "T program: expected Prog(...), got int %d" n
end

module Interpreter_points = struct
  type ret_point = { label : Label.t; value_var : string }

  type points = {
    eval_label : Label.t;
    eval_exp : string;
    eval_env : string;
    eval_defs : string;
    main_program : string;
    main_arg : string;
    int_ret : ret_point;
    var_ret : ret_point;
    sub_ret : ret_point;
    mul_ret : ret_point;
    let_ret : ret_point;
    app_ret : ret_point;
    ifz_then_ret : ret_point;
    ifz_else_ret : ret_point;
    sub1_label : Label.t;
    sub1_right : string;
    sub2_label : Label.t;
    sub2_left_value : string;
    mul1_label : Label.t;
    mul1_right : string;
    mul2_label : Label.t;
    mul2_left_value : string;
    let1_label : Label.t;
    let_name : string;
    let_body : string;
    let2_label : Label.t;
    app1_label : Label.t;
    app_fn : string;
    app2_label : Label.t;
    ifz1_label : Label.t;
    ifz_then : string;
    ifz_else : string;
  }

  let exp_is_var name exp =
    match exp.Exp.desc with Var_ x -> x = name | _ -> false

  let exp_var = function { Exp.desc = Var_ x; _ } -> Some x | _ -> None

  let branch tag branches =
    List.find_opt (fun (branch : Cmd.branch) -> branch.tag = tag) branches
    |> Option.to_result ~none:("missing interpreter branch " ^ tag)

  let expect_return context cmd =
    match cmd.Cmd.desc with
    | Return value_var -> Ok { label = cmd.label; value_var }
    | _ -> fail "%s: expected return command" context

  let expect_let_call context callee args cmd =
    match cmd.Cmd.desc with
    | LetCall { x; callee = actual; args = actual_args; body }
      when actual = callee && actual_args = args ->
        Ok (cmd.label, x, body)
    | _ ->
        fail "%s: expected call %s(%s)" context callee (String.concat ", " args)

  let expect_let_prim context op args cmd =
    match cmd.Cmd.desc with
    | Let_
        {
          x;
          exp = { desc = Prim { op = actual; args = actual_args }; _ };
          body;
        }
      when actual = op
           && List.map exp_var actual_args = List.map Option.some args ->
        Ok (x, body)
    | _ ->
        fail "%s: expected primitive %s(%s)" context op
          (String.concat ", " args)

  let rec find_eval_call args cmd =
    match cmd.Cmd.desc with
    | LetCall { x; callee = "eval"; args = actual_args; body }
      when actual_args = args ->
        Ok (cmd.label, x, body)
    | Let_ { body; _ } | LetCall { body; _ } | LetTag { body; _ } ->
        find_eval_call args body
    | _ -> fail "could not find recursive eval(%s)" (String.concat ", " args)

  let rec find_extend_call value_arg cmd =
    match cmd.Cmd.desc with
    | LetCall { x; callee = "extend"; args = [ _env; _name; value ]; body }
      when value = value_arg ->
        Ok (x, body)
    | Let_ { body; _ } | LetCall { body; _ } | LetTag { body; _ } ->
        find_extend_call value_arg body
    | _ -> fail "could not find extend(..., ..., %s)" value_arg

  let of_program (prog : program) =
    let* eval_def =
      StringMap.find_opt "eval" prog.defs
      |> Option.to_result ~none:"program does not define eval"
    in
    let* main_def =
      StringMap.find_opt prog.mainName prog.defs
      |> Option.to_result ~none:("program does not define " ^ prog.mainName)
    in
    let* eval_exp, eval_env, eval_defs =
      match eval_def.params with
      | [ e; env; defs ] -> Ok (e, env, defs)
      | _ -> fail "eval must have exactly three parameters"
    in
    let* main_program, main_arg =
      match main_def.params with
      | [ p; arg ] -> Ok (p, arg)
      | _ -> fail "main must have exactly two parameters"
    in
    let* branches =
      match eval_def.body.desc with
      | Match_ { scrutinee; branches } when exp_is_var eval_exp scrutinee ->
          Ok branches
      | _ -> fail "eval body must dispatch by matching its expression parameter"
    in
    let* int_branch = branch "Int" branches in
    let* int_ret =
      match int_branch.vars with
      | [ _label; n ] ->
          let* ret = expect_return "Int branch" int_branch.body in
          if ret.value_var = n then Ok ret
          else fail "Int branch returns %s, expected %s" ret.value_var n
      | _ -> fail "Int branch must bind label and integer"
    in
    let* var_branch = branch "Var" branches in
    let* var_ret =
      match var_branch.vars with
      | [ _label; xid ] ->
          let* _label, v, body =
            expect_let_call "Var branch" "lookup" [ eval_env; xid ]
              var_branch.body
          in
          let* ret = expect_return "Var branch return" body in
          if ret.value_var = v then Ok ret
          else fail "Var branch returns %s, expected %s" ret.value_var v
      | _ -> fail "Var branch must bind label and variable id"
    in
    let binary_branch tag op =
      let* b = branch tag branches in
      match b.vars with
      | [ _label; left; right ] ->
          let* left_label, left_value, after_left =
            expect_let_call (tag ^ " left") "eval"
              [ left; eval_env; eval_defs ]
              b.body
          in
          let* right_label, right_value, after_right =
            expect_let_call (tag ^ " right") "eval"
              [ right; eval_env; eval_defs ]
              after_left
          in
          let* result_var, ret_cmd =
            expect_let_prim (tag ^ " result") op
              [ left_value; right_value ]
              after_right
          in
          let* ret = expect_return (tag ^ " return") ret_cmd in
          if ret.value_var = result_var then
            Ok (left_label, right, right_label, left_value, ret)
          else
            fail "%s branch returns %s, expected %s" tag ret.value_var
              result_var
      | _ -> fail "%s branch must bind label and two subexpressions" tag
    in
    let* sub1_label, sub1_right, sub2_label, sub2_left_value, sub_ret =
      binary_branch "Sub" "sub"
    in
    let* mul1_label, mul1_right, mul2_label, mul2_left_value, mul_ret =
      binary_branch "Mul" "mul"
    in
    let* let_branch = branch "Let" branches in
    let* let1_label, let_name, let_body, let2_label, let_ret =
      match let_branch.vars with
      | [ _label; name; bound; body_expr ] ->
          let* let1_label, bound_value, after_bound =
            expect_let_call "Let bound" "eval"
              [ bound; eval_env; eval_defs ]
              let_branch.body
          in
          let* _extend_label, new_env, after_extend =
            expect_let_call "Let extend" "extend"
              [ eval_env; name; bound_value ]
              after_bound
          in
          let* let2_label, result_var, after_body =
            expect_let_call "Let body" "eval"
              [ body_expr; new_env; eval_defs ]
              after_extend
          in
          let* ret = expect_return "Let return" after_body in
          if ret.value_var = result_var then
            Ok (let1_label, name, body_expr, let2_label, ret)
          else
            fail "Let branch returns %s, expected %s" ret.value_var result_var
      | _ -> fail "Let branch must bind label, variable, bound, and body"
    in
    let* app_branch = branch "App" branches in
    let* app1_label, app_fn, app2_label, app_ret =
      match app_branch.vars with
      | [ _label; fn; arg ] ->
          begin match app_branch.body.desc with
          | Match_ { scrutinee; branches = fn_branches }
            when exp_is_var fn scrutinee ->
              let* fun_branch = branch "Fun" fn_branches in
              begin match fun_branch.vars with
              | [ fid ] ->
                  let* app1_label, arg_value, after_arg =
                    expect_let_call "App argument" "eval"
                      [ arg; eval_env; eval_defs ]
                      fun_branch.body
                  in
                  let* _body_lookup_label, body_var, after_lookup =
                    expect_let_call "App fundef" "fundef" [ eval_defs; fid ]
                      after_arg
                  in
                  let* call_env, after_extend =
                    find_extend_call arg_value after_lookup
                  in
                  let* app2_label, result_var, after_body =
                    find_eval_call
                      [ body_var; call_env; eval_defs ]
                      after_extend
                  in
                  let* ret = expect_return "App return" after_body in
                  if ret.value_var = result_var then
                    Ok (app1_label, fn, app2_label, ret)
                  else
                    fail "App branch returns %s, expected %s" ret.value_var
                      result_var
              | _ -> fail "Fun branch must bind the function id"
              end
          | _ -> fail "App branch must match its function value"
          end
      | _ -> fail "App branch must bind label, function, and argument"
    in
    let* ifz_branch = branch "Ifz" branches in
    let* ifz1_label, ifz_then, ifz_else, ifz_then_ret, ifz_else_ret =
      match ifz_branch.vars with
      | [ _label; test; then_expr; else_expr ] ->
          let* ifz1_label, test_value, after_test =
            expect_let_call "Ifz test" "eval"
              [ test; eval_env; eval_defs ]
              ifz_branch.body
          in
          begin match after_test.desc with
          | Match_
              {
                scrutinee =
                  {
                    desc =
                      Prim { op = "iszero"; args = [ { desc = Var_ v; _ } ] };
                    _;
                  };
                branches = bool_branches;
              }
            when v = test_value ->
              let* true_branch = branch "True" bool_branches in
              let* false_branch = branch "False" bool_branches in
              let branch_eval context expected_expr branch =
                let* _label, result_var, after_body =
                  expect_let_call context "eval"
                    [ expected_expr; eval_env; eval_defs ]
                    branch.Cmd.body
                in
                let* ret = expect_return (context ^ " return") after_body in
                if ret.value_var = result_var then Ok ret
                else
                  fail "%s returns %s, expected %s" context ret.value_var
                    result_var
              in
              let* then_ret = branch_eval "Ifz then" then_expr true_branch in
              let+ else_ret = branch_eval "Ifz else" else_expr false_branch in
              (ifz1_label, then_expr, else_expr, then_ret, else_ret)
          | _ -> fail "Ifz branch must match iszero(test value)"
          end
      | _ -> fail "Ifz branch must bind label, test, then, and else"
    in
    Ok
      {
        eval_label = eval_def.body.label;
        eval_exp;
        eval_env;
        eval_defs;
        main_program;
        main_arg;
        int_ret;
        var_ret;
        sub_ret;
        mul_ret;
        let_ret;
        app_ret;
        ifz_then_ret;
        ifz_else_ret;
        sub1_label;
        sub1_right;
        sub2_label;
        sub2_left_value;
        mul1_label;
        mul1_right;
        mul2_label;
        mul2_left_value;
        let1_label;
        let_name;
        let_body;
        let2_label;
        app1_label;
        app_fn;
        app2_label;
        ifz1_label;
        ifz_then;
        ifz_else;
      }

  let ret_var points label =
    [
      points.int_ret;
      points.var_ret;
      points.sub_ret;
      points.mul_ret;
      points.let_ret;
      points.app_ret;
      points.ifz_then_ret;
      points.ifz_else_ret;
    ]
    |> List.find_map (fun ret ->
        if label_eq ret.label label then Some ret.value_var else None)
end

module Project = struct
  open Interpreter_points

  let decode_expr_binding name env =
    let* value = find_env name env in
    Decode.expr value

  let decode_env_binding name env =
    let* value = find_env name env in
    Decode.env value

  let decode_int_binding name env =
    let* value = find_env name env in
    Decode.int_value ("binding " ^ name) value

  let decode_fun_binding name env =
    let* value = find_env name env in
    Decode.fun_id ("binding " ^ name) value

  let decode_var_binding name env =
    let* value = find_env name env in
    Decode.var_id ("binding " ^ name) value

  let rec kont points = function
    | [] -> Ok []
    | (frame : Cek.frame) :: rest ->
        let* rest = kont points rest in
        if label_eq frame.label points.sub1_label then
          let* right = decode_expr_binding points.sub1_right frame.env in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Sub1 { right; env } :: rest
        else if label_eq frame.label points.sub2_label then
          let* left_value =
            decode_int_binding points.sub2_left_value frame.env
          in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Sub2 { left_value; env } :: rest
        else if label_eq frame.label points.mul1_label then
          let* right = decode_expr_binding points.mul1_right frame.env in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Mul1 { right; env } :: rest
        else if label_eq frame.label points.mul2_label then
          let* left_value =
            decode_int_binding points.mul2_left_value frame.env
          in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Mul2 { left_value; env } :: rest
        else if label_eq frame.label points.let1_label then
          let* name = decode_var_binding points.let_name frame.env in
          let* body = decode_expr_binding points.let_body frame.env in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.LetK { name; body; env } :: rest
        else if label_eq frame.label points.let2_label then
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Restore env :: rest
        else if label_eq frame.label points.app1_label then
          let* fn = decode_fun_binding points.app_fn frame.env in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.AppK { fn; env } :: rest
        else if label_eq frame.label points.app2_label then
          let+ env = decode_env_binding points.eval_env frame.env in
          T.Restore env :: rest
        else if label_eq frame.label points.ifz1_label then
          let* then_ = decode_expr_binding points.ifz_then frame.env in
          let* else_ = decode_expr_binding points.ifz_else frame.env in
          let+ env = decode_env_binding points.eval_env frame.env in
          T.IfzK { then_; else_; env } :: rest
        else Ok rest

  let state points (s : Cek.state) =
    if label_eq s.label points.eval_label then
      let* control = decode_expr_binding points.eval_exp s.env in
      let* env = decode_env_binding points.eval_env s.env in
      let+ kont = kont points s.kont in
      Some { T.control = Expr control; env; kont }
    else
      match Interpreter_points.ret_var points s.label with
      | None -> Ok None
      | Some value_var ->
          let* value = decode_int_binding value_var s.env in
          let* env = decode_env_binding points.eval_env s.env in
          let+ kont = kont points s.kont in
          Some { T.control = Value value; env; kont }
end

type projected_row = { source_index : int; state : T.state }

type extracted_trace = {
  defs : T.defs;
  initial : T.state;
  rows : projected_row array;
}

type projected_row_view = {
  source_index : int;
  control : string;
  env : string;
  kont : string array;
}

let initial_state points (s : Cek.state) =
  let* program_value = find_env points.Interpreter_points.main_program s.env in
  let* arg_value = find_env points.main_arg s.env in
  let* arg = Decode.int_value "main argument" arg_value in
  let* defs, body = Decode.program program_value in
  let env = IntMap.singleton 0 arg in
  Ok (defs, { T.control = Expr body; env; kont = [] })

let extract_trace (prog : program) (trace : Cek.trace) =
  let* points = Interpreter_points.of_program prog in
  if Array.length trace.states = 0 then fail "cannot extract an empty S trace"
  else
    let* defs, initial = initial_state points trace.states.(0) in
    let rows = ref [] in
    let last = ref None in
    let* () =
      trace.states |> Array.to_list
      |> List.mapi (fun source_index state -> (source_index, state))
      |> List.fold_left
           (fun acc (source_index, s_state) ->
             let* () = acc in
             let* projected = Project.state points s_state in
             match projected with
             | None -> Ok ()
             | Some state ->
                 if
                   match !last with
                   | Some previous -> previous = state
                   | None -> false
                 then Ok ()
                 else (
                   last := Some state;
                   rows := { source_index; state } :: !rows;
                   Ok ()))
           (Ok ())
    in
    let rows = !rows |> List.rev |> Array.of_list in
    if Array.length rows > 0 && rows.(0).state <> initial then
      fail "first projected T state does not match decoded initial T state"
    else Ok { defs; initial; rows }

let verify_trace (prog : program) (trace : Cek.trace) =
  let* extracted = extract_trace prog trace in
  let rec loop i =
    if i + 1 >= Array.length extracted.rows then Ok ()
    else
      let cur = extracted.rows.(i).state in
      let next = extracted.rows.(i + 1).state in
      match T.step extracted.defs cur with
      | Ok (Step expected) when expected = next -> loop (i + 1)
      | Ok (Step expected) ->
          fail "projected row %d does not follow T step: expected %s, got %s" i
            (T.show_state expected) (T.show_state next)
      | Ok Final -> fail "projected row %d is final but has a successor" i
      | Error message -> Error message
  in
  loop 0

let view_trace extracted =
  extracted.rows
  |> Array.map (fun (row : projected_row) ->
      {
        source_index = row.source_index;
        control = T.show_control row.state.control;
        env = T.show_env row.state.env;
        kont = row.state.kont |> List.map T.show_frame |> Array.of_list;
      })

let projected_length extracted = Array.length extracted.rows
let show_state = T.show_state
