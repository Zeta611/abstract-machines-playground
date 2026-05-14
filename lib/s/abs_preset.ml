open Ast
open Utils

let rec labels_of_cmd (cmd : Cmd.t) : Label.t list =
  let tail =
    match cmd.desc with
    | Return _ -> []
    | Let_ { body; _ } | LetCall { body; _ } | LetTag { body; _ } ->
        labels_of_cmd body
    | Match_ { branches; _ } ->
        branches
        |> List.concat_map (fun (branch : Cmd.branch) ->
            labels_of_cmd branch.body)
  in
  cmd.label :: tail

let all_labels (prog : program) : (module Abs.PARAM) =
  let labels =
    prog.ctrl |> LabelMap.bindings |> List.map fst |> Array.of_list
  in
  (module struct
    type label_ptn = unit

    let ptn_of_label (_ : Label.t) : label_ptn = ()
    let labels_of_ptn (_ : label_ptn) : Label.t array = labels
    let prog = prog
  end : Abs.PARAM)

let by_function (prog : program) : (module Abs.PARAM) =
  let label_owner =
    prog.defs |> StringMap.bindings
    |> List.fold_left
         (fun owners (name, def) ->
           labels_of_cmd def.body
           |> List.fold_left
                (fun owners label -> LabelMap.add label name owners)
                owners)
         LabelMap.empty
  in
  let labels_by_function =
    prog.defs |> StringMap.bindings
    |> List.map (fun (name, def) ->
        (name, labels_of_cmd def.body |> Array.of_list))
    |> StringMap.of_list
  in
  (module struct
    type label_ptn = string

    let ptn_of_label (label : Label.t) : label_ptn =
      LabelMap.find label label_owner

    let labels_of_ptn (name : label_ptn) : Label.t array =
      StringMap.find name labels_by_function

    let prog = prog
  end : Abs.PARAM)
