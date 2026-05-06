type atom = Int of int | Ctor of string * value list
and value = atom list
and env = (string * value) list
