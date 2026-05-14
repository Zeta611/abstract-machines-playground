module I = TraceQueryGrammar.MenhirInterpreter
open TraceQueryGrammar
include TraceQueryData

let token_text = function
  | LPAREN -> "("
  | RPAREN -> ")"
  | AND -> "&&"
  | OR -> "||"
  | NOT -> "!"
  | EQ -> "="
  | NEQ -> "!="
  | GT -> ">"
  | GTE -> ">="
  | LT -> "<"
  | LTE -> "<="
  | EOF -> ""
  | WORD text -> text
  | STRING text -> text

let syntax_error current input_len =
  match current with
  | None -> { message = "unexpected end of input"; at = input_len }
  | Some (EOF, _, _) -> { message = "unexpected end of input"; at = input_len }
  | Some (token, at, _) -> { message = "unexpected " ^ token_text token; at }

let parseTraceQuery input =
  let lexbuf = Lexing.from_string input in
  let input_len = String.length input in
  let rec loop checkpoint current =
    match checkpoint with
    | I.InputNeeded _ ->
        begin try
          let token = TraceQueryLexer.token lexbuf in
          let at = lexbuf.lex_start_p.pos_cnum in
          let startp = lexbuf.lex_start_p in
          let endp = lexbuf.lex_curr_p in
          loop
            (I.offer checkpoint (token, startp, endp))
            (Some (token, at, endp))
        with
        | TraceQueryLexer.Lex_error error -> Stdlib.Error error
        | Query_error error -> Stdlib.Error error
        end
    | I.Shifting _ | I.AboutToReduce _ -> loop (I.resume checkpoint) current
    | I.Accepted ast -> Stdlib.Ok ast
    | I.HandlingError _ | I.Rejected -> (
        match current with
        | None ->
            Stdlib.Error { message = "unexpected end of input"; at = input_len }
        | Some (EOF, _, _) ->
            Stdlib.Error { message = "unexpected end of input"; at = input_len }
        | Some (token, at, _) ->
            Stdlib.Error { message = "unexpected " ^ token_text token; at })
  in
  try loop (TraceQueryGrammar.Incremental.query_eof lexbuf.lex_curr_p) None
  with Query_error error -> Stdlib.Error error

let normalize value = String.lowercase_ascii value

let string_contains haystack needle =
  let haystack_len = String.length haystack in
  let needle_len = String.length needle in
  if needle_len = 0 then true
  else
    let rec loop i =
      if i + needle_len > haystack_len then false
      else if String.sub haystack i needle_len = needle then true
      else loop (i + 1)
    in
    loop 0

let string_of_rule_name = function
  | Cek.LetExp -> "LetExp"
  | Cek.LetCall -> "LetCall"
  | Cek.Match -> "Match"
  | Cek.Return -> "Return"
  | Cek.LetTag -> "LetTag"

let label_matches (term : term_payload) label =
  match term.op with
  | Eq -> string_of_int label = term.value
  | Gt ->
      begin match parse_integer_literal term.value with
      | Some value -> label > value
      | None -> false
      end
  | Gte ->
      begin match parse_integer_literal term.value with
      | Some value -> label >= value
      | None -> false
      end
  | Lt ->
      begin match parse_integer_literal term.value with
      | Some value -> label < value
      | None -> false
      end
  | Lte ->
      begin match parse_integer_literal term.value with
      | Some value -> label <= value
      | None -> false
      end

let term_matches (term : term_payload) (row : row) =
  let needle = normalize term.value in
  let label = string_of_int row.label in
  match term.field with
  | Some Rule ->
      let rule =
        match row.rule with
        | Some rule -> normalize (string_of_rule_name rule)
        | None -> ""
      in
      rule = needle
  | Some Detail ->
      let detail =
        match row.detail with Some detail -> normalize detail | None -> ""
      in
      string_contains detail needle
  | Some L -> label_matches term row.label
  | None ->
      let haystack =
        String.concat " "
          [
            (match row.rule with
            | Some rule -> string_of_rule_name rule
            | None -> "");
            (match row.detail with Some detail -> detail | None -> "");
            (match row.value with Some value -> value | None -> "");
            label;
          ]
        |> normalize
      in
      string_contains haystack needle

let rec traceQueryMatches ast row =
  match ast with
  | None -> true
  | Some (And { left; right }) ->
      traceQueryMatches (Some left) row && traceQueryMatches (Some right) row
  | Some (Or { left; right }) ->
      traceQueryMatches (Some left) row || traceQueryMatches (Some right) row
  | Some (Not expr) -> not (traceQueryMatches (Some expr) row)
  | Some (Term term) -> term_matches term row
