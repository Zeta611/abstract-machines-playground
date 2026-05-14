<p align="center">
  <img
    src="public/title.png"
    alt="Abstract Machines Playground"
    width="100%"
  />
</p>

An interactive environment for studying and testing [abstract machines](https://en.wikipedia.org/wiki/Abstract_machine) such as CEK machines by inspecting program execution traces.

The first machine shipped here is a CEK machine for a small language **S** (features ANF with constructor values, global mutually recursive functions, first-order pattern matching, and label-based control). Programs in another language **T** can be fed to an S-level definitional interpreter `I_S^T` by supplying T-ASTs as S constructor-value literals in the initial environment; the CEK trace is then a faithful small-step witness of running `I_S^T` on that T program.

<p align="center">
  <img
    src="public/screenshot.png"
    alt="screenshot"
    width="100%"
  />
</p>

## Quick start

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. A working example is preloaded.

## Language S cheat sheet

```
# Function definitions (sequence). The entry point is `main`,
# or the last definition if no `main` is declared.
name(param, ...) =
  cmd

# Commands
let x = expr in cmd                # [LetExp]
let x = fn(y, ...) in cmd          # [LetCall]  (fn is a defined function;
                                   #            arguments must be variables)
let x = Tag(y, ...) in cmd         # [LetTag]   (constructor literal;
                                   #            arguments must be variables)
match expr with                    # [Match] — dispatch on constructor tag + arity
| Tag(x, y, ...) => cmd
| ...
end                                # `end` is required
x                                  # [Return] — tail return of a variable

# Expressions
42         -3           # integers
x                       # variable
prim(e, ...)            # primitive application (lowercase head)
```

Constructors are `UpperCase` identifiers; booleans are spelled `True()` and `False()`. Primitives available out of the box: `add`, `sub`, `mul`, `iszero`, `eq`, `lt`, `not`. Extend the registry in [`lib/s/prims.ml`](lib/s/prims.ml).

### Running T programs

T has no concrete syntax in this tool; T ASTs are S constructor values. Supply the T program in the "initial ρ" tab using the same literal syntax. The preloaded `I_S^T` expects each T AST node to carry a label as its first field — e.g. factorial reads:

```
p = Prog(Defs(Fun(0), Ifz(10, Var(11, 0), Int(12, 1), Mul(13, Var(14, 0), App(15, Fun(0), Sub(16, Var(17, 0), Int(18, 1))))), Nil()), App(20, Fun(0), Var(21, 0)))
arg = 5
```

Run the preloaded `I_S^T` against them, or pick another preset from the program tab.

## CEK implementation notes

The S implementation lives in [`lib/s/`](lib/s/) as OCaml sources compiled to JS via [Melange](https://melange.re/). Both the `.ml` sources and their promoted `.js` outputs are committed, so the TypeScript app imports the machine directly without an extra build step.

- [`lib/s/grammar.mly`](lib/s/grammar.mly) + [`lib/s/lexer.mll`](lib/s/lexer.mll) — Menhir parser and ocamllex tokenizer for S programs.
- [`lib/s/parser.ml`](lib/s/parser.ml) and [`lib/s/parseUtils.ml`](lib/s/parseUtils.ml) — entry point + AST builder. Each `Cmd` is assigned a unique `Label` and registered in the `ctrl` map on the way down.
- [`lib/s/cek.ml`](lib/s/cek.ml) — implements the five transitions: `[LetExp]`, `[LetCall]`, `[LetTag]`, `[Match]`, `[Return]`. `[Return]` recovers the bound variable by consulting `ctrl(ℓ_call)` on the continuation head.
- [`lib/s/envParser.ml`](lib/s/envParser.ml) — parser for "initial ρ" literals that feed T programs in as constructor values.
- [`lib/s/s_to_t.ml`](lib/s/s_to_t.ml) — extracts and verifies a T-level trace from a CEK run of `I_S^T`.
- [`lib/s/abs.ml`](lib/s/abs.ml) + [`lib/s/abs_preset.ml`](lib/s/abs_preset.ml) — abstract interpretation companion to the CEK machine.
- [`lib/s/traceQuery.ml`](lib/s/traceQuery.ml) — query language behind the timeline filter UI.

Run a quick self-test:

```bash
bun run scripts/smoke-cek.ts
```

Editing OCaml sources requires a Dune build to regenerate the JS outputs; see the development commands below.

## Development commands

| Command                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `bun run dev`            | Start the Next.js dev server with Turbopack                  |
| `bun run build`          | Create a production build                                    |
| `bun run start`          | Serve the production build locally                           |
| `bun run lint`           | Run ESLint                                                   |
| `bun run typecheck`      | Type-check without emitting output                           |
| `bun run format`         | Format all `.ts`/`.tsx` files with Prettier                  |
| `bun run ocaml:build`    | Build the Melange OCaml sources in `lib/s/` once             |
| `bun run ocaml:dev`      | Rebuild Melange OCaml sources on change (`dune build --watch`) |
| `bun run ocaml:format`   | Run `dune format` against the OCaml sources                  |
| `bun run full:dev`       | Run `ocaml:dev` and `dev` together (watching both)           |
| `bun run full:build`     | Build OCaml sources then the Next.js production bundle       |
| `bun run full:typecheck` | Build OCaml sources then run `typecheck`                     |
| `bun run full:format`    | Format OCaml sources then TypeScript                         |

The OCaml toolchain (Dune + Menhir + Melange) is provided by the Nix flake; see below.

## Adding shadcn/ui components

```bash
bunx shadcn@latest add <component>
```

Components are placed in `components/ui/`. Import them with the `@/` alias:

```tsx
import { Button } from "@/components/ui/button"
```

## Nix + direnv (optional)

A `flake.nix` is included that provides a reproducible shell with Bun. If you have [Nix](https://nixos.org/) and [direnv](https://direnv.net/) installed, the environment activates automatically when you enter the project directory:

```bash
direnv allow   # one-time setup
```

After that, `bun` is available in your shell without any manual activation.
