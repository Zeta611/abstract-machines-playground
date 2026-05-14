{
  description = "Development shell for abstract-machines-playground";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    melange.url = "github:melange-re/melange/6.0.1-54";
  };

  outputs =
    {
      self,
      flake-utils,
      nixpkgs,
      melange
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system}.appendOverlays [
          (final: prev: {
            ocamlPackages = prev.ocaml-ng.ocamlPackages_5_4.overrideScope (ofinal: oprev: {
              ocaml = oprev.ocaml.overrideAttrs (_: { doCheck = false; });
            });
          })
          melange.overlays.default
        ];
        inherit (pkgs) ocamlPackages;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            ocamlPackages.melange
            ocamlPackages.ocamlformat
            ocamlPackages.dune_3
            ocamlPackages.findlib
            ocamlPackages.menhir
            ocamlPackages.ocaml
          ];
        };
      }
    );
}
