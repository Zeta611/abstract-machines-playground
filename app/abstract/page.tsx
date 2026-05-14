"use client"

import Image from "next/image"
import Link from "next/link"
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  RiGithubFill,
  RiLockLine,
  RiLockUnlockLine,
  RiPauseLine,
  RiPlayLine,
  RiRestartLine,
  RiSkipForwardLine,
} from "@remixicon/react"
import { AbsConfigView } from "@/components/abstract/abs-config-view"
import {
  LabelHoverProvider,
  useLabelHover,
} from "@/components/trace/label-hover"
import { ProgramPane } from "@/components/trace/program-pane"
import { SourceEditor } from "@/components/trace/source-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Slider } from "@/components/ui/slider"
import { parse } from "@/lib/s/parser"
import { parseAbsEnvStore } from "@/lib/s/absEnvParser"
import {
  M,
  type AbsCfg,
  type AbsCfgView,
  type MIntf,
} from "@/lib/s/abs"
import { all_labels, by_function } from "@/lib/s/abs_preset"
import { LabelMap, type Label, type Loc, type Program } from "@/lib/s/ast"
import * as Result from "melange/result"
import { ABSTRACT_PROGRAM_PRESETS } from "@/lib/examples"

const DEFAULT_SOURCE =
  ABSTRACT_PROGRAM_PRESETS.find(
    (preset) => preset.id === "definitional-interpreter-abs"
  )?.source ?? ABSTRACT_PROGRAM_PRESETS[0].source

const DEFAULT_ABS_ENV =
  ABSTRACT_PROGRAM_PRESETS.find(
    (preset) => preset.id === "definitional-interpreter-abs"
  )?.absEnvText ?? ABSTRACT_PROGRAM_PRESETS[0].absEnvText

interface StepState {
  cfg: AbsCfg
  view: AbsCfgView
  steps: number
  lastStepMs: number | null
  stabilized: boolean
}

interface RunnableState {
  source: string
  absEnvText: string
  partitionPresetId: PartitionPresetId
  program: Program
  history: StepState[]
  cursor: number
}

interface RowChangeSummary {
  frames: string[]
  vstore: string[]
  kstore: string[]
}

type PartitionPresetId = "all-labels" | "by-function"

const PARTITION_PRESETS: { id: PartitionPresetId; name: string }[] = [
  { id: "all-labels", name: "all labels" },
  { id: "by-function", name: "by function" },
]

function createAnalysis(
  program: Program,
  partitionPresetId: PartitionPresetId
): MIntf {
  return M(
    partitionPresetId === "by-function"
      ? by_function(program)
      : all_labels(program)
  )
}

function labelsFromPattern(labelPtn: string): number[] {
  return Array.from(labelPtn.matchAll(/L(\d+)/g), (match) => Number(match[1]))
}

function firstLabelOfFrame(frame: AbsCfgView["frames"][number]): number | null {
  return labelsFromPattern(frame.label_ptn)[0] ?? null
}

function summarizeRowChanges(
  previous: AbsCfgView | null,
  current: AbsCfgView | null
): RowChangeSummary {
  if (!current) {
    return { frames: [], vstore: [], kstore: [] }
  }

  const summarize = <T,>(
    prevRows: T[],
    nextRows: T[],
    keyOf: (row: T) => string,
    showOf: (row: T) => string,
    normalizeOf: (row: T) => string
  ) => {
    const prevMap = new Map(
      prevRows.map((row) => [keyOf(row), normalizeOf(row)])
    )
    return nextRows.flatMap((row) => {
      const key = keyOf(row)
      const nextNorm = normalizeOf(row)
      const prevNorm = prevMap.get(key)
      if (prevNorm === undefined) return [`+ ${showOf(row)}`]
      if (prevNorm !== nextNorm) return [`~ ${showOf(row)}`]
      return []
    })
  }

  return {
    frames: summarize(
      previous?.frames ?? [],
      current.frames,
      (row) => `${row.time}:${row.label_ptn}`,
      (row) => `P=${row.label_ptn}`,
      (row) => JSON.stringify(row)
    ),
    vstore: summarize(
      previous?.vstore ?? [],
      current.vstore,
      (row) => row.addr,
      (row) => row.addr,
      (row) => JSON.stringify(row)
    ),
    kstore: summarize(
      previous?.kstore ?? [],
      current.kstore,
      (row) => row.addr,
      (row) => row.addr,
      (row) => JSON.stringify(row)
    ),
  }
}

function hasVisibleRowChanges(summary: RowChangeSummary): boolean {
  return (
    summary.frames.length > 0 ||
    summary.vstore.length > 0 ||
    summary.kstore.length > 0
  )
}

function tryBuildInitial(
  source: string,
  absEnvText: string,
  partitionPresetId: PartitionPresetId
): { result: RunnableState | null; error: string | null } {
  return Result.fold(
    ({ program }) =>
      Result.fold(
        (init) => {
          const analysis = createAnalysis(program, partitionPresetId)
          const cfg = analysis.abs_inject(init)
          return {
            result: {
              source,
              absEnvText,
              partitionPresetId,
              program,
              history: [
                {
                  cfg,
                  view: analysis.view_cfg(cfg),
                  steps: 0,
                  lastStepMs: null,
                  stabilized: false,
                },
              ],
              cursor: 0,
            },
            error: null,
          }
        },
        (error: string) => ({ result: null, error }),
        parseAbsEnvStore(absEnvText)
      ),
    (error: string) => ({ result: null, error }),
    parse(source)
  )
}

export default function AbstractPage() {
  const [partitionPresetId, setPartitionPresetId] =
    useState<PartitionPresetId>("all-labels")
  const initial = useMemo(
    () => tryBuildInitial(DEFAULT_SOURCE, DEFAULT_ABS_ENV, "all-labels"),
    []
  )
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [absEnvText, setAbsEnvText] = useState(DEFAULT_ABS_ENV)
  const [result, setResult] = useState<RunnableState | null>(initial.result)
  const [error, setError] = useState<string | null>(initial.error)
  const [isPending, setIsPending] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [locked, setLocked] = useState(true)
  const [hoveredAddrLabel, setHoveredAddrLabel] = useState<number | null>(null)
  const [activeLabel, setActiveLabel] = useState<number | null>(
    initial.result?.history[0]?.view.frames[0]
      ? firstLabelOfFrame(initial.result.history[0].view.frames[0])
      : null
  )
  const activePresetId =
    ABSTRACT_PROGRAM_PRESETS.find(
      (preset) => preset.source === source && preset.absEnvText === absEnvText
    )?.id ?? "custom"

  const sourceDirty = !result || source !== result.source
  const envDirty = !result || absEnvText !== result.absEnvText
  const partitionDirty = !result || partitionPresetId !== result.partitionPresetId
  const dirty = sourceDirty || envDirty || partitionDirty
  const showLocked = locked && result !== null
  const currentState = result ? result.history[result.cursor] : null
  const previousState =
    result && result.cursor > 0 ? result.history[result.cursor - 1] : null

  useEffect(() => {
    startTransition(() => {
      if (!result) {
        setActiveLabel(null)
        return
      }
      const labels = result.history[result.cursor].view.frames.flatMap((frame) =>
        labelsFromPattern(frame.label_ptn)
      )
      if (labels.length === 0) {
        setActiveLabel(null)
        return
      }
      if (activeLabel === null || !labels.includes(activeLabel)) {
        setActiveLabel(labels[0])
      }
    })
  }, [result, activeLabel])

  const handleLockToggle = () => {
    if (showLocked) {
      setPlaying(false)
      setLocked(false)
      return
    }

    if (dirty) {
      setPlaying(false)
      const next = tryBuildInitial(source, absEnvText, partitionPresetId)
      setResult(next.result)
      setError(next.error)
      setActiveLabel(
        next.result?.history[0]?.view.frames[0]
          ? firstLabelOfFrame(next.result.history[0].view.frames[0])
          : null
      )
      setHoveredAddrLabel(null)
      setLocked(next.result !== null)
      return
    }

    setLocked(true)
  }

  const handleStep = useCallback(() => {
    if (!result) return

    setIsPending(true)
    startTransition(() => {
      const started = performance.now()
      const analysis = createAnalysis(result.program, result.partitionPresetId)
      const next = analysis.abs_transfer(result.history[result.cursor].cfg)
      const elapsed = performance.now() - started

      Result.fold(
        (cfg: AbsCfg) => {
          const nextView = analysis.view_cfg(cfg)
          const baseState = result.history[result.cursor]
          const rowChanges = summarizeRowChanges(baseState.view, nextView)
          const nextState: StepState = {
            cfg,
            view: nextView,
            steps: baseState.steps + 1,
            lastStepMs: elapsed,
            stabilized:
              cfg === baseState.cfg || !hasVisibleRowChanges(rowChanges),
          }
          const historyPrefix = result.history.slice(0, result.cursor + 1)
          setResult({
            source: result.source,
            absEnvText: result.absEnvText,
            partitionPresetId: result.partitionPresetId,
            program: result.program,
            history: [...historyPrefix, nextState],
            cursor: historyPrefix.length,
          })
          setError(null)
        },
        (nextError: string) => {
          setError(nextError)
        },
        next
      )

      setIsPending(false)
    })
  }, [result])

  const handlePresetChange = (id: string) => {
    const preset = ABSTRACT_PROGRAM_PRESETS.find((entry) => entry.id === id)
    if (!preset) return

    setPlaying(false)
    setSource(preset.source)
    setAbsEnvText(preset.absEnvText)
    const next = tryBuildInitial(
      preset.source,
      preset.absEnvText,
      partitionPresetId
    )
    setResult(next.result)
    setError(next.error)
    setActiveLabel(
      next.result?.history[0]?.view.frames[0]
        ? firstLabelOfFrame(next.result.history[0].view.frames[0])
        : null
    )
    setHoveredAddrLabel(null)
    setLocked(next.result !== null)
  }

  const handleReset = () => {
    setPlaying(false)
    const next = tryBuildInitial(source, absEnvText, partitionPresetId)
    setResult(next.result)
    setError(next.error)
    setActiveLabel(
      next.result?.history[0]?.view.frames[0]
        ? firstLabelOfFrame(next.result.history[0].view.frames[0])
        : null
    )
    setHoveredAddrLabel(null)
    if (next.result) {
      setLocked(true)
    }
  }

  const handleCursorChange = (nextCursor: number) => {
    if (!result) return
    setPlaying(false)
    setResult({
      ...result,
      cursor: Math.max(0, Math.min(result.history.length - 1, nextCursor)),
    })
  }

  const handlePartitionPresetChange = (id: string) => {
    const nextPartitionPresetId = id as PartitionPresetId
    setPlaying(false)
    setPartitionPresetId(nextPartitionPresetId)
    if (!showLocked) {
      return
    }
    const next = tryBuildInitial(source, absEnvText, nextPartitionPresetId)
    setResult(next.result)
    setError(next.error)
    setActiveLabel(
      next.result?.history[0]?.view.frames[0]
        ? firstLabelOfFrame(next.result.history[0].view.frames[0])
        : null
    )
    setHoveredAddrLabel(null)
    setLocked(next.result !== null)
  }

  useEffect(() => {
    if (
      !playing ||
      !showLocked ||
      !result ||
      !currentState ||
      currentState.stabilized
    ) {
      return
    }

    const id = setTimeout(() => {
      handleStep()
    }, 1000)

    return () => clearTimeout(id)
  }, [playing, showLocked, result, currentState, handleStep])

  useEffect(() => {
    startTransition(() => {
      if (!showLocked || !result || currentState?.stabilized) {
        setPlaying(false)
      }
    })
  }, [showLocked, result, currentState?.stabilized])

  return (
    <LabelHoverProvider>
      <AbstractPageInner
        source={source}
        setSource={setSource}
        absEnvText={absEnvText}
        setAbsEnvText={setAbsEnvText}
        result={result}
        error={error}
        isPending={isPending}
        playing={playing}
        showLocked={showLocked}
        dirty={dirty}
        onLockToggle={handleLockToggle}
        onStep={handleStep}
        onReset={handleReset}
        onTogglePlaying={() => setPlaying((p) => !p)}
        onCursorChange={handleCursorChange}
        activeLabel={activeLabel}
        setActiveLabel={setActiveLabel}
        hoveredAddrLabel={hoveredAddrLabel}
        setHoveredAddrLabel={setHoveredAddrLabel}
        activePresetId={activePresetId}
        onPresetChange={handlePresetChange}
        partitionPresetId={partitionPresetId}
        onPartitionPresetChange={handlePartitionPresetChange}
        currentState={currentState}
        previousState={previousState}
      />
    </LabelHoverProvider>
  )
}

function AbstractPageInner({
  source,
  setSource,
  absEnvText,
  setAbsEnvText,
  result,
  error,
  isPending,
  playing,
  showLocked,
  dirty,
  onLockToggle,
  onStep,
  onReset,
  onTogglePlaying,
  onCursorChange,
  activeLabel,
  setActiveLabel,
  hoveredAddrLabel,
  setHoveredAddrLabel,
  activePresetId,
  onPresetChange,
  partitionPresetId,
  onPartitionPresetChange,
  currentState,
  previousState,
}: {
  source: string
  setSource: (v: string) => void
  absEnvText: string
  setAbsEnvText: (v: string) => void
  result: RunnableState | null
  error: string | null
  isPending: boolean
  playing: boolean
  showLocked: boolean
  dirty: boolean
  onLockToggle: () => void
  onStep: () => void
  onReset: () => void
  onTogglePlaying: () => void
  onCursorChange: (cursor: number) => void
  activeLabel: number | null
  setActiveLabel: (label: number) => void
  hoveredAddrLabel: number | null
  setHoveredAddrLabel: (label: number | null) => void
  activePresetId: string
  onPresetChange: (id: string) => void
  partitionPresetId: PartitionPresetId
  onPartitionPresetChange: (id: string) => void
  currentState: StepState | null
  previousState: StepState | null
}) {
  const { hovered } = useLabelHover()
  const frameLabels =
    currentState?.view.frames.flatMap((frame) =>
      labelsFromPattern(frame.label_ptn)
    ) ?? []
  const currentLabel = activeLabel ?? frameLabels[0] ?? null

  const currentLoc =
    currentLabel !== null && result
      ? (LabelMap.find_opt(currentLabel as Label, result.program.ctrl)?.loc ??
        null)
      : null

  const kontHighlights: Loc[] =
    currentLabel !== null && result
      ? frameLabels
          .filter((label) => label !== currentLabel)
          .map(
            (label) =>
              LabelMap.find_opt(label as Label, result.program.ctrl)?.loc
          )
          .filter((loc): loc is Loc => loc !== undefined)
      : []

  const hoverHighlight =
    hoveredAddrLabel !== null && result
      ? (LabelMap.find_opt(hoveredAddrLabel as Label, result.program.ctrl)
          ?.loc ?? null)
      : hovered !== null && result
        ? (LabelMap.find_opt(hovered, result.program.ctrl)?.loc ?? null)
        : null
  const rowChanges = useMemo(
    () =>
      summarizeRowChanges(
        previousState?.view ?? null,
        currentState?.view ?? null
      ),
    [previousState, currentState]
  )
  const changedEntries = [
    ...rowChanges.frames.map((entry) => ({ kind: "frame", entry })),
    ...rowChanges.vstore.map((entry) => ({ kind: "value", entry })),
    ...rowChanges.kstore.map((entry) => ({ kind: "kont", entry })),
  ]

  return (
    <main className="flex h-svh min-h-0 flex-col overflow-hidden bg-muted/20">
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
          <span className="font-semibold">Abstract Abstract Machine Playground</span>
          {dirty && (
            <Badge
              variant="outline"
              className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-300"
            >
              input modified
            </Badge>
          )}
        </div>
        <div className="ml-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">example</span>
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
              {ABSTRACT_PROGRAM_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">partition</span>
          <Select
            value={partitionPresetId}
            onValueChange={onPartitionPresetChange}
          >
            <SelectTrigger size="sm" className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTITION_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={onReset}>
          <RiRestartLine className="size-3.5" aria-hidden />
          <span className="text-xs">Reset</span>
        </Button>
        <Button
          size="sm"
          variant={showLocked ? "default" : "outline"}
          onClick={onLockToggle}
          title={showLocked ? "unlock to edit" : "lock to apply inputs"}
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
        <Button
          size="sm"
          variant="outline"
          onClick={onTogglePlaying}
          disabled={!showLocked || !result || !!currentState?.stabilized}
        >
          {playing ? (
            <RiPauseLine className="size-3.5" aria-hidden />
          ) : (
            <RiPlayLine className="size-3.5" aria-hidden />
          )}
          <span className="text-xs">
            {playing ? "Pause 1s" : "Step / 1s"}
          </span>
        </Button>
        <Button
          size="sm"
          onClick={onStep}
          disabled={isPending || !showLocked || !result}
        >
          <RiSkipForwardLine className="size-3.5" aria-hidden />
          <span className="text-xs">
            {isPending ? "Stepping..." : "Step"}
          </span>
        </Button>
        {error && (
          <div className="min-w-0 flex-1 truncate text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/">
              <span className="text-xs">Trace Playground</span>
            </Link>
          </Button>
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

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize="34%" minSize="24%">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <ResizablePanelGroup
                orientation="vertical"
                className="min-h-0 flex-1"
              >
                <ResizablePanel defaultSize="68%" minSize="25%">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-[10px] tracking-wide text-muted-foreground">
                        Program (P)
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        reachable labels
                      </Badge>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <ProgramPane
                        sourceText={source}
                        runnableSource={result?.source ?? null}
                        onChange={setSource}
                        locked={showLocked}
                        highlight={currentLoc}
                        kontHighlights={kontHighlights}
                        hoverHighlight={hoverHighlight}
                      />
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle className="my-2" />
                <ResizablePanel defaultSize="32%" minSize="12%">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-[10px] tracking-wide text-muted-foreground">
                        Abstract Environment / Store Seed
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {`{1|2|Foo(3)}`}
                      </Badge>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <SourceEditor
                        value={absEnvText}
                        onChange={setAbsEnvText}
                        ariaLabel="abstract environment seed"
                        readOnly={showLocked}
                        copyLabel="abstract environment seed"
                      />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
          <ResizableHandle className="mx-2" />
          <ResizablePanel defaultSize="66%" minSize="22%">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="rounded border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={currentState?.stabilized ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {currentState?.stabilized
                      ? "fixpoint reached"
                      : "ready to step"}
                  </Badge>
                  {result && (
                    <Badge variant="outline" className="text-[10px]">
                      {currentState?.steps ?? 0} transfer step
                      {currentState?.steps === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {currentState && currentState.lastStepMs !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      last step {currentState.lastStepMs.toFixed(2)} ms
                    </Badge>
                  )}
                  {currentLabel !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      active ℓ={currentLabel}
                    </Badge>
                  )}
                </div>
                {currentState && currentState.steps > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      changed rows
                    </span>
                    {changedEntries.length > 0 ? (
                      changedEntries.map(({ kind, entry }) => (
                        <Badge
                          key={`${kind}:${entry}`}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {kind}: {entry}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        none
                      </span>
                    )}
                  </div>
                )}
                {result && result.history.length > 1 && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-10 text-[11px] text-muted-foreground">
                      0
                    </div>
                    <Slider
                      value={[result.cursor]}
                      min={0}
                      max={result.history.length - 1}
                      step={1}
                      onValueChange={(value) => onCursorChange(value[0] ?? 0)}
                      className="flex-1"
                    />
                    <div className="w-24 text-right text-[11px] text-muted-foreground">
                      {result.cursor} / {result.history.length - 1}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  {currentState?.stabilized
                    ? "The latest transfer step produced no further growth."
                    : result && result.cursor < result.history.length - 1
                      ? "Use the slider to revisit explored states, or step from the current position to continue from there."
                      : playing
                        ? "Autoplay is advancing one abstract transfer step every second."
                        : "Click a frame row to focus its label, or hover a label badge to preview its source range."}
                </div>
              </div>

              {result ? (
                <AbsConfigView
                  view={currentState?.view ?? result.history[0].view}
                  activeLabel={currentLabel}
                  onSelectLabel={setActiveLabel}
                  onHoverAddrLabel={setHoveredAddrLabel}
                />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-dashed bg-card/50 p-6 text-sm text-muted-foreground">
                  Lock a valid program and abstract environment to inspect the
                  abstract configuration.
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  )
}
