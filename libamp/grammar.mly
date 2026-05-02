%token LET IN MATCH WITH END
%token ARROW EQ PIPE LPAREN RPAREN COMMA EOF
%token <int> INTEGER
%token <string> LOWERIDENT UPPERIDENT

%start program
%type <Cst.program> program

%%

program:
| defs=fun_def+ EOF { defs }

fun_def:
| name=fun_name params=param_list EQ body=cmd { (name, params, body) }

fun_name:
| id=LOWERIDENT { id }

param_list:
| LPAREN params=separated_list(COMMA, LOWERIDENT) RPAREN { params }

cmd:
| LET x=LOWERIDENT EQ exp=exp IN body=cmd
    { `Let (x, exp, body) }
| MATCH scrutinee=exp WITH branches=nonempty_list(branch) END
    { `Match (scrutinee, branches) }
| exp=exp { `Return exp }

branch:
| PIPE tag=UPPERIDENT LPAREN params=separated_list(COMMA, LOWERIDENT) RPAREN ARROW body=cmd
    { (tag, params, body) }

exp:
| n=INTEGER { `Int n }
| name=ident LPAREN args=separated_list(COMMA, exp) RPAREN
    { `App (name, args) }
| name=LOWERIDENT { `Var name }

ident:
| id=LOWERIDENT { id }
| id=UPPERIDENT { id }