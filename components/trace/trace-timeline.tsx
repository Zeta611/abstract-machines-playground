"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { parseTraceQuery, traceQueryMatches } from "@/lib/s/trace-query"
import { showVal } from "@/lib/s/values"
import type { State, RuleName, Trace, TraceStep } from "@/lib/s/cek"
import { RiQuestionLine } from "@remixicon/react"
import { useLabelHoverBind } from "./label-hover"

interface Props {
  trace: Trace
  cursor: number
  setCursor: (i: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  onVisibleIndicesChange?: (indices: number[]) => void
}

const RULE_NAMES: RuleName[] = [
  "LetExp",
  "LetCall",
  "Match",
  "Assert",
  "Return",
]

const RULE_TONE: Record<RuleName, string> = {
  LetExp: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  LetCall:
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  Match: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Assert: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  Return:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
}

const QUERY_SUGGESTIONS = [
  {
    group: "Fields",
    items: [
      { label: "rule=", insert: "rule=" },
      { label: "detail=", insert: "detail=" },
      { label: "l=", insert: "l=" },
    ],
  },
  {
    group: "Operators",
    items: [
      { label: "&&", insert: " && " },
      { label: "||", insert: " || " },
      { label: "!", insert: "!" },
      { label: "!=", insert: "!=" },
      { label: ">", insert: ">" },
      { label: ">=", insert: ">=" },
      { label: "<", insert: "<" },
      { label: "<=", insert: "<=" },
    ],
  },
  {
    group: "Examples",
    items: [
      { label: "rule=Match", insert: "rule=Match" },
      { label: "rule!=Match || l!=3", insert: "rule!=Match || l!=3" },
      {
        label: "!(l >= 0 && l <= 3)",
        insert: "!(l >= 0 && l <= 3)",
      },
      {
        label: "(rule=Match || rule=Return) && l=25",
        insert: "(rule=Match || rule=Return) && l=25",
      },
    ],
  },
]

export function TraceTimeline({
  trace,
  cursor,
  setCursor,
  playing,
  setPlaying,
  onVisibleIndicesChange,
}: Props) {
  const lastIdx = Math.max(0, trace.states.length - 1)
  const activeRef = useRef<HTMLButtonElement>(null)
  const queryInputRef = useRef<HTMLInputElement>(null)

  const [queryText, setQueryText] = useState("")
  const [queryHelpOpen, setQueryHelpOpen] = useState(false)
  const [queryScrollLeft, setQueryScrollLeft] = useState(0)

  const queryParse = useMemo(() => parseTraceQuery(queryText), [queryText])

  const visibleIndices = useMemo(() => {
    if (queryParse.ok && queryParse.ast === null) {
      return Array.from({ length: trace.states.length }, (_, i) => i)
    }

    if (!queryParse.ok) {
      return []
    }

    const result: number[] = []
    for (let i = 0; i < trace.states.length; i++) {
      const step = trace.steps[i - 1]
      const state = trace.states[i]
      if (
        traceQueryMatches(queryParse.ast, {
          index: i,
          rule: step?.rule,
          detail: step?.detail,
          value: step?.value ? showVal(step.value) : undefined,
          label: state.label,
        })
      ) {
        result.push(i)
      }
    }
    return result
  }, [trace, queryParse])

  const visibleSet = useMemo(() => new Set(visibleIndices), [visibleIndices])
  const filterActive = queryText.trim() !== ""

  useEffect(() => {
    onVisibleIndicesChange?.(visibleIndices)
  }, [visibleIndices, onVisibleIndicesChange])

  const replaceQuerySelection = useCallback(
    (insert: string) => {
      const input = queryInputRef.current
      const start = input?.selectionStart ?? queryText.length
      const end = input?.selectionEnd ?? start
      const before = queryText.slice(0, start)
      const after = queryText.slice(end)

      const next = before + insert + after
      const nextCursor = before.length + insert.length
      setQueryText(next)
      requestAnimationFrame(() => {
        queryInputRef.current?.focus()
        queryInputRef.current?.setSelectionRange(nextCursor, nextCursor)
      })
    },
    [queryText]
  )

  const insertSuggestion = useCallback(
    (insert: string) => {
      replaceQuerySelection(insert)
      setQueryHelpOpen(false)
    },
    [replaceQuerySelection]
  )

  // --- filtered navigation helpers ---
  const firstVisible = visibleIndices[0] ?? null
  const lastVisible = visibleIndices[visibleIndices.length - 1] ?? null

  const prevVisibleIdx = useMemo(() => {
    for (let j = visibleIndices.length - 1; j >= 0; j--) {
      if (visibleIndices[j] < cursor) return visibleIndices[j]
    }
    return null
  }, [visibleIndices, cursor])

  const nextVisibleIdx = useMemo(() => {
    for (let j = 0; j < visibleIndices.length; j++) {
      if (visibleIndices[j] > cursor) return visibleIndices[j]
    }
    return null
  }, [visibleIndices, cursor])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" })
  }, [cursor])

  // --- step counter label ---
  const posInFiltered = visibleIndices.indexOf(cursor)
  const stepLabel = filterActive
    ? posInFiltered >= 0
      ? `${posInFiltered + 1} of ${visibleIndices.length} (step ${cursor})`
      : `step ${cursor} (${visibleIndices.length} visible)`
    : `step ${cursor} / ${lastIdx}`

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => firstVisible !== null && setCursor(firstVisible)}
          disabled={firstVisible === null || cursor <= firstVisible}
        >
          «
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => prevVisibleIdx !== null && setCursor(prevVisibleIdx)}
          disabled={prevVisibleIdx === null}
        >
          ‹
        </Button>
        <Button
          size="sm"
          variant={playing ? "default" : "outline"}
          onClick={() => setPlaying(!playing)}
          disabled={nextVisibleIdx === null && !playing}
        >
          {playing ? "pause" : "play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => nextVisibleIdx !== null && setCursor(nextVisibleIdx)}
          disabled={nextVisibleIdx === null}
        >
          ›
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => lastVisible !== null && setCursor(lastVisible)}
          disabled={lastVisible === null || cursor >= lastVisible}
        >
          »
        </Button>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {stepLabel}
        </div>
      </div>

      {!filterActive && (
        <div className="shrink-0 px-1">
          <Slider
            min={0}
            max={lastIdx}
            step={1}
            value={[cursor]}
            onValueChange={(v) => setCursor(v[0] ?? 0)}
          />
        </div>
      )}

      <TerminationBadge trace={trace} />

      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 h-7 overflow-hidden border border-transparent px-2.5 py-1 font-mono text-xs tracking-normal whitespace-pre md:text-xs"
            >
              <div style={{ transform: `translateX(-${queryScrollLeft}px)` }}>
                {highlightQuery(queryText)}
              </div>
            </div>
            <Input
              ref={queryInputRef}
              placeholder="rule=Match && (detail=branch || l=25)"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onScroll={(e) => setQueryScrollLeft(e.currentTarget.scrollLeft)}
              onFocus={() => setQueryHelpOpen(true)}
              aria-invalid={!queryParse.ok}
              spellCheck={false}
              className="relative z-10 h-7 bg-transparent pr-2 font-mono text-xs tracking-normal text-transparent caret-foreground placeholder:text-muted-foreground md:text-xs"
            />
          </div>
          <Popover open={queryHelpOpen} onOpenChange={setQueryHelpOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Show query help"
              >
                <RiQuestionLine />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0"
              align="end"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <QueryHelp onInsert={insertSuggestion} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {queryParse.ok ? (
            <span className="text-muted-foreground tabular-nums">
              {filterActive
                ? `${visibleIndices.length} / ${trace.states.length} visible`
                : "query all steps"}
            </span>
          ) : (
            <span className="text-destructive">
              {queryParse.message} at {queryParse.at}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border bg-card">
        <div className="flex flex-col text-xs">
          {trace.states.map((s, i) => {
            if (!visibleSet.has(i)) return null
            const step: TraceStep | undefined = trace.steps[i - 1]
            const active = i === cursor
            return (
              <TimelineRow
                key={i}
                index={i}
                state={s}
                step={step}
                active={active}
                activeRef={active ? activeRef : undefined}
                onSelect={() => setCursor(i)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function QueryHelp({ onInsert }: { onInsert: (value: string) => void }) {
  return (
    <div className="max-h-72 overflow-auto py-1 text-xs">
      {QUERY_SUGGESTIONS.map((group) => (
        <div key={group.group} className="py-1">
          <div className="px-2 pb-1 text-[10px] font-medium text-muted-foreground">
            {group.group}
          </div>
          <div className="flex flex-col">
            {group.items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex items-center px-2 py-1.5 text-left font-mono text-[11px] hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(item.insert)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t px-2 py-2 text-[10px] leading-4 text-muted-foreground">
        Use !, !=, &&, ||, and parentheses. Label queries support &gt;, &gt;=,
        &lt;, and &lt;=. Plain words search rule, detail, value, and label.
      </div>
    </div>
  )
}

function highlightQuery(query: string) {
  const nodes: ReactNode[] = []
  let i = 0

  while (i < query.length) {
    const ruleTerm = readRuleTerm(query, i)
    if (ruleTerm) {
      const valueStart = i + ruleTerm.prefix.length
      if (ruleTerm.prefix.length > 0) {
        nodes.push(
          <span key={i} className="text-muted-foreground">
            {ruleTerm.prefix}
          </span>
        )
      }
      nodes.push(
        <span
          key={valueStart}
          className={cn("rounded-sm bg-clip-padding", RULE_TONE[ruleTerm.rule])}
        >
          {ruleTerm.ruleText}
        </span>
      )
      i += ruleTerm.text.length
      continue
    }

    const op = query.slice(i, i + 2)
    if (
      op === "&&" ||
      op === "||" ||
      op === "!=" ||
      op === "==" ||
      op === ">=" ||
      op === "<="
    ) {
      nodes.push(
        <span key={i} className="text-muted-foreground">
          {op}
        </span>
      )
      i += 2
      continue
    }

    const ch = query[i]
    if (
      ch === "(" ||
      ch === ")" ||
      ch === "=" ||
      ch === "!" ||
      ch === ">" ||
      ch === "<"
    ) {
      nodes.push(
        <span key={i} className="text-muted-foreground">
          {ch}
        </span>
      )
      i++
      continue
    }

    nodes.push(<span key={i}>{ch}</span>)
    i++
  }

  return nodes
}

function readRuleTerm(
  query: string,
  start: number
): { text: string; prefix: string; ruleText: string; rule: RuleName } | null {
  const match = /^rule\s*!?=\s*([A-Za-z]+)/i.exec(query.slice(start))
  if (!match) return null

  const text = match[0]
  const ruleText = match[1]
  const rule = RULE_NAMES.find(
    (candidate) => candidate.toLowerCase() === ruleText.toLowerCase()
  )
  if (!rule) return null

  return {
    text,
    prefix: text.slice(0, text.length - ruleText.length),
    ruleText,
    rule,
  }
}

function TimelineRow({
  index,
  state,
  step,
  active,
  activeRef,
  onSelect,
}: {
  index: number
  state: State
  step: TraceStep | undefined
  active: boolean
  activeRef: React.Ref<HTMLButtonElement> | undefined
  onSelect: () => void
}) {
  const hoverBind = useLabelHoverBind(state.label)
  return (
    <button
      ref={activeRef}
      type="button"
      className={cn(
        "flex items-center gap-2 border-b border-border/40 px-2 py-1 text-left",
        active ? "bg-muted" : "hover:bg-muted/40"
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "min-w-[2.5em] text-muted-foreground tabular-nums",
          active && "font-semibold text-foreground"
        )}
      >
        #{index}
      </span>
      <span
        className={cn(
          "inline-flex min-w-[3.5rem] justify-center rounded px-1.5 py-0.5 font-mono text-[10px]",
          step
            ? RULE_TONE[step.rule]
            : "border border-border text-muted-foreground"
        )}
      >
        {step ? step.rule : "start"}
      </span>
      <span
        className="inline-block min-w-[2.5rem] cursor-help rounded-sm px-1 text-muted-foreground tabular-nums hover:bg-sky-100/60 dark:hover:bg-sky-900/30"
        {...hoverBind}
      >
        ℓ={state.label}
      </span>
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
