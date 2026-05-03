"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Cmd, Command, Label } from "@/lib/libamp/ast"
import type { Frame } from "@/lib/s/cek"
import { EnvView } from "./env-view"
import { useLabelHoverBind } from "./label-hover"
import { IntMap, Map } from "@/lib/libamp/utils"

interface Props {
  kont: Frame[]
  ctrl: Map<Label, Command>
}

/** Continuation stack. Top of stack (index 0) = next frame to resume. */
export function KontView({ kont, ctrl }: Props) {
  if (kont.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        empty continuation
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {kont.map((f, i) => (
        <FrameCard key={i} frame={f} ctrl={ctrl} position={i} isTop={i === 0} />
      ))}
    </div>
  )
}

function FrameCard({
  frame,
  ctrl,
  position,
  isTop,
}: {
  frame: Frame
  ctrl: Map<Label, Command>
  position: number
  isTop: boolean
}) {
  const [open, setOpen] = useState(isTop)
  const cmd = IntMap.find_opt(frame.label, ctrl)
  const summary = cmd ? Cmd.summary(cmd) : `(unknown label ${frame.label})`
  const hoverBind = useLabelHoverBind(frame.label)

  return (
    <div
      className={cn(
        "rounded border px-2 py-1 text-xs",
        isTop
          ? "border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20"
          : "border-border bg-muted/30"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
          {isTop ? "top" : `#${position}`}
        </Badge>
        <span
          className="cursor-help rounded-sm px-1 text-muted-foreground hover:bg-sky-100/60 dark:hover:bg-sky-900/30"
          {...hoverBind}
        >
          ℓ={frame.label}
        </span>
        <span className="flex-1 truncate">{summary}</span>
        <span className="text-[10px] text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="mt-1 ml-1 border-l border-border/60 pt-1 pl-1">
          <EnvView env={frame.env} emptyLabel="(empty env)" />
        </div>
      )}
    </div>
  )
}
