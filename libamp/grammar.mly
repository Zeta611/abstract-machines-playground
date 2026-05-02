%token LET IN MATCH WITH END
%token ARROW "=>"
%token EQ "=" 
%token PIPE "|"
%token LPAREN "("
%token RPAREN ")"
%token COMMA ","
%token EOF
%token <int> INTEGER
%token <string> IDENT

%start program
%type <Cst.program> program

%%

program:
| defs=fun_def+ EOF { defs }

fun_def:
| name=IDENT "(" params=separated_list(",", IDENT) ")" "=" body=cmd { (name, params, body) }

cmd:
| LET x=IDENT "=" exp=exp IN body=cmd
    { `Let (x, exp, body) }
| MATCH scrutinee=exp WITH branches=nonempty_list(branch) END
    { `Match (scrutinee, branches) }
| exp=exp { `Return exp }

branch:
| "|" tag=IDENT "(" params=separated_list(",", IDENT) ")" "=>" body=cmd
    { (tag, params, body) }

exp:
| n=INTEGER { `Int n }
| name=IDENT "(" args=separated_list(",", exp) ")"
    { `App (name, args) }
| name=IDENT { `Var name }