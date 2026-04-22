"use client"

import Image from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import {
  RiDownload2Line,
  RiGithubFill,
  RiLockLine,
  RiLockUnlockLine,
  RiUpload2Line,
} from "@remixicon/react"
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
  queryText: string
  stepLimit: number
  runnable: Runnable | null
  cursor: number
  error: string | null
  locked: boolean
}

type Action =
  | { t: "setSource"; v: string }
  | { t: "setEnv"; v: string }
  | { t: "setQuery"; v: string }
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
  | {
      t: "importSettings"
      source: string
      envText: string
      queryText: string
      r: Runnable | null
      err: string | null
    }

function reducer(s: PageState, a: Action): PageState {
  switch (a.t) {
    case "setSource":
      return { ...s, source: a.v }
    case "setEnv":
      return { ...s, envText: a.v }
    case "setQuery":
      return { ...s, queryText: a.v }
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
    case "importSettings":
      return {
        ...s,
        source: a.source,
        envText: a.envText,
        queryText: a.queryText,
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
    queryText: "",
    stepLimit,
    runnable: r,
    cursor: 0,
    error: err,
    locked: true,
  }
}

function nextVisibleAfter(indices: number[], cursor: number): number | null {
  for (const index of indices) {
    if (index > cursor) return index
  }
  return null
}

function previousVisibleBefore(
  indices: number[],
  cursor: number
): number | null {
  for (let j = indices.length - 1; j >= 0; j--) {
    const index = indices[j]
    if (index < cursor) return index
  }
  return null
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitial)
  const [playing, setPlaying] = useState(false)
  const visibleIndicesRef = useRef<number[]>([])

  const handleVisibleIndicesChange = useCallback((indices: number[]) => {
    visibleIndicesRef.current = indices
  }, [])

  // Reset visible indices when trace changes
  useEffect(() => {
    if (state.runnable) {
      visibleIndicesRef.current = Array.from(
        { length: state.runnable.trace.states.length },
        (_, i) => i
      )
    }
  }, [state.runnable])

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

  const handleExport = useCallback(() => {
    const data = JSON.stringify(
      {
        source: state.source,
        envText: state.envText,
        filterQuery: state.queryText,
      },
      null,
      2
    )
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "snapshot.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [state.source, state.envText, state.queryText])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          const source = typeof data.source === "string" ? data.source : ""
          const envText = typeof data.envText === "string" ? data.envText : ""
          const queryText =
            typeof data.filterQuery === "string" ? data.filterQuery : ""

          setPlaying(false)
          const { r, err } = tryCompile(source, envText, state.stepLimit)
          dispatch({
            t: "importSettings",
            source,
            envText,
            queryText,
            r,
            err,
          })
        } catch {
          dispatch({ t: "runFailure", err: "Failed to parse imported JSON" })
        }
      }
      reader.readAsText(file)
      // Reset so the same file can be re-imported
      e.target.value = ""
    },
    [state.stepLimit]
  )

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

  // Playback ticker: advance to the next *visible* index while playing.
  useEffect(() => {
    if (!playing || !state.runnable) return
    const id = setTimeout(() => {
      const vis = visibleIndicesRef.current
      const next = nextVisibleAfter(vis, state.cursor)
      if (next === null) {
        setPlaying(false)
        return
      }

      dispatch({ t: "setCursor", v: next })
      if (next >= (vis[vis.length - 1] ?? 0)) setPlaying(false)
    }, 150)
    return () => clearTimeout(id)
  }, [playing, state.cursor, state.runnable])

  // Keyboard navigation over the trace (filter-aware).
  useEffect(() => {
    if (!state.runnable) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      const vis = visibleIndicesRef.current
      if (e.key === "ArrowDown" || e.key === "j") {
        const next = nextVisibleAfter(vis, state.cursor)
        if (next !== null) dispatch({ t: "setCursor", v: next })
        e.preventDefault()
      } else if (e.key === "ArrowUp" || e.key === "k") {
        const previous = previousVisibleBefore(vis, state.cursor)
        if (previous !== null) dispatch({ t: "setCursor", v: previous })
        e.preventDefault()
      } else if (e.key === " ") {
        setPlaying((p) => {
          if (p) return false
          return (
            nextVisibleAfter(visibleIndicesRef.current, state.cursor) !== null
          )
        })
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
        onExport={handleExport}
        fileInputRef={fileInputRef}
        onImport={handleImport}
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
          onVisibleIndicesChange={handleVisibleIndicesChange}
          queryText={state.queryText}
          setQueryText={(v) => dispatch({ t: "setQuery", v })}
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
  onVisibleIndicesChange,
  queryText,
  setQueryText,
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
  onVisibleIndicesChange: (indices: number[]) => void
  queryText: string
  setQueryText: (v: string) => void
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
                onVisibleIndicesChange={onVisibleIndicesChange}
                queryText={queryText}
                setQueryText={setQueryText}
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
  onExport,
  fileInputRef,
  onImport: onImportFile,
}: {
  activePresetId: string
  presets: ProgramPreset[]
  onPresetChange: (id: string) => void
  stepLimit: number
  onStepLimitChange: (v: number) => void
  showLocked: boolean
  onToggleLock: () => void
  error: string | null
  onExport: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onImport: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-background/70 px-3 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <Image
          src="/logo.png"
          width={24}
          height={24}
          alt=""
          aria-hidden="true"
          className="size-6 shrink-0 rounded"
        />
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
      <Button size="sm" variant="outline" onClick={onExport}>
        <RiUpload2Line className="size-3.5" aria-hidden />
        <span className="text-xs">Export</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
      >
        <RiDownload2Line className="size-3.5" aria-hidden />
        <span className="text-xs">Import</span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={onImportFile}
      />
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
        {showLocked ? (
          <RiLockLine className="size-3.5" aria-hidden />
        ) : (
          <RiLockUnlockLine className="size-3.5" aria-hidden />
        )}
        <span className="ml-1 text-xs">
          {showLocked ? "locked" : "unlocked"}
        </span>
      </Button>
      {error && (
        <div className="min-w-0 flex-1 truncate text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="text-[11px] text-muted-foreground">
          ↓/↑ or j/k step · space = play/pause
        </div>
        <Button asChild size="sm" variant="outline">
          <a
            href="https://github.com/Zeta611/abstract-machines-playground"
            target="_blank"
            rel="noreferrer"
            title="Open GitHub repository"
            aria-label="Open GitHub repository"
          >
            <RiGithubFill />
            <span className="text-xs">GitHub</span>
          </a>
        </Button>
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
