%token EQ "="
%token LPAREN "("
%token RPAREN ")"
%token COMMA ","
%token NEWLINE
%token EOF
%token <int> INTEGER
%token <string> UIDENT
%token <string> IDENT

%start <Values.value> value_eof
%start <(string * Values.value) list> env_eof

%{
open Values
%}

%%

padding:
  | NEWLINE* { () }

value_eof:
  | padding value padding EOF { $2 }

env_eof:
  | env_lines EOF { $1 }

env_lines:
  | { [] }
  | NEWLINE+ rest=env_lines { rest }
  | first=binding { [ first ] }
  | first=binding NEWLINE+ rest=env_lines { first :: rest }

binding:
  | name=binding_name "=" value=value { (name, value) }

binding_name:
  | name=IDENT { name }
  | name=UIDENT { name }

value:
  | n=INTEGER { vInt n }
  | tag=UIDENT args=ctor_args { vCtor tag args }

ctor_args:
  | { [] }
  | "(" args=separated_list(",", value) ")" { args }
