{
  description = "Development shell for abstract-machines-playground";
  inputs = {
    opam-nix.url = "github:tweag/opam-nix";
    flake-utils.url = "github:numtide/flake-utils";
    # nixpkgs.follows = "opam-nix/nixpkgs";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs =
    {
      self,
      flake-utils,
      opam-nix,
      nixpkgs,
    }@inputs:
    let
      package = "abstract_machines_playground";
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        on = opam-nix.lib.${system};
        devPackagesQuery = {
          ocaml-lsp-server = "1.23.1";
          ocamlformat = "0.27.0";
          utop = "2.16.0";
          alcotest = "*";
          odoc = "*";
        };
        query = devPackagesQuery // {
          ocaml-base-compiler = "5.3.0";
        };
        scope = on.buildDuneProject {
          # resolveArgs.with-test = true;
          # resolveArgs.env.enable-ocaml-beta-repository = true;
        } package ./. query;
        overlay = final: prev: {
          ${package} = prev.${package}.overrideAttrs (_: {
            # Prevent the ocaml dependencies from leaking into dependent environments
            doNixSupport = false;
          });
        };
        scope' = scope.overrideScope overlay;
        main = scope'.${package};
        devPackages = builtins.attrValues (pkgs.lib.getAttrs (builtins.attrNames devPackagesQuery) scope');
      in
      {
        legacyPackages = scope';

        packages.default = main;

        devShells.default = pkgs.mkShell {
          inputsFrom = [ main ];
          buildInputs =
            with pkgs;
            devPackages
            ++ [
              bun
            ];
        };
      }
    );
}
