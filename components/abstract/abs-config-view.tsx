"use client"

import { Badge } from "@/components/ui/badge"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type {
  AbsCfgView,
  AbsEnvRow,
  AbsFrameRow,
  AbsKStoreRow,
  AbsVStoreRow,
} from "@/lib/s/abs"

function parseAddrLabel(addr: string): number | null {
  const match = addr.match(/^[vk]\((\d+)(?:,\d+)?\)$/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function labelsFromPattern(labelPtn: string): number[] {
  return Array.from(labelPtn.matchAll(/L(\d+)/g), (match) => Number(match[1]))
}

function AddrBadges({
  addrs,
  onHoverAddrLabel,
  emptyLabel = "∅",
}: {
  addrs: string[]
  onHoverAddrLabel?: (label: number | null) => void
  emptyLabel?: string
}) {
  if (addrs.length === 0) {
    return <span className="italic text-muted-foreground">{emptyLabel}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {addrs.map((addr) => {
        const label = parseAddrLabel(addr)
        return (
          <Badge
            key={addr}
            variant="outline"
            className="font-mono text-[10px]"
            onMouseEnter={() => onHoverAddrLabel?.(label)}
            onMouseLeave={() => onHoverAddrLabel?.(null)}
            onFocus={() => onHoverAddrLabel?.(label)}
            onBlur={() => onHoverAddrLabel?.(null)}
          >
            {addr}
          </Badge>
        )
      })}
    </div>
  )
}

function EnvCell({
  rows,
  emptyLabel = "(empty)",
  onHoverAddrLabel,
}: {
  rows: AbsEnvRow[]
  emptyLabel?: string
  onHoverAddrLabel?: (label: number | null) => void
}) {
  if (rows.length === 0) {
    return <span className="italic text-muted-foreground">{emptyLabel}</span>
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[auto_1fr] gap-x-2">
          <span className="text-emerald-700 dark:text-emerald-300">
            {row.name}
          </span>
          <div className="min-w-0">
            <AddrBadges addrs={row.addrs} onHoverAddrLabel={onHoverAddrLabel} />
          </div>
        </div>
      ))}
    </div>
  )
}

function KontCell({
  kont,
  emptyLabel = "∅",
  onHoverAddrLabel,
}: {
  kont: string[]
  emptyLabel?: string
  onHoverAddrLabel?: (label: number | null) => void
}) {
  return (
    <AddrBadges
      addrs={kont}
      emptyLabel={emptyLabel}
      onHoverAddrLabel={onHoverAddrLabel}
    />
  )
}

function PanelShell({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-xs text-muted-foreground">{title}</div>
        <Badge variant="outline" className="text-[10px]">
          {count} row{count === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}

function FrameRow({
  row,
  active,
  onSelectLabel,
  onHoverAddrLabel,
}: {
  row: AbsFrameRow
  active: boolean
  onSelectLabel: (label: number) => void
  onHoverAddrLabel?: (label: number | null) => void
}) {
  const primaryLabel = labelsFromPattern(row.label_ptn)[0] ?? null

  return (
    <button
      type="button"
      onClick={() => {
        if (primaryLabel !== null) onSelectLabel(primaryLabel)
      }}
      className={[
        "flex w-full flex-col gap-3 border-b px-3 py-2 text-left text-xs last:border-b-0",
        "hover:bg-muted/30 focus:bg-muted/30 focus:outline-none",
        active ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant={active ? "default" : "outline"}
          className="font-mono text-[10px]"
        >
          P={row.label_ptn}
        </Badge>
      </div>
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Env
          </div>
          <EnvCell rows={row.env} onHoverAddrLabel={onHoverAddrLabel} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Kont Addrs
          </div>
          <KontCell kont={row.kont} onHoverAddrLabel={onHoverAddrLabel} />
        </div>
      </div>
    </button>
  )
}

function FramesTable({
  rows,
  activeLabel,
  onSelectLabel,
  onHoverAddrLabel,
}: {
  rows: AbsFrameRow[]
  activeLabel: number | null
  onSelectLabel: (label: number) => void
  onHoverAddrLabel?: (label: number | null) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        No reachable abstract frames yet.
      </div>
    )
  }

  return (
    <div>
      {rows.map((row) => (
        <FrameRow
          key={`${row.time}:${row.label_ptn}:${row.kont.join("|")}`}
          row={row}
          active={activeLabel !== null && labelsFromPattern(row.label_ptn).includes(activeLabel)}
          onSelectLabel={onSelectLabel}
          onHoverAddrLabel={onHoverAddrLabel}
        />
      ))}
    </div>
  )
}

function VStoreTable({
  rows,
  onHoverAddrLabel,
}: {
  rows: AbsVStoreRow[]
  onHoverAddrLabel?: (label: number | null) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        The abstract value store is empty.
      </div>
    )
  }

  return (
    <div className="min-w-[32rem]">
      <div className="grid grid-cols-[8rem_minmax(16rem,1fr)] border-b bg-muted/40 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>Addr</div>
        <div>Value</div>
      </div>
      {rows.map((row) => (
        <div
          key={row.addr}
          className="grid grid-cols-[8rem_minmax(16rem,1fr)] gap-x-4 border-b px-3 py-2 text-xs last:border-b-0"
        >
          <AddrBadges addrs={[row.addr]} onHoverAddrLabel={onHoverAddrLabel} />
          <div className="break-words">{row.value}</div>
        </div>
      ))}
    </div>
  )
}

function KStoreTable({
  rows,
  onHoverAddrLabel,
}: {
  rows: AbsKStoreRow[]
  onHoverAddrLabel?: (label: number | null) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        The continuation store is empty.
      </div>
    )
  }

  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.addr}
          className="flex flex-col gap-3 border-b px-3 py-2 text-xs last:border-b-0"
        >
          <div>
            <AddrBadges addrs={[row.addr]} onHoverAddrLabel={onHoverAddrLabel} />
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Saved Env
              </div>
              <EnvCell rows={row.env} onHoverAddrLabel={onHoverAddrLabel} />
            </div>
            <div className="min-w-0 md:min-w-[8rem]">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Saved Kont
              </div>
              <KontCell kont={row.kont} onHoverAddrLabel={onHoverAddrLabel} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AbsConfigView({
  view,
  activeLabel,
  onSelectLabel,
  onHoverAddrLabel,
}: {
  view: AbsCfgView
  activeLabel: number | null
  onSelectLabel: (label: number) => void
  onHoverAddrLabel?: (label: number | null) => void
}) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 flex-1"
    >
      <ResizablePanel defaultSize="34%" minSize="15%">
        <PanelShell title="Reachable Frames" count={view.frames.length}>
          <FramesTable
            rows={view.frames}
            activeLabel={activeLabel}
            onSelectLabel={onSelectLabel}
            onHoverAddrLabel={onHoverAddrLabel}
          />
        </PanelShell>
      </ResizablePanel>
      <ResizableHandle className="mx-2" />
      <ResizablePanel defaultSize="33%" minSize="15%">
        <PanelShell title="Value Store" count={view.vstore.length}>
          <VStoreTable rows={view.vstore} onHoverAddrLabel={onHoverAddrLabel} />
        </PanelShell>
      </ResizablePanel>
      <ResizableHandle className="mx-2" />
      <ResizablePanel defaultSize="33%" minSize="15%">
        <PanelShell title="Kont Store" count={view.kstore.length}>
          <KStoreTable rows={view.kstore} onHoverAddrLabel={onHoverAddrLabel} />
        </PanelShell>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
