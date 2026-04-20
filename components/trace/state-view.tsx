"use client"

import { Badge } from "@/components/ui/badge"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { cmdSummary } from "@/lib/s/ast"
import type { ControlMap } from "@/lib/s/ast"
import type { State, TraceStep } from "@/lib/s/cek"
import { EnvView } from "./env-view"
import { KontView } from "./kont-view"
import { useLabelHoverBind } from "./label-hover"
import { ValueView } from "./value-view"

interface Props {
  state: State
  ctrl: ControlMap
  lastStep?: TraceStep
  nextStep?: TraceStep
}

/** Panel that summarizes one CEK state: control, environment, kontinuation. */
export function StateView({ state, ctrl, lastStep, nextStep }: Props) {
  const cmd = ctrl.get(state.label)
  const hoverBind = useLabelHoverBind(state.label)

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full w-full">
      <ResizablePanel defaultSize="15%" minSize="10%">
        <div className="h-full min-h-0 overflow-auto rounded border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              <b>C</b>ontrol (e)
            </span>
            <Badge
              variant="outline"
              tabIndex={0}
              className="cursor-help font-mono text-[10px] focus:ring-2 focus:ring-sky-400 focus:outline-none"
              {...hoverBind}
            >
              ℓ={state.label}
            </Badge>
            {nextStep && (
              <Badge variant="secondary" className="text-[10px]">
                next: {nextStep.rule}
              </Badge>
            )}
            {lastStep && (
              <Badge variant="outline" className="text-[10px]">
                prev: {lastStep.rule}
              </Badge>
            )}
          </div>
          <div className="mt-1 font-mono text-sm">
            {cmd ? cmdSummary(cmd) : `(no command for label ${state.label})`}
          </div>
          {lastStep?.value && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">last value</span>
              <ValueView value={lastStep.value} />
            </div>
          )}
          {lastStep?.detail && (
            <div className="mt-1 text-[11px] text-muted-foreground italic">
              {lastStep.detail}
            </div>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle className="my-1" />
      <ResizablePanel defaultSize="20%" minSize="10%">
        <div className="h-full min-h-0 overflow-auto rounded border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              <b>E</b>nvironment (ρ)
            </span>
            <Badge variant="outline" className="text-[10px]">
              {state.env.size} binding{state.env.size === 1 ? "" : "s"}
            </Badge>
          </div>
          <Separator className="mb-2" />
          <EnvView env={state.env} />
        </div>
      </ResizablePanel>
      <ResizableHandle className="my-1" />
      <ResizablePanel defaultSize="65%" minSize="10%">
        <div className="h-full min-h-0 overflow-auto rounded border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              <b>K</b>ontinuation (κ)
            </span>
            <Badge variant="outline" className="text-[10px]">
              depth {state.kont.length}
            </Badge>
          </div>
          <Separator className="mb-2" />
          <KontView kont={state.kont} ctrl={ctrl} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
