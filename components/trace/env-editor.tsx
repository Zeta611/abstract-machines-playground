"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { EnvParseError, parseEnv } from "@/lib/s/env-parser"
import { ValueView } from "./value-view"
import type { Env } from "@/lib/s/values"

interface Props {
  value: string
  onChange: (v: string) => void
}

interface PreviewResult {
  env: Env | null
  error: string | null
}

export function EnvEditor({ value, onChange }: Props) {
  const preview: PreviewResult = useMemo(() => {
    try {
      return { env: parseEnv(value), error: null }
    } catch (e) {
      const msg =
        e instanceof EnvParseError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e)
      return { env: null, error: msg }
    }
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="initial-environment"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded border bg-background px-2 py-2 font-mono text-xs leading-5",
          "outline-none focus-visible:outline-none",
          "min-h-[6rem] resize-y"
        )}
        placeholder={
          "# one binding per line: name = value-literal\np = Prog(Nil(), Int(0))\narg = 0"
        }
      />
      {preview.error && (
        <div className="rounded border border-destructive/50 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
          {preview.error}
        </div>
      )}
      {preview.env && preview.env.size > 0 && (
        <div className="rounded border bg-muted/30 px-2 py-2 text-xs">
          <div className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            parsed
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {[...preview.env.entries()].map(([k, v]) => (
              <div key={k} className="contents">
                <div className="text-emerald-700 dark:text-emerald-300">
                  {k}
                </div>
                <div className="min-w-0 break-all">
                  <ValueView value={v} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
