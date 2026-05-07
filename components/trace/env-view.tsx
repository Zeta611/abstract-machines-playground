"use client"

import type { Env, Val } from "@/lib/s/values"
import { ValueView } from "./value-view"
import { StringMap } from "@/lib/s/utils"
import { of_list } from "melange/array"

interface Props {
  env: Env
  emptyLabel?: string
  highlight?: Set<string>
}

export function EnvView({ env, emptyLabel = "(empty)", highlight }: Props) {
  const entries = of_list(StringMap.to_list<Val>(env))
  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">{emptyLabel}</div>
    )
  }
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <div
            className={
              "text-emerald-700 dark:text-emerald-300 " +
              (highlight?.has(k)
                ? "rounded bg-yellow-100/30 px-1 font-semibold dark:bg-yellow-800/20"
                : "")
            }
          >
            {k}
          </div>
          <div className="min-w-0 break-words">
            <ValueView value={v} />
          </div>
        </div>
      ))}
    </div>
  )
}
