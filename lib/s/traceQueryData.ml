open Cek

type field =
  | Rule [@mel.as "rule"]
  | Detail [@mel.as "detail"]
  | L [@mel.as "l"]

type comparison_op =
  | Eq [@mel.as "eq"]
  | Gt [@mel.as "gt"]
  | Gte [@mel.as "gte"]
  | Lt [@mel.as "lt"]
  | Lte [@mel.as "lte"]

type ast =
  | And of binary_payload
  | Or of binary_payload
  | Not of ast
  | Term of term_payload

and binary_payload = { left : ast; right : ast }
and term_payload = { field : field option; op : comparison_op; value : string }

type row = {
  index : int;
  rule : rule_name option;
  detail : string option;
  value : string option;
  label : int;
}

type parse_error = { message : string; at : int }

type operator = EqToken | NeqToken | GtToken | GteToken | LtToken | LteToken

exception Query_error of parse_error

let raise_error ~at message = raise (Query_error { message; at })

let operator_text = function
  | EqToken -> "="
  | NeqToken -> "!="
  | GtToken -> ">"
  | GteToken -> ">="
  | LtToken -> "<"
  | LteToken -> "<="

let comparison_op_of_operator = function
  | EqToken | NeqToken -> Eq
  | GtToken -> Gt
  | GteToken -> Gte
  | LtToken -> Lt
  | LteToken -> Lte

let field_of_string_opt value =
  match String.lowercase_ascii value with
  | "rule" -> Some Rule
  | "detail" -> Some Detail
  | "l" -> Some L
  | _ -> None

let parse_integer_literal value =
  try Some (int_of_string value) with
  | Failure _ -> None

let make_field_term ~field_name ~operator ~value ~field_at ~op_at ~value_at =
  let field =
    match field_of_string_opt field_name with
    | Some field -> field
    | None -> raise_error ~at:field_at ("unknown field " ^ field_name)
  in
  let comparison_op = comparison_op_of_operator operator in
  if comparison_op <> Eq && field <> L then
    raise_error ~at:op_at
      ("field " ^ field_name ^ " does not support " ^ operator_text operator);
  if comparison_op <> Eq && parse_integer_literal value = None then
    raise_error ~at:value_at
      ("expected integer after " ^ field_name ^ operator_text operator);
  let term = Term { field = Some field; op = comparison_op; value } in
  match operator with
  | NeqToken -> Not term
  | _ -> term
