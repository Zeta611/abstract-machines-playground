# Abstract Machines Playground

Next.js 16 + TypeScript + Tailwind + shadcn/ui playground for inspecting CEK traces of a small language S. The source implementation lives in `libamp/`, the generated browser/runtime façade is exposed under `lib/s/`, and the React UI lives in `app/` and `components/`.

## Dev environment: Nix flake (fallback when needed)

Prefer raw `bun` commands first. If `bun` is not available in the current shell and Nix is installed, use the flake shell.

- First try direct commands: `bun install`, `bun run ...`.
- If `bun` is missing and `nix` exists, enter the shell with `nix develop` (or `direnv allow` once, then it auto-activates).
- One-shot fallback from an unactivated shell: `nix develop --command bun <args>`.
- `flake.nix` pins `pkgs.bun` against `nixos-unstable`; add reproducible tools there.

## OCaml / Melange build

- When changing files under `libamp/`, regenerate the emitted JS with `opam exec -- dune build`.
- The app-visible runtime modules under `lib/s/` are a symlink to Melange output under `_build/default/output/libamp/`; do not assume editing `.ml` files alone updates what the app imports.

## OCaml / TypeScript interop rules

- Visitor helpers exist for TypeScript to case-analyze opaque OCaml values. OCaml code should use direct pattern matching instead of calling visitor functions.
- Simple enum-like OCaml variants do not need visitor APIs in TypeScript. Prefer lightweight representations for those; reserve visitor-based handling for payload-carrying variants that should stay opaque.

## Package manager: bun (not npm/pnpm)

- Install: `bun install`
- Scripts: `bun run dev | build | start | lint | typecheck | format`
- Ad-hoc scripts: `bun run scripts/<file>.ts` (direct TS execution; no build).
- shadcn components: `bunx shadcn@latest add <component>` -> lands in `components/ui/`.

## Repo layout

- `libamp/` - source implementation of language S and related parsers, UI-free and independently testable.
  - `grammar.mly`, `lexer.mll`, `parser.ml`, `parseUtils.ml` - Menhir/ocamllex parser pipeline for S programs.
  - `ast.ml`, `values.ml`, `prims.ml`, `cek.ml` - core data types, primitive semantics, and CEK machine.
  - `envParser.ml` - parser for the "initial rho" literals used to feed T programs as S constructor values.
  - `traceQuery*.ml` - trace query parser/matcher used by the timeline filter UI.
- `lib/s/` - generated Melange runtime symlink that the TypeScript app imports from.
- `lib/examples.ts` - TypeScript-hosted sample programs and preset environment text (`INTERPRETER_S_T`, `INITIAL_ENV`, presets).
- `components/trace/` - UI bits (`program-pane`, `source-view`, `source-editor`, `trace-timeline`, `state-view`, `env-view`, `kont-view`, `value-view`, `env-editor`).
- `app/page.tsx` - three-pane playground shell built with `react-resizable-panels` (program/env tabs, timeline, state view) with `useReducer` state and lazy initial compile.
- `scripts/smoke-cek.ts` - sanity suite; keep it passing (`bun run scripts/smoke-cek.ts`).

## Language S: grammar deviation to remember

`match ... with | ... end` requires an explicit `end` keyword. Keep that form when editing the grammar, examples, or docs.

## UI invariants

- Outer shell in `app/page.tsx` is `h-svh overflow-hidden`; every inner pane must manage its own scroll (`min-h-0` + `overflow-auto/hidden`). Do not reintroduce page-level scroll.
- Source is shown through `ProgramPane`, which swaps between `SourceView` (locked, highlights) and `SourceEditor` (unlocked, editable). Both share the same line-numbered gutter so switching modes does not shift the text.
- `PageState.locked` is the single source of truth; `runSuccess` re-locks. Highlights are always computed against `runnable.source`, never `state.source`.

## Don'ts

- Don't edit generated files under `.next/`, `node_modules/`, `_build/`, or `.direnv/`.
- Don't add line numbers or highlights by mutating the textarea value; keep gutters as separate siblings.
