# Abstract Machines Playground

Next.js 16 + TypeScript + Tailwind + shadcn/ui playground for inspecting CEK traces of a small language S. Framework-free machine in `lib/s/`, React UI in `app/` and `components/`.

## Dev environment: Nix flake (fallback when needed)

Prefer raw `bun` commands first. If `bun` is not available in the current shell and Nix is installed, use the flake shell.

- First try direct commands: `bun install`, `bun run ...`.
- If `bun` is missing and `nix` exists, enter the shell with `nix develop` (or `direnv allow` once, then it auto-activates).
- One-shot fallback from an unactivated shell: `nix develop --command bun <args>`.
- `flake.nix` pins `pkgs.bun` against `nixos-unstable`; add reproducible tools there.

## Package manager: bun (not npm/pnpm)

- Install: `bun install`
- Scripts: `bun run dev | build | start | lint | typecheck | format`
- Ad-hoc scripts: `bun run scripts/<file>.ts` (direct TS execution; no build).
- shadcn components: `bunx shadcn@latest add <component>` -> lands in `components/ui/`.

## Repo layout

- `lib/s/` - language S implementation, UI-free and independently testable.
  - `grammar.ts` - Lezer grammar built in-memory via `@lezer/generator` `buildParser` (no separate parser build step).
  - `parser.ts` - CST -> labeled AST + `ControlMap` (every `Cmd` has a unique `Label`).
  - `ast.ts`, `values.ts`, `prims.ts`, `eval-exp.ts` - data types + pure expression eval.
  - `cek.ts` - five transitions: `[LetExp]`, `[LetCall]`, `[Match]`, `[Assert]`, `[Return]`. `[Return]` recovers the bound var via `ctrl(l_call)` on the kont head.
  - `env-parser.ts` - hand-rolled parser for the "initial rho" literals used to feed T programs as S constructor values.
  - `examples.ts` - `INTERPRETER_S_T` and `INITIAL_ENV`.
- `components/trace/` - UI bits (`program-pane`, `source-view`, `s-editor`, `trace-timeline`, `state-view`, `env-view`, `kont-view`, `value-view`, `env-editor`).
- `app/page.tsx` - three-pane playground shell built with `react-resizable-panels` (program/env tabs, timeline, state view) with `useReducer` state and lazy initial compile.
- `scripts/smoke-cek.ts` - sanity suite; keep it passing (`bun run scripts/smoke-cek.ts`).

## Language S: grammar deviation to remember

`match ... with | ... end` requires an explicit `end` keyword. This resolves a Lezer shift/reduce conflict; keep it when editing the grammar, examples, or docs.

## UI invariants

- Outer shell in `app/page.tsx` is `h-svh overflow-hidden`; every inner pane must manage its own scroll (`min-h-0` + `overflow-auto/hidden`). Do not reintroduce page-level scroll.
- Source is shown through `ProgramPane`, which swaps between `SourceView` (locked, highlights) and `SEditor` (unlocked, editable). Both share the same line-numbered gutter so switching modes does not shift the text.
- `PageState.locked` is the single source of truth; `runSuccess` re-locks. Highlights are always computed against `runnable.source`, never `state.source`.

## Don'ts

- Don't edit generated files under `.next/`, `node_modules/`, or `.direnv/`.
- Don't add line numbers or highlights by mutating the textarea value; keep gutters as separate siblings.
