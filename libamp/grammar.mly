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
| name=LIDENT "(" params=separated_list(",", LIDENT) ")" "=" body=cmd
    { d $loc name (params |> Array.of_list) body }

cmd:
| "let" x=LIDENT "=" exp=exp "in" body=cmd
    { let* exp = exp in
      let* body = body in
      let_ $loc x exp body }
| "match" scrutinee=exp "with" branches=nonempty_list(branch) "end"
    { 
      let* scrutinee = scrutinee in
      let* branches = seq branches in
      c $loc (Cmd.match_ { scrutinee = scrutinee; branches = branches |> Array.of_list }) }
| exp=exp
    { let* exp = exp in
      c $loc (Cmd.return exp) }

branch:
| "|" tag=UIDENT "(" params=separated_list(",", LIDENT) ")" "=>" body=cmd
    { let* body = body in
      b $loc tag (params |> Array.of_list) body }

exp:
| n=INTEGER { e $loc (Exp.num n) }
| name=LIDENT "(" args=separated_list(",", exp) ")"
    { let* args = seq args in
      e $loc (Exp.prim { callee = name; args = args |> Array.of_list }) }
| name=UIDENT "(" args=separated_list(",", exp) ")"
    { let* args = seq args in
      e $loc (Exp.ctor { callee = name; args = args |> Array.of_list }) }
| name=LIDENT { e $loc (Exp.var_ name) }