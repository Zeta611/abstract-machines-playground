{
open EnvGrammar
}

let digit = ['0'-'9']
let lower = ['a'-'z' '_']
let ident_char = ['a'-'z' 'A'-'Z' '0'-'9' '_' '\'']
let upper = ['A'-'Z']
let newline = '\n' | '\r' | "\r\n"
let spaces = [' ' '\t']+

rule token = parse
  | spaces { token lexbuf }
  | newline { Lexing.new_line lexbuf; `Token NEWLINE }
  | '#' [^ '\n' '\r']* { token lexbuf }
  | "=" { `Token EQ }
  | "(" { `Token LPAREN }
  | ")" { `Token RPAREN }
  | "," { `Token COMMA }
  | ('-'? digit+) as i {
      try `Token (INTEGER (int_of_string i)) with Failure _ ->
        `Fail ("Integer literal out of range: " ^ i)
    }
  | lower ident_char* as id { `Token (IDENT id) }
  | upper ident_char* as id { `Token (UIDENT id) }
  | eof { `Token EOF }
  | _ as c { `Fail ("Unexpected character: " ^ String.make 1 c) }
