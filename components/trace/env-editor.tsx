"use client"

import { useMemo } from "react"
import type { Val, Env } from "@/lib/libamp/values"
import { cn } from "@/lib/utils"
import { parseEnv } from "@/lib/libamp/envParser"
import { ValueView } from "./value-view"
import { CopyButton } from "./copy-button"
import { StringMap } from "@/lib/libamp/utils"
import * as Result from "melange/result"

interface PreviewResult {
  env: Env | null
  error: string | null
}

function useEnvPreview(value: string): PreviewResult {
  return useMemo(() => {
    return Result.fold(
      (env) => ({ env, error: null }),
      (error) => ({ env: null, error }),
      parseEnv(value)
    )
  }, [value])
}

/**
 * Read-only rendering of the parsed initial environment, shared between the
 * locked LeftPane view and the unlocked `EnvEditor` preview block.
 *
 * `hideEmpty` suppresses the "(empty environment)" placeholder so the inline
 * editor preview stays silent for trivially-empty input (matching the
 * pre-refactor behaviour).
 */
export function EnvPreview({
  value,
  hideEmpty = false,
  copyLabel,
}: {
  value: string
  hideEmpty?: boolean
  copyLabel?: string
}) {
  const preview = useEnvPreview(value)
  if (preview.error) {
    return (
      <div className="group relative rounded border border-destructive/50 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
        {preview.error}
        {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
      </div>
    )
  }
  if (!preview.env || StringMap.cardinal(preview.env) === 0) {
    if (hideEmpty) return null
    return (
      <div className="group relative rounded border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
        (empty environment)
        {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
      </div>
    )
  }
  return (
    <div className="group relative rounded border bg-muted/30 px-2 py-2 text-xs">
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {StringMap.bindings<Val>(preview.env).map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-emerald-700 dark:text-emerald-300">{k}</div>
            <div className="min-w-0 break-all">
              <ValueView value={v} />
            </div>
          </div>
        ))}
      </div>
      {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
    </div>
  )
}

interface Props {
  value: string
  onChange: (v: string) => void
}

export function EnvEditor({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="group relative">
        <textarea
          aria-label="initial-environment"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded border bg-background py-2 pr-9 pl-2 font-mono text-xs leading-5",
            "outline-none focus-visible:outline-none",
            "min-h-[6rem] resize-y"
          )}
          placeholder={
            "# one binding per line: name = value-literal\np = Prog(Nil(), Int(0))\narg = 0"
          }
        />
        <CopyButton text={value} label="initial environment" />
      </div>
      <EnvPreview value={value} hideEmpty />
    </div>
  )
}
