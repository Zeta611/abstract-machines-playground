{
open Grammar
}

let digit = ['0'-'9']
let lower = ['a'-'z' '_']
let ident_char = ['a'-'z' 'A'-'Z' '0'-'9' '_' '\'']
let upper = ['A'-'Z']
let newline = '\n' | '\r' | "\r\n"
let spaces = [' ' '\t']+

rule token = parse
  | spaces { token lexbuf }
  | newline { Lexing.new_line lexbuf; token lexbuf }
  | '#' [^ '\n' '\r']* as comment { `Comment comment }
  (* Keywords *)
  | "let"   { `Token LET }
  | "in"    { `Token IN }
  | "match" { `Token MATCH }
  | "with"  { `Token WITH }
  | "end"   { `Token END }

  (* Punctuation *)
  | "=>"    { `Token ARROW }
  | "="     { `Token EQ }
  | "|"     { `Token PIPE }
  | "("     { `Token LPAREN }
  | ")"     { `Token RPAREN }
  | ","     { `Token COMMA }

  (* Integer literal (optional leading -) *)
  | ('-'? digit+) as i {
      try `Token (INTEGER (int_of_string i)) with Failure _ ->
        `Fail ("Integer literal out of range: " ^ i)
    }

  (* Identifiers: start with lower or upper, followed by ident_char *)
  | lower ident_char* as id { `Token (LIDENT id) }
  | upper ident_char* as id { `Token (UIDENT id) }

  | eof { `Token EOF }

  | _ as c {
      let pos = lexbuf.lex_curr_p in
      let msg = "Unexpected character '" ^ (String.make 1 c) ^ "' at line " ^ string_of_int pos.pos_lnum ^ ", column " ^ string_of_int (pos.pos_cnum - pos.pos_bol) in
      `Fail msg
    }
