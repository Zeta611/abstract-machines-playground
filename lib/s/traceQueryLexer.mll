{
open TraceQueryGrammar
open TraceQueryData

exception Lex_error of parse_error

let raise_lex lexbuf message =
  let at = Lexing.lexeme_start lexbuf in
  raise (Lex_error { message; at })
}

let whitespace = [' ' '\t' '\r' '\n']
let word_char = [^ ' ' '\t' '\r' '\n' '(' ')' '=' '!' '>' '<' '&' '|' '"']

rule token = parse
  | whitespace+ { token lexbuf }
  | "(" { LPAREN }
  | ")" { RPAREN }
  | "&&" { AND }
  | "||" { OR }
  | "=" "="? { EQ }
  | "!=" { NEQ }
  | "!" { NOT }
  | ">=" { GTE }
  | ">" { GT }
  | "<=" { LTE }
  | "<" { LT }
  | "&" { raise_lex lexbuf "expected &&" }
  | "|" { raise_lex lexbuf "expected ||" }
  | "\"" { string (Buffer.create 16) lexbuf }
  | word_char+ "\"" { raise_lex lexbuf "unexpected string quote" }
  | word_char+ as text { WORD text }
  | eof { EOF }
  | _ { raise_lex lexbuf ("Unexpected character: " ^ Lexing.lexeme lexbuf) }

and string buf = parse
  | "\"" { STRING (Buffer.contents buf) }
  | '\\' (_ as c) {
      Buffer.add_char buf c;
      string buf lexbuf
    }
  | '\\' {
      Buffer.add_char buf '\\';
      string buf lexbuf
    }
  | eof { raise_lex lexbuf "unterminated string" }
  | _ as c {
      Buffer.add_char buf c;
      string buf lexbuf
    }
