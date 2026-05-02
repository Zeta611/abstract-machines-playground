{
open Grammar
}

let digit = ['0'-'9']
let lower = ['a'-'z' '_']
let ident_char = ['a'-'z' 'A'-'Z' '0'-'9' '_' '\'']
let upper = ['A'-'Z']
let spaces = [' ' '\t' '\n' '\r']+

rule token = parse
  | spaces { token lexbuf }
  | '#' [^ '\n']* { token lexbuf }

  (* Keywords *)
  | "let"   { LET }
  | "in"    { IN }
  | "match" { MATCH }
  | "with"  { WITH }
  | "end"   { END }

  (* Symbols *)
  | "=>"    { ARROW }
  | "="     { EQ }
  | "|"     { PIPE }
  | "("     { LPAREN }
  | ")"     { RPAREN }
  | ","     { COMMA }

  (* Integer literal (optional leading -) *)
  | ('-'? digit+) as i {
      try INTEGER (int_of_string i) with Failure _ ->
        failwith ("Integer literal out of range: " ^ i)
    }

  (* Identifiers: start with lower or upper, followed by ident_char *)
  | lower ident_char* as id { IDENT id }
  | upper ident_char* as id { IDENT id }

  | eof { EOF }

  | _ as c {
      let pos = lexbuf.lex_curr_p in
      let msg = Printf.sprintf "Unexpected character '%c' at line %d" c pos.pos_lnum in
      failwith msg
    }