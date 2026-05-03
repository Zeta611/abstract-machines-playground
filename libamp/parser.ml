open ParseUtils

type parse_result = { program : Ast.program; ranges : syntax_range array }

let parse (s : string) : (parse_result, string) result =
  let lexbuf = Lexing.from_string s in
  let ranges = ref [] in
  try
    let program = Grammar.program (Lexer.token ranges) lexbuf in
    let ranges =
      !ranges
      |> List.sort_uniq (fun r1 r2 -> compare r1.from r2.from)
      |> Array.of_list
    in
    Ok { program; ranges }
  with
  | Grammar.Error ->
      let pos = lexbuf.lex_curr_p in
      Error
        (Printf.sprintf "Syntax error at line %d, column %d" pos.Lexing.pos_lnum
           (pos.Lexing.pos_cnum - pos.Lexing.pos_bol))
  | Failure msg ->
      let pos = lexbuf.lex_curr_p in
      Error
        (Printf.sprintf "Error at line %d, column %d: %s" pos.Lexing.pos_lnum
           (pos.Lexing.pos_cnum - pos.Lexing.pos_bol)
           msg)
