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

let error_at loc message =
  Printf.sprintf "%s at characters %d-%d" message loc.Ast.from loc.Ast.to_

let ( let* ) = Result.bind

(* Function-call ANF depends on the full program namespace: lowercase calls
   parse as primitive expressions until user-defined functions are known. *)
let validate_program (program : Ast.program) : (unit, string) result =
  let fun_names =
    program.defs |> Utils.StringMap.bindings |> List.map fst
    |> Utils.StringSet.of_list
  in
  let rec validate_exp (e : Ast.Exp.t) =
    match e.desc with
    | Num _ | Var_ _ -> Ok ()
    | Prim { op; args } ->
        if Utils.StringSet.mem op fun_names then
          Error
            (error_at e.loc
               ("function call '" ^ op
              ^ "' is not ANF; function calls must appear as let-bound calls \
                 with variable arguments"))
        else
          args
          |> List.fold_left
               (fun acc arg ->
                 let* () = acc in
                 validate_exp arg)
               (Ok ())
  in
  let rec validate_cmd (cmd : Ast.Cmd.t) =
    match cmd.desc with
    | Return _ -> Ok ()
    | Let_ { exp; body; _ } ->
        let* () = validate_exp exp in
        validate_cmd body
    | LetCall { body; _ } | LetTag { body; _ } -> validate_cmd body
    | Match_ { scrutinee; branches } ->
        let* () = validate_exp scrutinee in
        branches
        |> List.fold_left
             (fun acc (branch : Ast.Cmd.branch) ->
               let* () = acc in
               validate_cmd branch.body)
             (Ok ())
  in
  program.defs |> Utils.StringMap.bindings
  |> List.fold_left
       (fun acc (_, (def : Ast.def)) ->
         let* () = acc in
         validate_cmd def.body)
       (Ok ())

let parse (s : string) : (parse_result, string) result =
  let lexbuf = Lexing.from_string s in
  let rec loop checkpoint ranges =
    match checkpoint with
    | I.Accepted program ->
        let* () = validate_program program in
        Ok { program; ranges = ranges |> List.rev |> Array.of_list }
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
