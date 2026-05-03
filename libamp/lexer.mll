{
open Grammar
open ParseUtils
let add_range (ranges: syntax_range list ref) (kind : syntax_kind) (lexbuf : Lexing.lexbuf) : unit =
  let from = lexbuf.Lexing.lex_start_p.pos_cnum in
  let to_ = lexbuf.Lexing.lex_curr_p.pos_cnum in
  ranges := { kind; from; to_ } :: !ranges
}

let digit = ['0'-'9']
let lower = ['a'-'z' '_']
let ident_char = ['a'-'z' 'A'-'Z' '0'-'9' '_' '\'']
let upper = ['A'-'Z']
let spaces = [' ' '\t' '\n' '\r']+

rule token ranges = parse
  | spaces { token ranges lexbuf }
  | '#' [^ '\n']* { add_range ranges Comment lexbuf; token ranges lexbuf }
  (* Keywords *)
  | "let"   { add_range ranges Keyword lexbuf; LET }
  | "in"    { add_range ranges Keyword lexbuf; IN }
  | "match" { add_range ranges Keyword lexbuf; MATCH }
  | "with"  { add_range ranges Keyword lexbuf; WITH }
  | "end"   { add_range ranges Keyword lexbuf; END }

  (* Punctuation *)
  | "=>"    { add_range ranges Punctuation lexbuf; ARROW }
  | "="     { add_range ranges Punctuation lexbuf; EQ }
  | "|"     { add_range ranges Punctuation lexbuf; PIPE }
  | "("     { add_range ranges Punctuation lexbuf; LPAREN }
  | ")"     { add_range ranges Punctuation lexbuf; RPAREN }
  | ","     { add_range ranges Punctuation lexbuf; COMMA }

  (* Integer literal (optional leading -) *)
  | ('-'? digit+) as i {
      add_range ranges Number lexbuf;
      try INTEGER (int_of_string i) with Failure _ ->
        failwith ("Integer literal out of range: " ^ i)
    }

  (* Identifiers: start with lower or upper, followed by ident_char *)
  | lower ident_char* as id { add_range ranges Identifier lexbuf; LIDENT id }
  | upper ident_char* as id { add_range ranges Constructor lexbuf; UIDENT id }

  | eof { EOF }

  | _ as c {
      let pos = lexbuf.lex_curr_p in
      let msg = Printf.sprintf "Unexpected character '%c' at line %d" c pos.pos_lnum in
      failwith msg
    }