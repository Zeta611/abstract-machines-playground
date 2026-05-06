open Ast
open Utils

module type Domain = sig
  type t

  val bot : t
  val join : t -> t -> t
end

module Set (M : Map.OrderedType) = struct
  include Set.Make (M)

  let bot = empty
  let join = union
end

(* partial map *)
module PMap (K : Map.OrderedType) (V : Domain) = struct
  include Map.Make (K)
  module K = K
  module V = V

  type nonrec t = V.t t

  let lookup (k : K.t) (m : t) : V.t =
    find_opt k m |> Option.value ~default:V.bot

  let bot : t = empty

  let join (m1 : t) (m2 : t) : t =
    union (fun _ v1 v2 -> Some (V.join v1 v2)) m1 m2

  let weak_update (k : K.t) (v : V.t) (m : t) : t =
    update k (function None -> Some v | Some old -> Some (V.join old v)) m
end

module Pair (D1 : Domain) (D2 : Domain) = struct
  module D1 = D1
  module D2 = D2

  type t = D1.t * D2.t

  let bot = (D1.bot, D2.bot)
  let join (a1, b1) (a2, b2) = (D1.join a1 a2, D2.join b1 b2)
end

module Time = struct
  module Ptn = struct
    type t = unit

    let compare = compare
  end
end

module VAddr = struct
  module Ptn = struct
    type t = Dynamic of Time.Ptn.t * Label.t * int | Static of int

    let compare = compare
  end

  module Abs = Set (Ptn)
end

module KAddr = struct
  module Ptn = struct
    type t = Time.Ptn.t * Label.t

    let compare = compare
  end

  module Abs = Set (Ptn)
end

module AbsEnv = PMap (String) (VAddr.Abs)

module WithTop (D : Domain) = struct
  module D = D

  type t = Top | V of D.t

  let bot : t = V D.bot
  let inject v : t = V v
  let top : t = Top

  let join x y : t =
    match (x, y) with Top, _ | _, Top -> Top | V v1, V v2 -> V (D.join v1 v2)
end

module IntSet = Set (Int)
module AbsInt = WithTop (IntSet)

module WithBot (D : Domain) = struct
  module D = D

  type t = Bot | V of D.t

  let bot : t = Bot
  let inject v : t = V v

  let join x y : t =
    match (x, y) with
    | Bot, Bot -> Bot
    | V v, Bot | Bot, V v -> V v
    | V v1, V v2 -> V (D.join v1 v2)
end

module AbsAddrList = PMap (Int) (VAddr.Abs)
module AbsArgs = WithBot (AbsAddrList)

module AbsAdt = struct
  include PMap (String) (AbsArgs)

  let of_tag_args (tag : string) (args : VAddr.Abs.t list) : t =
    let argMap =
      args
      |> List.mapi (fun i arg -> (i, arg))
      |> AbsAddrList.of_list |> AbsArgs.inject
    in
    add tag argMap empty
end

module AbsVal = struct
  include Pair (AbsInt) (AbsAdt)

  let int_of v = fst v
  let adt_of v = snd v
  let of_int n = (AbsInt.inject (IntSet.singleton n), AbsAdt.bot)
  let of_adt m = (AbsInt.bot, m)
  let of_abs_int i = (i, AbsAdt.bot)
  let true_ : t = (AbsInt.bot, AbsAdt.of_tag_args "True" [])
  let false_ = (AbsInt.bot, AbsAdt.of_tag_args "False" [])

  let lift_int_binop f ((x, _) : t) ((y, _) : t) : t =
    match (x, y) with
    | V xSet, V ySet ->
        bot
        |> IntSet.fold (fun n -> IntSet.fold (fun m -> join (f n m)) ySet) xSet
    | _ -> of_abs_int AbsInt.top

  let lift_int_unop f ((x, _) : t) : t =
    match x with
    | V xSet -> bot |> IntSet.fold (fun n -> join (f n)) xSet
    | _ -> of_abs_int AbsInt.top

  let lift_tag_unop f ((_, m) : t) =
    bot |> AbsAdt.fold (fun tag args acc -> join acc (f (tag, args))) m
end

module AbsVStore = PMap (VAddr.Ptn) (AbsVal)
module AbsFrame = Pair (AbsEnv) (KAddr.Abs)
module AbsKStore = PMap (KAddr.Ptn) (AbsFrame)

type abs_state =
  Time.Ptn.t * Label.t * AbsEnv.t * AbsVStore.t * AbsKStore.t * KAddr.Abs.t

let joined_lookup (a : VAddr.Abs.t) (m : AbsVStore.t) : AbsVal.t =
  VAddr.Abs.fold
    (fun addr -> AbsVal.join (AbsVStore.lookup addr m))
    a AbsVal.bot

open Result.Syntax

let seq (rs : ('a, string) result list) : ('a list, string) result =
  let* l =
    List.fold_left
      (fun acc r ->
        let* xs = acc in
        let* x = r in
        Ok (x :: xs))
      (Ok []) rs
  in
  Ok (List.rev l)

let evalPrim : string * AbsVal.t list -> (AbsVal.t, string) result = function
  | "sub", [ arg1; arg2 ] ->
      AbsVal.lift_int_binop (fun n m -> AbsVal.of_int (n - m)) arg1 arg2
      |> Result.ok
  | "add", [ arg1; arg2 ] ->
      AbsVal.lift_int_binop (fun n m -> AbsVal.of_int (n + m)) arg1 arg2
      |> Result.ok
  | "mul", [ arg1; arg2 ] ->
      AbsVal.lift_int_binop (fun n m -> AbsVal.of_int (n * m)) arg1 arg2
      |> Result.ok
  | "iszero", [ arg ] ->
      AbsVal.lift_int_unop
        (fun n -> if n = 0 then AbsVal.true_ else AbsVal.false_)
        arg
      |> Result.ok
  | "eq", [ arg1; arg2 ] ->
      AbsVal.lift_int_binop
        (fun n m -> if n = m then AbsVal.true_ else AbsVal.false_)
        arg1 arg2
      |> Result.ok
  | "lt", [ arg1; arg2 ] ->
      AbsVal.lift_int_binop
        (fun n m -> if n < m then AbsVal.true_ else AbsVal.false_)
        arg1 arg2
      |> Result.ok
  | "not", [ arg ] ->
      AbsVal.lift_tag_unop
        (function
          | "True", _ -> AbsVal.false_
          | "False", _ -> AbsVal.true_
          | _ -> AbsVal.bot)
        arg
      |> Result.ok
  | op, args ->
      Error
        ("unknown primitive '" ^ op ^ "' with "
        ^ string_of_int (List.length args)
        ^ " argument(s)")

let rec eval_exp (e : Exp.t) (rho : AbsEnv.t) (sv : AbsVStore.t)
    (sk : AbsKStore.t) : (AbsVal.t, string) result =
  match e.desc with
  | Num n -> AbsVal.of_int n |> Result.ok
  | Var_ x -> joined_lookup (AbsEnv.lookup x rho) sv |> Result.ok
  | Prim { op; args } ->
      let* argVals =
        args |> List.map (fun arg -> eval_exp arg rho sv sk) |> seq
      in
      evalPrim (op, argVals)

let abs_allocv (sigma : abs_state) (i : int) : VAddr.Ptn.t =
  let t, l, _, _, _, _ = sigma in
  Dynamic (t, l, i)

let abs_allock (sigma : abs_state) : KAddr.Ptn.t =
  let t, l, _, _, _, _ = sigma in
  (t, l)

let abs_tick (_ : abs_state) (_ : [ `A of KAddr.Ptn.t | `L of Label.t ]) :
    Time.Ptn.t =
  ()

let let_call_of = function
  | Cmd.{ desc = Cmd.LetCall { x; body; _ }; _ } -> Some (x, body)
  | _ -> None

let ferror reason = Printf.ksprintf (fun s -> Error s) reason

let abs_transition (prog : program)
    ((_, l, rho, sv, sk, ak) as sigma : abs_state) :
    (abs_state list, string) result =
  let cmd = LabelMap.find l prog.ctrl in
  match cmd.desc with
  | Return e ->
      let+ v = eval_exp e rho sv sk in
      KAddr.Abs.to_list ak
      |> List.map (fun ((_, l') as ptn_ak) ->
          let rho', ak' = AbsKStore.lookup ptn_ak sk in
          let x, Cmd.{ label = lr; _ } =
            LabelMap.find l' prog.ctrl |> let_call_of |> Option.get
          in
          let a0 = abs_allocv sigma 0 in
          ( abs_tick sigma (`A ptn_ak),
            lr,
            AbsEnv.weak_update x (VAddr.Abs.singleton a0) rho',
            AbsVStore.weak_update a0 v sv,
            sk,
            ak' ))
  | Let_ { x; exp; body; _ } ->
      let+ v = eval_exp exp rho sv sk in
      let a0 = abs_allocv sigma 0 in
      [
        ( abs_tick sigma (`L body.label),
          body.label,
          AbsEnv.weak_update x (VAddr.Abs.singleton a0) rho,
          AbsVStore.weak_update a0 v sv,
          sk,
          ak );
      ]
  | LetTag { x; tag; args; body; _ } ->
      let+ argVals =
        args |> List.map (fun arg -> eval_exp arg rho sv sk) |> seq
      in
      let a0 = abs_allocv sigma 0 in
      let valAddrs =
        List.mapi (fun i arg -> (arg, abs_allocv sigma i)) argVals
      in
      let sv' =
        List.fold_left
          (fun sv (argVal, addr) -> AbsVStore.weak_update addr argVal sv)
          sv valAddrs
      in
      let v =
        valAddrs
        |> List.map (fun (_, addr) -> VAddr.Abs.singleton addr)
        |> AbsAdt.of_tag_args tag |> AbsVal.of_adt
      in
      [
        ( abs_tick sigma (`L body.label),
          body.label,
          AbsEnv.weak_update x (VAddr.Abs.singleton a0) rho,
          AbsVStore.weak_update a0 v sv',
          sk,
          ak );
      ]
  | LetCall { callee; args; _ } ->
      let* argVals =
        args |> List.map (fun arg -> eval_exp arg rho sv sk) |> seq
      in
      let* def =
        StringMap.find_opt callee prog.defs
        |> Option.to_result ~none:("undefined function " ^ callee)
      in
      let+ varAddrArgs =
        try
          List.combine def.params argVals
          |> List.mapi (fun i (param, arg) ->
              let addr = abs_allocv sigma i in
              (param, addr, arg))
          |> Result.ok
        with Invalid_argument _ ->
          ferror "arity mismatch when calling %s: expected %d args, got %d"
            callee (List.length def.params) (List.length argVals)
      in
      let sv' =
        List.fold_left
          (fun sv (_, addr, argVal) -> AbsVStore.weak_update addr argVal sv)
          sv varAddrArgs
      in
      let rho' =
        List.fold_left
          (fun rho (param, addr, _) ->
            AbsEnv.weak_update param (VAddr.Abs.singleton addr) rho)
          AbsEnv.bot varAddrArgs
      in
      let ptn_ak' = abs_allock sigma in
      let sk' = AbsKStore.weak_update ptn_ak' (rho, ak) sk in
      [
        ( abs_tick sigma (`L def.body.label),
          def.body.label,
          rho',
          sv',
          sk',
          KAddr.Abs.singleton ptn_ak' );
      ]
  | Match_ { scrutinee; branches; _ } ->
      let+ v = eval_exp scrutinee rho sv sk in
      branches
      |> List.filter_map (fun branch ->
          let branchTag = branch.Cmd.tag in
          let args = AbsVal.adt_of v |> AbsAdt.lookup branchTag in
          match args with
          | AbsArgs.Bot -> None
          | AbsArgs.V args ->
              let varAddrArgs =
                branch.vars
                |> List.mapi (fun i var ->
                    let addr = abs_allocv sigma i in
                    let arg = joined_lookup (AbsAddrList.lookup i args) sv in
                    (var, addr, arg))
              in
              let sv' =
                List.fold_left
                  (fun sv (_, addr, arg) -> AbsVStore.weak_update addr arg sv)
                  sv varAddrArgs
              in
              let rho' =
                List.fold_left
                  (fun rho (var, addr, _) ->
                    AbsEnv.weak_update var (VAddr.Abs.singleton addr) rho)
                  rho varAddrArgs
              in
              Some
                ( abs_tick sigma (`L branch.body.label),
                  branch.body.label,
                  rho',
                  sv',
                  sk,
                  ak ))

module TimeLabel = struct
  type t = Time.Ptn.t * Label.t

  let compare = compare
end

module Frames = PMap (TimeLabel) (AbsFrame)
module AbsCfg = Pair (Frames) (Pair (AbsVStore) (AbsKStore))

let abs_transfer (prog : program) (cfg : AbsCfg.t) : (AbsCfg.t, string) result =
  let map, (sv, sk) = cfg in
  let+ newCfgs =
    Frames.to_list map
    |> List.map (fun ((t, l), (rho, ak)) ->
        let sigma = (t, l, rho, sv, sk, ak) in
        abs_transition prog sigma)
    |> seq
  in
  List.flatten newCfgs
  |> List.fold_left
       (fun cfg ((t, l, rho, sv, sk, ak) : abs_state) ->
         AbsCfg.join cfg
           (Frames.weak_update (t, l) (rho, ak) Frames.bot, (sv, sk)))
       cfg

type abs_run = { cfg : AbsCfg.t; steps : int; stabilized : bool }
type abs_env_row = { name : string; addrs : string array }
type abs_vstore_row = { addr : string; value : string }

type abs_kstore_row = {
  addr : string;
  env : abs_env_row array;
  kont : string array;
}

type abs_frame_row = {
  label : int;
  env : abs_env_row array;
  kont : string array;
}

type abs_cfg_view = {
  frames : abs_frame_row array;
  vstore : abs_vstore_row array;
  kstore : abs_kstore_row array;
}

let show_label (Label.L n) = n

let show_vaddr = function
  | VAddr.Ptn.Static n -> Printf.sprintf "s%d" n
  | Dynamic (_, Label.L l, i) -> Printf.sprintf "v(%d,%d)" l i

let show_kaddr (_, Label.L l) = Printf.sprintf "k(%d)" l

let show_vaddr_abs addrs =
  VAddr.Abs.to_list addrs |> List.map show_vaddr |> String.concat " | "

let show_kaddr_abs addrs =
  KAddr.Abs.to_list addrs |> List.map show_kaddr |> Array.of_list

let show_abs_int : AbsInt.t -> string = function
  | V ints ->
      let body =
        IntSet.to_list ints |> List.map string_of_int |> String.concat "|"
      in
      Printf.sprintf "Int{%s}" body
  | _ -> "Int(*)"

let show_abs_val ((ints, adts) : AbsVal.t) =
  let parts = [] in
  let parts =
    match ints with
    | V ints when IntSet.is_empty ints -> parts
    | _ -> show_abs_int ints :: parts
  in
  let parts =
    AbsAdt.to_list adts
    |> List.filter_map (fun (tag, args) ->
        match args with
        | AbsArgs.Bot -> None
        | AbsArgs.V args ->
            let argDoc =
              AbsAddrList.to_list args
              |> List.map (fun (_, addrs) -> show_vaddr_abs addrs)
              |> String.concat ", "
            in
            if argDoc = "" then Some tag
            else Some (Printf.sprintf "%s(%s)" tag argDoc))
    |> List.rev_append parts
  in
  if List.length parts = 0 then "⊥"
  else
    let ordered = List.rev parts in
    if List.length ordered = 1 then List.hd ordered
    else "{" ^ String.concat " | " ordered ^ "}"

let view_env (rho : AbsEnv.t) : abs_env_row array =
  AbsEnv.to_list rho
  |> List.map (fun (name, addrs) ->
      { name; addrs = [| show_vaddr_abs addrs |] })
  |> Array.of_list

let view_frame (((_, l), (rho, ak)) : TimeLabel.t * AbsFrame.t) : abs_frame_row
    =
  { label = show_label l; env = view_env rho; kont = show_kaddr_abs ak }

let view_kstore_row ((addr, (rho, ak)) : KAddr.Ptn.t * AbsFrame.t) :
    abs_kstore_row =
  { addr = show_kaddr addr; env = view_env rho; kont = show_kaddr_abs ak }

let view_vstore_row ((addr, value) : VAddr.Ptn.t * AbsVal.t) : abs_vstore_row =
  { addr = show_vaddr addr; value = show_abs_val value }

let view_cfg ((frames, (sv, sk)) : AbsCfg.t) : abs_cfg_view =
  {
    frames = Frames.to_list frames |> List.map view_frame |> Array.of_list;
    vstore = AbsVStore.to_list sv |> List.map view_vstore_row |> Array.of_list;
    kstore = AbsKStore.to_list sk |> List.map view_kstore_row |> Array.of_list;
  }

let abs_inject (prog : program) ((rho, sv) : AbsEnv.t * AbsVStore.t) : AbsCfg.t
    =
  let main = StringMap.find prog.mainName prog.defs in
  ( Frames.weak_update ((), main.body.label) (rho, KAddr.Abs.bot) Frames.bot,
    (sv, AbsKStore.bot) )

let rec iterate_abs_transfer (prog : program) (fuel : int) (steps : int)
    (cfg : AbsCfg.t) : (abs_run, string) result =
  if fuel <= 0 then Ok { cfg; steps; stabilized = false }
  else
    let* next = abs_transfer prog cfg in
    if next = cfg then Ok { cfg = next; steps = steps + 1; stabilized = true }
    else iterate_abs_transfer prog (fuel - 1) (steps + 1) next

let run_abs (prog : program) ((rho, sv) : AbsEnv.t * AbsVStore.t) (fuel : int) :
    (abs_run, string) result =
  abs_inject prog (rho, sv) |> iterate_abs_transfer prog fuel 0
