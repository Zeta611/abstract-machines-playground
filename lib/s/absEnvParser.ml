exception Lex_error of string

let token lexbuf =
  match AbsEnvLexer.token lexbuf with
  | `Token token -> token
  | `Fail message -> raise (Lex_error message)

let at lexbuf =
  let pos = lexbuf.Lexing.lex_curr_p in
  Printf.sprintf "line %d, column %d" pos.pos_lnum (pos.pos_cnum - pos.pos_bol)

let parse_with parser src =
  let lexbuf = Lexing.from_string src in
  try Ok (parser token lexbuf) with
  | Lex_error message -> Error (Printf.sprintf "%s: %s" (at lexbuf) message)
  | AbsEnvGrammar.Error -> Error (Printf.sprintf "%s: syntax error" (at lexbuf))

type build_state = { next_static : int; store : Abs.AbsVStore.t }

let alloc_static (state : build_state) : Abs.VAddr.Ptn.t * build_state =
  ( Abs.VAddr.Ptn.Static state.next_static,
    { state with next_static = state.next_static + 1 } )

let rec lower_value (state : build_state) (value : AbsSyntax.value) :
    Abs.AbsVal.t * build_state =
  List.fold_left
    (fun (joined, state) atom ->
      let atom_val, state = lower_atom state atom in
      (Abs.AbsVal.join joined atom_val, state))
    (Abs.AbsVal.bot, state) value

and lower_atom (state : build_state) (atom : AbsSyntax.atom) :
    Abs.AbsVal.t * build_state =
  match atom with
  | Int n -> (Abs.AbsVal.of_int n, state)
  | Ctor (tag, args) ->
      let arg_addrs, state =
        List.fold_left
          (fun (arg_addrs, state) arg ->
            let addr, state = alloc_value state arg in
            (Abs.VAddr.Abs.singleton addr :: arg_addrs, state))
          ([], state) args
      in
      ( Abs.AbsAdt.of_tag_args tag (List.rev arg_addrs) |> Abs.AbsVal.of_adt,
        state )

and alloc_value (state : build_state) (value : AbsSyntax.value) :
    Abs.VAddr.Ptn.t * build_state =
  let addr, state = alloc_static state in
  let abs_value, state = lower_value state value in
  let store = Abs.AbsVStore.add addr abs_value state.store in
  (addr, { state with store })

let lower_env (bindings : AbsSyntax.env) : Abs.AbsEnv.t * Abs.AbsVStore.t =
  let env, state =
    List.fold_left
      (fun (env, state) (name, value) ->
        let addr, state = alloc_value state value in
        (Abs.AbsEnv.add name (Abs.VAddr.Abs.singleton addr) env, state))
      (Abs.AbsEnv.bot, { next_static = 0; store = Abs.AbsVStore.bot })
      bindings
  in
  (env, state.store)

let parseAbsValue1 src = parse_with AbsEnvGrammar.value_eof src

let parseAbsEnvStore src =
  match parse_with AbsEnvGrammar.env_eof src with
  | Ok bindings -> Ok (lower_env bindings)
  | Error message -> Error message
