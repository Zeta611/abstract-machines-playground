%token EQ "="
%token LPAREN "("
%token RPAREN ")"
%token COMMA ","
%token LBRACE "{"
%token RBRACE "}"
%token PIPE "|"
%token NEWLINE
%token EOF
%token <int> INTEGER
%token <string> UIDENT
%token <string> IDENT

%start <AbsSyntax.value> value_eof
%start <AbsSyntax.env> env_eof

%{
open AbsSyntax
%}

%%

value_eof:
  | padding value EOF { $2 }

env_eof:
  | env_lines EOF { $1 }

padding:
  | NEWLINE* { () }

env_lines:
  | { [] }
  | NEWLINE+ rest=env_lines { rest }
  | first=binding { [ first ] }
  | first=binding NEWLINE+ rest=env_lines { first :: rest }

binding:
  | name=binding_name padding "=" padding value=value { (name, value) }

binding_name:
  | name=IDENT { name }
  | name=UIDENT { name }

value:
  | atom=value_atom { [ atom ] }
  | "{" atoms=separated_nonempty_list("|", value_atom) "}" { atoms }

value_atom:
  | n=INTEGER { Int n }
  | tag=UIDENT args=ctor_args { Ctor (tag, args) }

ctor_args:
  | { [] }
  | "(" args=separated_list(arg_sep, value) ")" { args }

arg_sep:
  | padding COMMA padding { () }
