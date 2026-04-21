"use client"

import { useEffect, useMemo, useReducer, useState } from "react"
import { EnvEditor, EnvPreview } from "@/components/trace/env-editor"
import {
  LabelHoverProvider,
  useLabelHover,
} from "@/components/trace/label-hover"
import { ProgramPane } from "@/components/trace/program-pane"
import { StateView } from "@/components/trace/state-view"
import { TraceTimeline } from "@/components/trace/trace-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { run } from "@/lib/s/cek"
import type { Trace } from "@/lib/s/cek"
import { parseEnv } from "@/lib/s/env-parser"
import {
  DEFAULT_PRESET_ID,
  PROGRAM_PRESETS,
  type ProgramPreset,
} from "@/lib/s/examples"
import { parseS, SParseError } from "@/lib/s/parser"
import type { Loc, Prog } from "@/lib/s/ast"

interface Runnable {
  source: string
  envText: string
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
  | {
      t: "replaceAndRun"
      source: string
      envText: string
      r: Runnable | null
      err: string | null
    }

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
    case "replaceAndRun":
      return {
        ...s,
        source: a.source,
        envText: a.envText,
        runnable: a.r,
        cursor: 0,
        error: a.err,
        locked: a.r !== null,
      }
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
    return { r: { source, envText, prog, trace }, err: null }
  } catch (e) {
    if (e instanceof SParseError) {
      return { r: null, err: `parse error: ${e.message} (${e.from}-${e.to})` }
    }
    if (e instanceof Error) return { r: null, err: e.message }
    return { r: null, err: String(e) }
  }
}

function makeInitial(): PageState {
  const preset =
    PROGRAM_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ??
    PROGRAM_PRESETS[0]
  const source = preset.source
  const envText = preset.envText
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

  const sourceDirty = !state.runnable || state.source !== state.runnable.source
  const envDirty = !state.runnable || state.envText !== state.runnable.envText
  const dirty = sourceDirty || envDirty
  const showLocked = state.locked && state.runnable !== null
  const activePresetId =
    PROGRAM_PRESETS.find(
      (p) => p.source === state.source && p.envText === state.envText
    )?.id ?? "custom"

  const handleLockToggle = () => {
    if (showLocked) {
      dispatch({ t: "setLocked", v: false })
      return
    }
    setPlaying(false)
    if (dirty) {
      const { r, err } = tryCompile(
        state.source,
        state.envText,
        state.stepLimit
      )
      if (r) dispatch({ t: "runSuccess", r })
      else if (err) dispatch({ t: "runFailure", err })
    } else {
      dispatch({ t: "setLocked", v: true })
    }
  }

  const handlePresetChange = (id: string) => {
    const preset = PROGRAM_PRESETS.find((p) => p.id === id)
    if (!preset) return

    setPlaying(false)

    const { r, err } = tryCompile(
      preset.source,
      preset.envText,
      state.stepLimit
    )

    dispatch({
      t: "replaceAndRun",
      source: preset.source,
      envText: preset.envText,
      r,
      err,
    })
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
      if (e.key === "ArrowDown" || e.key === "j") {
        dispatch({ t: "setCursor", v: state.cursor + 1 })
        e.preventDefault()
      } else if (e.key === "ArrowUp" || e.key === "k") {
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
        activePresetId={activePresetId}
        presets={PROGRAM_PRESETS}
        onPresetChange={handlePresetChange}
        stepLimit={state.stepLimit}
        onStepLimitChange={(v) => dispatch({ t: "setStepLimit", v })}
        showLocked={showLocked}
        onToggleLock={handleLockToggle}
        error={state.error}
      />
      <LabelHoverProvider>
        <MainArea
          state={state}
          dispatch={dispatch}
          playing={playing}
          setPlaying={setPlaying}
          trace={trace}
          prog={prog}
          current={current}
          lastStep={lastStep}
          nextStep={nextStep}
          currentCmd={currentCmd}
          kontHighlights={kontHighlights}
        />
      </LabelHoverProvider>
    </div>
  )
}

function MainArea({
  state,
  dispatch,
  playing,
  setPlaying,
  trace,
  prog,
  current,
  lastStep,
  nextStep,
  currentCmd,
  kontHighlights,
}: {
  state: PageState
  dispatch: React.Dispatch<Action>
  playing: boolean
  setPlaying: (p: boolean) => void
  trace: Trace | undefined
  prog: Prog | undefined
  current: Trace["states"][number] | undefined
  lastStep: Trace["steps"][number] | undefined
  nextStep: Trace["steps"][number] | undefined
  currentCmd: ReturnType<Prog["ctrl"]["get"]> | undefined
  kontHighlights: Loc[]
}) {
  const { hovered } = useLabelHover()
  const hoverHighlight =
    prog && hovered !== null ? (prog.ctrl.get(hovered)?.loc ?? null) : null

  return (
    <main className="min-h-0 flex-1 overflow-hidden p-3">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize="30%" minSize="24%">
          <section className="flex h-full min-h-0 flex-col overflow-hidden">
            <LeftPane
              source={state.source}
              setSource={(v) => dispatch({ t: "setSource", v })}
              envText={state.envText}
              setEnv={(v) => dispatch({ t: "setEnv", v })}
              runnableSource={state.runnable?.source ?? null}
              locked={state.locked}
              highlight={currentCmd?.loc}
              kontHighlights={kontHighlights}
              hoverHighlight={hoverHighlight}
            />
          </section>
        </ResizablePanel>
        <ResizableHandle className="mx-2" />
        <ResizablePanel defaultSize="40%" minSize="16%">
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
        <ResizableHandle className="mx-2" />
        <ResizablePanel defaultSize="30%" minSize="20%">
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
  )
}

function Header({
  activePresetId,
  presets,
  onPresetChange,
  stepLimit,
  onStepLimitChange,
  showLocked,
  onToggleLock,
  error,
}: {
  activePresetId: string
  presets: ProgramPreset[]
  onPresetChange: (id: string) => void
  stepLimit: number
  onStepLimitChange: (v: number) => void
  showLocked: boolean
  onToggleLock: () => void
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
        <span className="text-muted-foreground">preset</span>
        <Select value={activePresetId} onValueChange={onPresetChange}>
          <SelectTrigger size="sm" className="w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activePresetId === "custom" && (
              <SelectItem value="custom" disabled>
                custom
              </SelectItem>
            )}
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <Button
        size="sm"
        variant={showLocked ? "default" : "outline"}
        onClick={onToggleLock}
        title={showLocked ? "unlock to edit" : "lock to run / re-run"}
      >
        <LockIcon open={!showLocked} />
        <span className="ml-1 text-xs">
          {showLocked ? "locked" : "unlocked"}
        </span>
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
  highlight,
  kontHighlights,
  hoverHighlight,
}: {
  source: string
  setSource: (v: string) => void
  envText: string
  setEnv: (v: string) => void
  runnableSource: string | null
  locked: boolean
  highlight: Loc | undefined
  kontHighlights: Loc[]
  hoverHighlight: Loc | null
}) {
  const dirty = runnableSource !== null && source !== runnableSource
  const showLocked = locked && runnableSource !== null
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {dirty && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-300"
            title="The text in the editor differs from the source that produced the current trace. Re-run to re-sync highlights."
          >
            source modified
          </Badge>
        </div>
      )}
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="75%" minSize="25%">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-1 text-[10px] tracking-wide text-muted-foreground">
              Program (P)
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ProgramPane
                sourceText={source}
                runnableSource={runnableSource}
                onChange={setSource}
                locked={locked}
                highlight={highlight}
                kontHighlights={kontHighlights}
                hoverHighlight={hoverHighlight}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle className="my-2" />
        <ResizablePanel defaultSize="25%" minSize="10%">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-1 text-[10px] tracking-wide text-muted-foreground">
              Initial Environment (ρ)
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {showLocked ? (
                <EnvPreview value={envText} />
              ) : (
                <EnvEditor value={envText} onChange={setEnv} />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
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
