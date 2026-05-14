open Amp_lib_s

let interpreter_s_t =
  {|
# Interpreter I_S^T for language T.
#
# T syntax (encoded as S constructor values):
#   prog  ::= Prog(defs, exp)
#   defs  ::= Defs(Fun(int), exp, defs) | Nil()
#   env   ::= Env(Var(int, int), int, env) | Nil()
#   exp   ::= Int(int, int) | Var(int, int) | Sub(int, exp, exp) | Mul(int, exp, exp)
#           | Let(int, Var(int, int), exp, exp) | App(int, Fun(int), exp)
#           | Ifz(int, exp, exp, exp)

fundef(defs, fid) =
  match defs with
  | Defs(f, body, rest) =>
    match f with
    | Fun(fid2) =>
      match iszero(sub(fid, fid2)) with
      | True() => body
      | False() => let r = fundef(rest, fid) in r
      end
    end
  end

lookup(env, xid) =
  match env with
  | Env(x, val, rest) =>
    match x with
    | Var(l, xid2) =>
      match iszero(sub(xid, xid2)) with
      | True() => val
      | False() => let r = lookup(rest, xid) in r
      end
    end
  end

extend(env, x, val) =
  let r = Env(x, val, env) in r

eval(e, env, defs) =
  match e with
  | Int(l, n) => n
  | Var(l, xid) =>
    let v = lookup(env, xid) in v
  | Sub(l, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let v2 = eval(e2, env, defs) in
    let r = sub(v1, v2) in r
  | Mul(l, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let v2 = eval(e2, env, defs) in
    let r = mul(v1, v2) in r
  | Let(l, x, e1, e2) =>
    let v1 = eval(e1, env, defs) in
    let new_env = extend(env, x, v1) in
    let r = eval(e2, new_env, defs) in r
  | App(l, f, e1) =>
    match f with
    | Fun(fid) =>
      let v = eval(e1, env, defs) in
      let body = fundef(defs, fid) in
      let empty_env = Nil() in
      let l0 = 0 in
      let x0 = 0 in
      let x = Var(l0, x0) in
      let call_env = extend(empty_env, x, v) in
      let r = eval(body, call_env, defs) in r
    end
  | Ifz(l, e1, e2, e3) =>
    let v1 = eval(e1, env, defs) in
    match iszero(v1) with
    | True() => let r = eval(e2, env, defs) in r
    | False() => let r = eval(e3, env, defs) in r
    end
  end

main(p, arg) =
  match p with
  | Prog(defs, e) =>
    let empty_env = Nil() in
    let l0 = 0 in
    let x0 = 0 in
    let x = Var(l0, x0) in
    let initial_env = extend(empty_env, x, arg) in
    let r = eval(e, initial_env, defs) in r
  end
|}

let initial_env =
  {|
# A T program computing factorial, encoded as S constructor values.
#   fact(n) = ifz n then 1 else n * fact(n - 1)
# Fun(0) is fact; main applies it to the input arg.
p = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg = 5
|}

let failed = ref 0

let expect name cond detail =
  if cond then Printf.printf "  OK %s\n" name
  else (
    incr failed;
    match detail with
    | None -> Printf.eprintf "  FAIL %s\n" name
    | Some detail -> Printf.eprintf "  FAIL %s - %s\n" name detail)

let expect_ok name = function
  | Ok value ->
      Printf.printf "  OK %s\n" name;
      value
  | Error message ->
      incr failed;
      Printf.eprintf "  FAIL %s - %s\n" name message;
      exit 1

let trace_end_string = function
  | Cek.Final { value } -> "final: " ^ Values.showVal value
  | Cek.Stuck { reason; _ } -> "stuck: " ^ reason
  | Cek.Maxed { reason } -> "maxed: " ^ reason

let () =
  Printf.printf "OCaml S-to-T smoke test\n";
  let parsed = Parser.parse interpreter_s_t |> expect_ok "parse interpreter" in
  let env = EnvParser.parseEnv initial_env |> expect_ok "parse initial env" in
  let trace =
    Cek.run parsed.Parser.program env (Some { Cek.maxSteps = Some 20_000 })
  in
  expect "S trace terminates"
    (match trace.Cek.end_ with Cek.Final _ -> true | _ -> false)
    (Some (trace_end_string trace.Cek.end_));

  let extracted =
    S_to_t.extract_trace parsed.program trace |> expect_ok "extract T trace"
  in
  S_to_t.verify_trace parsed.program trace |> expect_ok "verify T trace";

  let rows = S_to_t.view_trace extracted in
  expect "projection is nonempty" (Array.length rows > 0) None;
  expect "projected length agrees with rows"
    (S_to_t.projected_length extracted = Array.length rows)
    None;

  (if Array.length rows > 0 then
     let last = rows.(Array.length rows - 1) in
     expect "final projected control is 120"
       (last.S_to_t.control = "120")
       (Some ("got " ^ last.control)));

  Printf.printf "S states: %d\n" (Array.length trace.states);
  Printf.printf "projected T states: %d\n" (Array.length rows);
  if !failed > 0 then (
    Printf.eprintf "FAILED: %d assertion(s)\n" !failed;
    exit 1);
  Printf.printf "all OCaml S-to-T smoke tests passed\n"
