%token LET "let"
%token IN "in"
%token MATCH "match"
%token WITH "with"
%token END "end"
%token ARROW "=>"
%token EQ "="
%token PIPE "|"
%token LPAREN "("
%token RPAREN ")"
%token COMMA ","
%token EOF
%token <int> INTEGER
%token <string> UIDENT
%token <string> LIDENT

%start <Ast.program> program

%{
open Ast
open ParseUtils
%}

%%

program:
  | defs=fun_def+ EOF { p defs }

fun_def:
  | name=fun_name "(" params=separated_list(",", LIDENT) ")" "=" body=cmd
    { d $loc name (params |> Array.of_list) body }

fun_name:
  | name=LIDENT { name }

cmd:
  | "let" x=LIDENT "=" exp=exp "in" body=cmd
    { let_ $loc x exp body }
  | "let" x=LIDENT "=" name=UIDENT "(" args=separated_list(",", exp) ")" "in" body=cmd
    { c $loc (
        let* args = seq args in
        let* body = body in
        M.unit (Cmd.LetTag { tag = name; args = args |> Array.of_list; body = body })) }
  | "match" scrutinee=exp "with" branches=nonempty_list(branch) "end"
    { c $loc (
        let* scrutinee = scrutinee in
        let* branches = seq branches in
        M.unit (Cmd.Match_ { scrutinee = scrutinee; branches = branches |> Array.of_list })) }
  | exp=exp
    { c $loc (let* exp = exp in M.unit (Cmd.Return exp)) }

branch:
  | "|" tag=UIDENT "(" params=separated_list(",", LIDENT) ")" "=>" body=cmd
    { let* body = body in
      b $loc tag (params |> Array.of_list) body }

exp:
  | n=INTEGER { e $loc (Exp.Num n) }
  | name=fun_name "(" args=separated_list(",", exp) ")"
    { let* args = seq args in
      e $loc (Exp.Prim { op = name; args = args |> Array.of_list }) }
  | name=LIDENT { e $loc (Exp.Var_ name) }
