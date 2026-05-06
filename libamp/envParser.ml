open Utils
open Values

exception Env_error of string

type lexer = { src : string; mutable i : int }

let failf fmt = Printf.ksprintf (fun msg -> raise (Env_error msg)) fmt

let make_lexer src = { src; i = 0 }

let peek lex =
  if lex.i < String.length lex.src then Some lex.src.[lex.i] else None

let is_space = function
  | ' ' | '\t' | '\n' | '\r' -> true
  | _ -> false

let skip_space lex =
  while lex.i < String.length lex.src && is_space lex.src.[lex.i] do
    lex.i <- lex.i + 1
  done

let eat_char lex c =
  skip_space lex;
  match peek lex with
  | Some got when got = c ->
      lex.i <- lex.i + 1;
      true
  | _ -> false

let expect_char lex c =
  skip_space lex;
  match peek lex with
  | Some got when got = c -> lex.i <- lex.i + 1
  | Some got ->
      failf "expected '%c' at position %d, got '%c'" c lex.i got
  | None -> failf "expected '%c' at position %d, got '<eof>'" c lex.i

let is_ident_start = function
  | 'a' .. 'z' | 'A' .. 'Z' | '_' -> true
  | _ -> false

let is_ident_char = function
  | 'a' .. 'z' | 'A' .. 'Z' | '0' .. '9' | '_' -> true
  | _ -> false

let read_ident lex =
  skip_space lex;
  let start = lex.i in
  match peek lex with
  | Some c when is_ident_start c ->
      lex.i <- lex.i + 1;
      while lex.i < String.length lex.src && is_ident_char lex.src.[lex.i] do
        lex.i <- lex.i + 1
      done;
      String.sub lex.src start (lex.i - start)
  | _ -> failf "expected identifier at position %d" lex.i

let read_int_opt lex =
  skip_space lex;
  let start = lex.i in
  begin
    match peek lex with
    | Some '-' -> lex.i <- lex.i + 1
    | _ -> ()
  end;
  let digits_start = lex.i in
  while
    lex.i < String.length lex.src
    &&
    match lex.src.[lex.i] with
    | '0' .. '9' -> true
    | _ -> false
  do
    lex.i <- lex.i + 1
  done;
  if lex.i = digits_start then (
    lex.i <- start;
    None)
  else Some (int_of_string (String.sub lex.src start (lex.i - start)))

let at_eof lex =
  skip_space lex;
  lex.i >= String.length lex.src

let is_tag_name name =
  String.length name > 0
  &&
  match name.[0] with
  | 'A' .. 'Z' -> true
  | _ -> false

let rec parse_value lex =
  skip_space lex;
  match read_int_opt lex with
  | Some n -> vInt n
  | None ->
      let name = read_ident lex in
      if not (is_tag_name name) then
        failf "expected integer or constructor tag (UpperCase), got '%s'" name;
      let args = ref [] in
      if eat_char lex '(' then (
        if not (eat_char lex ')') then (
          args := [ parse_value lex ];
          while eat_char lex ',' do
            args := parse_value lex :: !args
          done;
          expect_char lex ')'));
      vCtor name (List.rev !args)

let parseValue1 src =
  try
    let lex = make_lexer src in
    let value = parse_value lex in
    if not (at_eof lex) then failf "unexpected trailing input";
    Ok value
  with
  | Env_error msg -> Error msg

let parseBinding line =
  try
    let lex = make_lexer line in
    let name = read_ident lex in
    if not (eat_char lex '=') then
      failf "expected '=' after binding name '%s'" name;
    let value = parse_value lex in
    if not (at_eof lex) then failf "unexpected trailing input after value";
    Ok (name, value)
  with
  | Env_error msg -> Error msg

let trim_trailing_cr s =
  let len = String.length s in
  if len > 0 && s.[len - 1] = '\r' then String.sub s 0 (len - 1) else s

let parseEnv src =
  let lines = String.split_on_char '\n' src in
  let rec loop line_no acc = function
    | [] -> Ok (StringMap.of_array (Array.of_list (List.rev acc)))
    | raw :: rest ->
        let raw = trim_trailing_cr raw in
        let trimmed = String.trim raw in
        if trimmed = "" || String.starts_with ~prefix:"#" trimmed then
          loop (line_no + 1) acc rest
        else
          begin
            match parseBinding raw with
            | Ok binding -> loop (line_no + 1) (binding :: acc) rest
            | Error msg -> Error (Printf.sprintf "line %d: %s" line_no msg)
          end
  in
  loop 1 [] lines
