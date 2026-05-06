"use client"

import Link from "next/link"
import { startTransition, useEffect, useMemo, useState } from "react"
import {
  RiArrowLeftLine,
  RiLockLine,
  RiLockUnlockLine,
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
import { parse } from "@/lib/s/parser"
import { parseAbsEnvStore } from "@/lib/s/absEnvParser"
import {
  abs_inject,
  abs_transfer,
  view_cfg,
  type AbsCfg,
  type AbsCfgView,
} from "@/lib/s/abs"
import { LabelMap, type Label, type Loc, type Program } from "@/lib/s/ast"
import * as Result from "melange/result"
import { PROGRAM_PRESETS } from "@/lib/examples"

const DEFAULT_SOURCE =
  PROGRAM_PRESETS.find((preset) => preset.id === "factorial")?.source ??
  PROGRAM_PRESETS[0].source

const DEFAULT_ABS_ENV = `n = {0|1|2|3}
`

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
  program: Program
  state: StepState
}

function tryBuildInitial(
  source: string,
  absEnvText: string
): { result: RunnableState | null; error: string | null } {
  return Result.fold(
    ({ program }) =>
      Result.fold(
        (init) => {
          const cfg = abs_inject(program, init)
          return {
            result: {
              source,
              absEnvText,
              program,
              state: {
                cfg,
                view: view_cfg(cfg),
                steps: 0,
                lastStepMs: null,
                stabilized: false,
              },
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
  const initial = useMemo(
    () => tryBuildInitial(DEFAULT_SOURCE, DEFAULT_ABS_ENV),
    []
  )
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [absEnvText, setAbsEnvText] = useState(DEFAULT_ABS_ENV)
  const [result, setResult] = useState<RunnableState | null>(initial.result)
  const [error, setError] = useState<string | null>(initial.error)
  const [isPending, setIsPending] = useState(false)
  const [locked, setLocked] = useState(true)
  const [activeLabel, setActiveLabel] = useState<number | null>(
    initial.result?.state.view.frames[0]?.label ?? null
  )

  const sourceDirty = !result || source !== result.source
  const envDirty = !result || absEnvText !== result.absEnvText
  const dirty = sourceDirty || envDirty
  const showLocked = locked && result !== null

  useEffect(() => {
    if (!result) {
      setActiveLabel(null)
      return
    }
    const labels = result.state.view.frames.map((frame) => frame.label)
    if (labels.length === 0) {
      setActiveLabel(null)
      return
    }
    if (activeLabel === null || !labels.includes(activeLabel)) {
      setActiveLabel(labels[0])
    }
  }, [result, activeLabel])

  const handleLockToggle = () => {
    if (showLocked) {
      setLocked(false)
      return
    }

    if (dirty) {
      const next = tryBuildInitial(source, absEnvText)
      setResult(next.result)
      setError(next.error)
      setActiveLabel(next.result?.state.view.frames[0]?.label ?? null)
      setLocked(next.result !== null)
      return
    }

    setLocked(true)
  }

  const handleStep = () => {
    if (!result) return

    setIsPending(true)
    startTransition(() => {
      const started = performance.now()
      const next = abs_transfer(result.program, result.state.cfg)
      const elapsed = performance.now() - started

      Result.fold(
        (cfg) => {
          const nextView = view_cfg(cfg)
          setResult({
            source: result.source,
            absEnvText: result.absEnvText,
            program: result.program,
            state: {
              cfg,
              view: nextView,
              steps: result.state.steps + 1,
              lastStepMs: elapsed,
              stabilized: cfg === result.state.cfg,
            },
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
  }

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
        showLocked={showLocked}
        dirty={dirty}
        onLockToggle={handleLockToggle}
        onStep={handleStep}
        activeLabel={activeLabel}
        setActiveLabel={setActiveLabel}
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
  showLocked,
  dirty,
  onLockToggle,
  onStep,
  activeLabel,
  setActiveLabel,
}: {
  source: string
  setSource: (v: string) => void
  absEnvText: string
  setAbsEnvText: (v: string) => void
  result: RunnableState | null
  error: string | null
  isPending: boolean
  showLocked: boolean
  dirty: boolean
  onLockToggle: () => void
  onStep: () => void
  activeLabel: number | null
  setActiveLabel: (label: number) => void
}) {
  const { hovered } = useLabelHover()
  const frameLabels = result?.state.view.frames.map((frame) => frame.label) ?? []
  const currentLabel = activeLabel ?? frameLabels[0] ?? null

  const currentLoc =
    currentLabel !== null && result
      ? LabelMap.find_opt(currentLabel as Label, result.program.ctrl)?.loc ?? null
      : null

  const kontHighlights: Loc[] =
    currentLabel !== null && result
      ? frameLabels
          .filter((label) => label !== currentLabel)
          .map((label) => LabelMap.find_opt(label as Label, result.program.ctrl)?.loc)
          .filter((loc): loc is Loc => loc !== undefined)
      : []

  const hoverHighlight =
    hovered !== null && result
      ? LabelMap.find_opt(hovered, result.program.ctrl)?.loc ?? null
      : null

  return (
    <main className="flex h-svh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Button asChild size="sm" variant="outline">
          <Link href="/">
            <RiArrowLeftLine className="size-4" aria-hidden />
            <span className="text-xs">Trace Playground</span>
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">Abstract Fixpoint Explorer</h1>
            <Badge variant="outline" className="text-[10px]">
              abstract transfer
            </Badge>
            {dirty && (
              <Badge
                variant="outline"
                className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-300"
              >
                input modified
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Lock the inputs to keep source offsets stable, then step through the
            abstract transfer while highlighting reachable labels.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
            <span className="text-xs">{showLocked ? "locked" : "unlocked"}</span>
          </Button>
          <Button size="sm" onClick={onStep} disabled={isPending || !showLocked || !result}>
            <RiSkipForwardLine className="size-3.5" aria-hidden />
            <span className="text-xs">{isPending ? "Stepping..." : "Step"}</span>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize="34%" minSize="24%">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="68%" minSize="25%">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs tracking-wide text-muted-foreground">
                        Program (P)
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
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
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs tracking-wide text-muted-foreground">
                        Abstract Environment / Store Seed
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
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
              <div className="rounded-xl border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={result?.state.stabilized ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {result?.state.stabilized ? "fixpoint reached" : "ready to step"}
                  </Badge>
                  {result && (
                    <Badge variant="outline" className="text-[10px]">
                      {result.state.steps} transfer step
                      {result.state.steps === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {result && result.state.lastStepMs !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      last step {result.state.lastStepMs.toFixed(2)} ms
                    </Badge>
                  )}
                  {currentLabel !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      active ℓ={currentLabel}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {error
                    ? error
                    : result?.state.stabilized
                      ? "The latest transfer step produced no further growth."
                      : "Click a frame row to focus its label, or hover a label badge to preview its source range."}
                </div>
              </div>

              {result ? (
                <AbsConfigView
                  view={result.state.view}
                  activeLabel={currentLabel}
                  onSelectLabel={setActiveLabel}
                />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-sm text-muted-foreground">
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
