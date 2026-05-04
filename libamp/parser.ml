type syntax_kind =
  | Keyword [@mel.as "keyword"]
  | Identifier [@mel.as "identifier"]
  | Constructor [@mel.as "constructor"]
  | Number [@mel.as "number"]
  | Comment [@mel.as "comment"]
  | Punctuation [@mel.as "punctuation"]

type syntax_range = { kind : syntax_kind; from : int; to_ : int }
type parse_result = { program : Ast.program; ranges : syntax_range array }

module I = Grammar.MenhirInterpreter

external console_log : 'a -> unit = "console.log"

let parse (s : string) : (parse_result, string) result =
  let lexbuf = Lexing.from_string s in
  let rec loop checkpoint ranges =
    match checkpoint with
    | I.Accepted program -> Ok { program; ranges = ranges |> List.rev |> Array.of_list }
    | I.InputNeeded _ ->
        begin match Lexer.token lexbuf with
        | `Token token ->
            let startp = lexbuf.lex_start_p in
            let endp = lexbuf.lex_curr_p in
            let checkpoint = I.offer checkpoint (token, startp, endp) in
            let kind =
              match token with
              | LET | IN | MATCH | WITH | END -> Some Keyword
              | LPAREN | RPAREN | PIPE | EQ | COMMA | ARROW -> Some Punctuation
              | UIDENT _ -> Some Constructor
              | LIDENT _ -> Some Identifier
              | INTEGER _ -> Some Number
              | _ -> None
            in
            let ranges =
              match kind with
              | Some kind ->
                  { kind; from = startp.pos_cnum; to_ = endp.pos_cnum }
                  :: ranges
              | None -> ranges
            in
            loop checkpoint ranges
        | `Fail msg ->
            let pos = lexbuf.lex_curr_p in
            Error
              (Printf.sprintf "Lexing error at line %d, column %d: %s"
                 pos.Lexing.pos_lnum
                 (pos.Lexing.pos_cnum - pos.Lexing.pos_bol)
                 msg)
        | `Comment _ -> loop checkpoint ranges
        end
    | I.Shifting _ | I.AboutToReduce _ -> loop (I.resume checkpoint) ranges
    | I.Rejected | I.HandlingError _ ->
        let pos = lexbuf.lex_curr_p in
        Error
          (Printf.sprintf "Syntax error at line %d, column %d"
             pos.Lexing.pos_lnum
             (pos.Lexing.pos_cnum - pos.Lexing.pos_bol))
  in
  loop (Grammar.Incremental.program lexbuf.lex_curr_p) []
