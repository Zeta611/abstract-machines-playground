module MapMake (Ord : Map.OrderedType) = Map.Make (Ord)
module StringMap = MapMake (String)
module IntMap = MapMake (Int)
module StringSet = Set.Make (String)


[@@@warning "-20"]
let console_log (x : 'a) : unit = [%mel.raw "console.log"] x