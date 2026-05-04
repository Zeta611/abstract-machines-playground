"use client"

import { Badge } from "@/components/ui/badge"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Cmd, Label } from "@/lib/libamp/ast"
import type { State, TraceStep } from "@/lib/libamp/cek"
import { EnvView } from "./env-view"
import { KontView } from "./kont-view"
import { useLabelHoverBind } from "./label-hover"
import { ValueView } from "./value-view"
import { IntMap, Map, StringMap } from "@/lib/libamp/utils"
import { of_list } from "melange/array"

interface Props {
  state: State
  ctrl: Map<Label, Cmd.Cmd>
  lastStep?: TraceStep
  nextStep?: TraceStep
}

/** Panel that summarizes one CEK state: control, environment, kontinuation. */
export function StateView({ state, ctrl, lastStep, nextStep }: Props) {
  const cmd = IntMap.find_opt(state.label, ctrl)
  const hoverBind = useLabelHoverBind(state.label)
  const bindingCount = StringMap.cardinal(state.env)
  const kont = of_list(state.kont)

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
            {cmd ? Cmd.summary(cmd) : `(no command for label ${state.label})`}
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
              {bindingCount} binding{bindingCount === 1 ? "" : "s"}
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
              depth {kont.length}
            </Badge>
          </div>
          <Separator className="mb-2" />
          <KontView kont={kont} ctrl={ctrl} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
