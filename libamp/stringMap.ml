include Map.Make (String)

let bindings m = bindings m |> Array.of_list
let of_array arr = arr |> Array.fold_left (fun acc (k, v) -> add k v acc) empty
