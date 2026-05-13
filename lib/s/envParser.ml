open Utils

exception Lex_error of string

let token lexbuf =
  match EnvLexer.token lexbuf with
  | `Token token -> token
  | `Fail message -> raise (Lex_error message)

let at lexbuf =
  let pos = lexbuf.Lexing.lex_curr_p in
  Printf.sprintf "line %d, column %d" pos.pos_lnum (pos.pos_cnum - pos.pos_bol)

let parse_with parser src =
  let lexbuf = Lexing.from_string src in
  try Ok (parser token lexbuf) with
  | Lex_error message -> Error (Printf.sprintf "%s: %s" (at lexbuf) message)
  | EnvGrammar.Error -> Error (Printf.sprintf "%s: syntax error" (at lexbuf))

let parseValue1 src = parse_with EnvGrammar.value_eof src

let parseEnv src =
  match parse_with EnvGrammar.env_eof src with
  | Ok bindings -> Ok (StringMap.of_list bindings)
  | Error message -> Error message
