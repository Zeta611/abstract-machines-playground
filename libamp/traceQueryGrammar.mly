%token LPAREN "("
%token RPAREN ")"
%token AND "&&"
%token OR "||"
%token NOT "!"
%token EQ "="
%token NEQ "!="
%token GT ">"
%token GTE ">="
%token LT "<"
%token LTE "<="
%token EOF
%token <string> WORD
%token <string> STRING

%start <TraceQueryData.ast option> query_eof

%{
open TraceQueryData
%}

%%

query_eof:
  | EOF { None }
  | expr=or_expr EOF { Some expr }

or_expr:
  | left=or_expr "||" right=and_expr { Or { left; right } }
  | expr=and_expr { expr }

and_expr:
  | left=and_expr "&&" right=not_expr { And { left; right } }
  | expr=not_expr { expr }

not_expr:
  | "!" expr=not_expr { Not expr }
  | expr=primary { expr }

primary:
  | "(" expr=or_expr ")" { expr }
  | expr=term { expr }

term:
  | field_name=WORD operator=operator value=value_token
    {
      make_field_term ~field_name ~operator ~value
        ~field_at:$startpos(field_name).Lexing.pos_cnum
        ~op_at:$startpos(operator).Lexing.pos_cnum
        ~value_at:$startpos(value).Lexing.pos_cnum
    }
  | value=WORD { Term { field = None; op = Eq; value } }
  | value=STRING { Term { field = None; op = Eq; value } }

operator:
  | "=" { EqToken }
  | "!=" { NeqToken }
  | ">" { GtToken }
  | ">=" { GteToken }
  | "<" { LtToken }
  | "<=" { LteToken }

value_token:
  | value=WORD { value }
  | value=STRING { value }
