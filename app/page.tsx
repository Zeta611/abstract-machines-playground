"use client"

import { useEffect, useMemo, useReducer, useState } from "react"
import { EnvEditor } from "@/components/trace/env-editor"
import { ProgramPane } from "@/components/trace/program-pane"
import { StateView } from "@/components/trace/state-view"
import { TraceTimeline } from "@/components/trace/trace-timeline"
import { ValueView } from "@/components/trace/value-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { run } from "@/lib/s/cek"
import type { Trace } from "@/lib/s/cek"
import { parseEnv } from "@/lib/s/env-parser"
import { INITIAL_ENV, INTERPRETER_S_T } from "@/lib/s/examples"
import { parseS, SParseError } from "@/lib/s/parser"
import type { Loc, Prog } from "@/lib/s/ast"

interface Runnable {
  source: string
  prog: Prog
  trace: Trace
}

interface PageState {
  source: string
  envText: string
  stepLimit: number
  runnable: Runnable | null
  cursor: number
  error: string | null
  locked: boolean
}

type Action =
  | { t: "setSource"; v: string }
  | { t: "setEnv"; v: string }
  | { t: "setStepLimit"; v: number }
  | { t: "setCursor"; v: number }
  | { t: "setLocked"; v: boolean }
  | { t: "runSuccess"; r: Runnable }
  | { t: "runFailure"; err: string }

function reducer(s: PageState, a: Action): PageState {
  switch (a.t) {
    case "setSource":
      return { ...s, source: a.v }
    case "setEnv":
      return { ...s, envText: a.v }
    case "setStepLimit":
      return { ...s, stepLimit: a.v }
    case "setCursor": {
      if (!s.runnable) return s
      const max = s.runnable.trace.states.length - 1
      return { ...s, cursor: Math.max(0, Math.min(max, a.v)) }
    }
    case "setLocked":
      return { ...s, locked: a.v }
    case "runSuccess":
      return { ...s, runnable: a.r, cursor: 0, error: null, locked: true }
    case "runFailure":
      return { ...s, error: a.err }
  }
}

function tryCompile(
  source: string,
  envText: string,
  stepLimit: number
): { r: Runnable | null; err: string | null } {
  try {
    const { prog } = parseS(source)
    const env = parseEnv(envText)
    const trace = run(prog, env, { maxSteps: stepLimit })
    return { r: { source, prog, trace }, err: null }
  } catch (e) {
    if (e instanceof SParseError) {
      return { r: null, err: `parse error: ${e.message} (${e.from}-${e.to})` }
    }
    if (e instanceof Error) return { r: null, err: e.message }
    return { r: null, err: String(e) }
  }
}

function makeInitial(): PageState {
  const source = INTERPRETER_S_T
  const envText = INITIAL_ENV
  const stepLimit = 5000
  const { r, err } = tryCompile(source, envText, stepLimit)
  return {
    source,
    envText,
    stepLimit,
    runnable: r,
    cursor: 0,
    error: err,
    locked: true,
  }
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitial)
  const [playing, setPlaying] = useState(false)

  const doRun = () => {
    setPlaying(false)
    const { r, err } = tryCompile(state.source, state.envText, state.stepLimit)
    if (r) dispatch({ t: "runSuccess", r })
    else if (err) dispatch({ t: "runFailure", err })
  }

  // Playback ticker: schedule (not perform) the next cursor advance while
  // `playing` is true. Both the advance and the auto-stop when the cursor
  // reaches the end are done inside the timeout callback, keeping the
  // effect body side-effect-free (see react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!playing || !state.runnable) return
    const last = state.runnable.trace.states.length - 1
    if (state.cursor >= last) return
    const id = setTimeout(() => {
      const next = state.cursor + 1
      dispatch({ t: "setCursor", v: next })
      if (next >= last) setPlaying(false)
    }, 150)
    return () => clearTimeout(id)
  }, [playing, state.cursor, state.runnable])

  // Keyboard navigation over the trace.
  useEffect(() => {
    if (!state.runnable) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "ArrowRight" || e.key === "l") {
        dispatch({ t: "setCursor", v: state.cursor + 1 })
        e.preventDefault()
      } else if (e.key === "ArrowLeft" || e.key === "h") {
        dispatch({ t: "setCursor", v: state.cursor - 1 })
        e.preventDefault()
      } else if (e.key === " ") {
        setPlaying((p) => !p)
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state.cursor, state.runnable])

  const trace = state.runnable?.trace
  const prog = state.runnable?.prog
  const current = trace?.states[state.cursor]
  const lastStep = state.cursor > 0 ? trace?.steps[state.cursor - 1] : undefined
  const nextStep =
    trace && state.cursor < trace.steps.length
      ? trace.steps[state.cursor]
      : undefined

  const currentCmd = current && prog ? prog.ctrl.get(current.label) : undefined

  const kontHighlights = useMemo(() => {
    if (!current || !prog) return []
    return current.kont
      .map((f) => prog.ctrl.get(f.label))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => c.loc)
  }, [current, prog])

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-muted/20">
      <Header
        stepLimit={state.stepLimit}
        onStepLimitChange={(v) => dispatch({ t: "setStepLimit", v })}
        onRun={doRun}
        error={state.error}
      />
      <main className="min-h-0 flex-1 overflow-hidden p-3">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize="42%" minSize="24%">
            <section className="flex h-full min-h-0 flex-col overflow-hidden">
              <LeftPane
                source={state.source}
                setSource={(v) => dispatch({ t: "setSource", v })}
                envText={state.envText}
                setEnv={(v) => dispatch({ t: "setEnv", v })}
                runnableSource={state.runnable?.source ?? null}
                locked={state.locked}
                onToggleLock={() =>
                  dispatch({ t: "setLocked", v: !state.locked })
                }
                highlight={currentCmd?.loc}
                kontHighlights={kontHighlights}
                finalValue={
                  trace && trace.end.kind === "final" ? trace.end.value : null
                }
                terminationKind={trace?.end.kind}
              />
            </section>
          </ResizablePanel>
          <ResizableHandle className="mx-2"/>
          <ResizablePanel defaultSize="24%" minSize="16%">
            <section className="flex h-full min-h-0 flex-col overflow-hidden rounded border bg-card px-3 py-2">
              {trace ? (
                <TraceTimeline
                  trace={trace}
                  cursor={state.cursor}
                  setCursor={(v) => dispatch({ t: "setCursor", v })}
                  playing={playing}
                  setPlaying={setPlaying}
                />
              ) : (
                <div className="text-xs text-muted-foreground">
                  Run the program to see its trace.
                </div>
              )}
            </section>
          </ResizablePanel>
          <ResizableHandle className="mx-2"/>
          <ResizablePanel defaultSize="34%" minSize="20%">
            <section className="h-full min-h-0 overflow-hidden">
              {trace && prog && current ? (
                <StateView
                  state={current}
                  ctrl={prog.ctrl}
                  lastStep={lastStep}
                  nextStep={nextStep}
                />
              ) : (
                <div className="p-3 text-xs text-muted-foreground">
                  Parse/run a program to inspect its CEK state.
                </div>
              )}
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}

function Header({
  stepLimit,
  onStepLimitChange,
  onRun,
  error,
}: {
  stepLimit: number
  onStepLimitChange: (v: number) => void
  onRun: () => void
  error: string | null
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background/70 px-3 py-2 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">Abstract Machines Playground</span>
        <Badge variant="outline" className="text-[10px]">
          CEK
        </Badge>
      </div>
      <div className="ml-2 flex items-center gap-2 text-xs">
        <label htmlFor="step-limit" className="text-muted-foreground">
          step limit
        </label>
        <Input
          id="step-limit"
          type="number"
          min={1}
          value={stepLimit}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) onStepLimitChange(n)
          }}
          className="h-7 w-24 text-xs"
        />
      </div>
      <Button size="sm" onClick={onRun}>
        Run
      </Button>
      {error && (
        <div className="min-w-0 flex-1 truncate text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="ml-auto text-[11px] text-muted-foreground">
        ←/→ step · space = play/pause
      </div>
    </header>
  )
}

function LeftPane({
  source,
  setSource,
  envText,
  setEnv,
  runnableSource,
  locked,
  onToggleLock,
  highlight,
  kontHighlights,
  finalValue,
  terminationKind,
}: {
  source: string
  setSource: (v: string) => void
  envText: string
  setEnv: (v: string) => void
  runnableSource: string | null
  locked: boolean
  onToggleLock: () => void
  highlight: Loc | undefined
  kontHighlights: Loc[]
  finalValue: import("@/lib/s/values").Val | null
  terminationKind: Trace["end"]["kind"] | undefined
}) {
  const dirty = runnableSource !== null && source !== runnableSource
  const showLocked = locked && runnableSource !== null
  return (
    <Tabs defaultValue="source" className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="source">program</TabsTrigger>
          <TabsTrigger value="env">initial ρ</TabsTrigger>
        </TabsList>
        <Button
          size="sm"
          variant={showLocked ? "default" : "outline"}
          onClick={onToggleLock}
          title={showLocked ? "unlock to edit" : "lock to see highlights"}
          className="h-8"
        >
          <LockIcon open={!showLocked} />
          <span className="ml-1 text-xs">
            {showLocked ? "locked" : "unlocked"}
          </span>
        </Button>
        {dirty && (
          <Badge
            variant="outline"
            className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-300"
            title="The text in the editor differs from the source that produced the current trace. Re-run to re-sync highlights."
          >
            source modified
          </Badge>
        )}
      </div>
      <TabsContent
        value="source"
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <ProgramPane
          sourceText={source}
          runnableSource={runnableSource}
          onChange={setSource}
          locked={locked}
          highlight={highlight}
          kontHighlights={kontHighlights}
        />
      </TabsContent>
      <TabsContent
        value="env"
        className="min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
      >
        <EnvEditor value={envText} onChange={setEnv} />
      </TabsContent>
      {terminationKind === "final" && finalValue && (
        <div className="flex items-center gap-2 rounded border bg-card px-2 py-1 text-xs">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">result</Badge>
          <ValueView value={finalValue} />
        </div>
      )}
    </Tabs>
  )
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      {open ? (
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      ) : (
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      )}
    </svg>
  )
}
