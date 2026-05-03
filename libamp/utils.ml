module MapMake (Ord : Map.OrderedType) = struct
  include Map.Make (Ord)

  let of_array (arr : (key * 'a) array) : 'a t =
    Array.fold_left (fun m (k, v) -> add k v m) empty arr

  let bindings (m : 'a t) : (key * 'a) array = bindings m |> Array.of_list
end

module StringMap = MapMake (String)
module IntMap = MapMake (Int)
module StringSet = Set.Make (String)
