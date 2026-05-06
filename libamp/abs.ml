open Ast
open Utils

module type Domain = sig
  type t
  val bot : t
  val join : t -> t -> t
end

(* partial map *)
module PMap (K : Map.OrderedType) (V : Domain) =
struct
  module K = K
  module V = V
  include Map.Make (K)

  type nonrec t = V.t t

  let lookup k m = find_opt k m |> Option.value ~default:V.bot
  let bot = empty
end

module Time = struct
  module Ptn = struct
    type t = unit

    let compare = compare
  end
end

module VAddr = struct
  module Ptn = struct
    type t = Time.Ptn.t * Label.t * int

    let compare = compare
  end

  module Abs = Set.Make (Ptn)
end

module KAddr = struct
  module Ptn = struct
    type t = Time.Ptn.t * Label.t

    let compare = compare
  end

  module Abs = Set.Make (Ptn)
end

(*type abs_env = Addr.Abs.t StringMap.t*)
module AbsEnv = PMap (struct
  type t = string
  type v = VAddr.Abs.t

  let compare = String.compare
  let bot = VAddr.Abs.empty
end)

module IntSet = struct
  include Set.Make (Int)
end

type abs_int = IntSet.t

module AbsVal = struct
  type t = abs_int * VAddr.Abs.t list StringMap.t (* int * (tag -> addr list) *)

  let int_of v = fst v
  let of_int n = (IntSet.singleton n, StringMap.empty)
  let true_ = (IntSet.empty, StringMap.of_list [ ("True", []) ])
  let false_ = (IntSet.empty, StringMap.of_list [ ("False", []) ])
  let bot = (IntSet.empty, StringMap.empty)

  let join (x1, m1) (x2, m2) =
    ( IntSet.union x1 x2,
      StringMap.union
        (fun _ m1 m2 -> Some (List.map2 (fun a b -> VAddr.Abs.union a b) m1 m2))
        m1 m2 )

  let lift_int_binop f (x, _) (y, _) =
    bot |> IntSet.fold (fun n -> IntSet.fold (fun m -> join (f n m)) y) x

  let lift_int_unop f (x, _) = bot |> IntSet.fold (fun n -> join (f n)) x

  let lift_tag_unop f (_, m) =
    bot |> StringMap.fold (fun tag args acc -> join acc (f (tag, args))) m
end

type abs_kont = AbsEnv.t * Addr.Abs.t

module AbsVStore = PMap (struct
  type t = Addr.Ptn.t
  type v = AbsVal.t

  let compare = Addr.Ptn.compare
  let bot = AbsVal.bot
end)

module AbsKStore = PMap (struct
  type t = Addr.Ptn.t
  type v = abs_kont

  let compare = Addr.Ptn.compare
  let bot = (AbsEnv.bot, Addr.Abs.empty)
end)

type abs_state = Time.Ptn.t * Label.t * AbsEnv.t * AbsVStore.t * AbsKStore.t * Addr.Abs.t
type abs_cfg = (AbsEnv.t * abs_store) StringMap.t Time.PtnMap.t * AbsVStore.t * AbsKStore.t

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

let evalPrim = function
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
          | "True", [] -> AbsVal.false_
          | "False", [] -> AbsVal.true_
          | _ -> AbsVal.bot)
        arg
      |> Result.ok
  | op, args ->
      Error
        ("unknown primitive '" ^ op ^ "' with "
        ^ string_of_int (List.length args)
        ^ " argument(s)")

let rec eval_exp (e : Exp.t) (rho : AbsEnv.t) (sv : AbsVStore.t) (sk : AbsKStore.t) :
    (AbsVal.t, string) result =
  match e.desc with
  | Num n -> Ok (IntSet.singleton n, StringMap.empty)
  | Var_ x -> AbsEnv.lookup x rho |> Result.ok
  | Prim { op; args } ->
      let* argVals = args |> List.map (fun arg -> eval_exp arg rho s) |> seq in
      evalPrim (op, argVals)
