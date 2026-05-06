(lang dune 3.20)

(generate_opam_files true)

(using melange 1.0)

(using menhir 3.0)

(name abstract_machines_playground)

(package
 (name abstract_machines_playground)
 (allow_empty)
 (depends
  ocaml
  dune
  menhir
  melange))
