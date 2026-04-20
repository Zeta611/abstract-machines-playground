"use client"

import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { showVal } from "@/lib/s/values"
import type { RuleName, Trace, TraceStep } from "@/lib/s/cek"

interface Props {
  trace: Trace
  cursor: number
  setCursor: (i: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
}

const RULE_TONE: Record<RuleName, string> = {
  LetExp: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  LetCall:
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  Match: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Assert: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  Return:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
}

export function TraceTimeline({
  trace,
  cursor,
  setCursor,
  playing,
  setPlaying,
}: Props) {
  const lastIdx = Math.max(0, trace.states.length - 1)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" })
  }, [cursor])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCursor(0)}
          disabled={cursor === 0}
        >
          «
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCursor(Math.max(0, cursor - 1))}
          disabled={cursor === 0}
        >
          ‹
        </Button>
        <Button
          size="sm"
          variant={playing ? "default" : "outline"}
          onClick={() => setPlaying(!playing)}
          disabled={cursor >= lastIdx && !playing}
        >
          {playing ? "pause" : "play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCursor(Math.min(lastIdx, cursor + 1))}
          disabled={cursor >= lastIdx}
        >
          ›
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCursor(lastIdx)}
          disabled={cursor >= lastIdx}
        >
          »
        </Button>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          step {cursor} / {lastIdx}
        </div>
      </div>

      <div className="shrink-0 px-1">
        <Slider
          min={0}
          max={lastIdx}
          step={1}
          value={[cursor]}
          onValueChange={(v) => setCursor(v[0] ?? 0)}
        />
      </div>

      <TerminationBadge trace={trace} />

      <div className="min-h-0 flex-1 overflow-auto rounded border bg-card">
        <div className="flex flex-col text-xs">
          {trace.states.map((s, i) => {
            const step: TraceStep | undefined = trace.steps[i - 1]
            const active = i === cursor
            return (
              <button
                key={i}
                ref={active ? activeRef : undefined}
                type="button"
                className={cn(
                  "flex items-center gap-2 border-b border-border/40 px-2 py-1 text-left",
                  active ? "bg-muted" : "hover:bg-muted/40"
                )}
                onClick={() => setCursor(i)}
              >
                <span
                  className={cn(
                    "min-w-[2.5em] text-muted-foreground tabular-nums",
                    active && "font-semibold text-foreground"
                  )}
                >
                  #{i}
                </span>
                {step ? (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px]",
                      RULE_TONE[step.rule]
                    )}
                  >
                    {step.rule}
                  </span>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    start
                  </Badge>
                )}
                <span className="text-muted-foreground">ℓ={s.label}</span>
                {step?.detail && (
                  <span className="flex-1 truncate text-foreground/80">
                    {step.detail}
                  </span>
                )}
                {!step?.detail && <span className="flex-1" />}
                {step?.value && (
                  <span className="max-w-[12em] truncate text-[10px] text-muted-foreground">
                    {showVal(step.value)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TerminationBadge({ trace }: { trace: Trace }) {
  const end = trace.end
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      {end.kind === "final" && (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">final</Badge>
      )}
      {end.kind === "stuck" && <Badge variant="destructive">stuck</Badge>}
      {end.kind === "maxed" && (
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-700 dark:text-amber-300"
        >
          step limit
        </Badge>
      )}
      <span className="truncate text-muted-foreground">
        {end.kind === "final" && `value = ${showVal(end.value)}`}
        {end.kind === "stuck" && end.reason}
        {end.kind === "maxed" && end.reason}
      </span>
    </div>
  )
}
