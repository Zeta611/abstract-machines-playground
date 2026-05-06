"use client"

import { useLabelHoverBind } from "@/components/trace/label-hover"
import { Badge } from "@/components/ui/badge"
import type {
  AbsCfgView,
  AbsEnvRow,
  AbsFrameRow,
  AbsKStoreRow,
  AbsVStoreRow,
} from "@/lib/s/abs"
import type { Label } from "@/lib/s/ast"

function EnvCell({
  rows,
  emptyLabel = "(empty)",
}: {
  rows: AbsEnvRow[]
  emptyLabel?: string
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
          <span className="break-words text-foreground/90">
            {row.addrs.join(", ")}
          </span>
        </div>
      ))}
    </div>
  )
}

function KontCell({
  kont,
  emptyLabel = "∅",
}: {
  kont: string[]
  emptyLabel?: string
}) {
  if (kont.length === 0) {
    return <span className="italic text-muted-foreground">{emptyLabel}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {kont.map((addr) => (
        <Badge key={addr} variant="outline" className="font-mono text-[10px]">
          {addr}
        </Badge>
      ))}
    </div>
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
    <section className="flex min-h-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-sm font-semibold">{title}</div>
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
}: {
  row: AbsFrameRow
  active: boolean
  onSelectLabel: (label: number) => void
}) {
  const hoverBind = useLabelHoverBind(row.label as Label)

  return (
    <button
      type="button"
      onClick={() => onSelectLabel(row.label)}
      className={[
        "grid w-full grid-cols-[7rem_minmax(14rem,1fr)_12rem] gap-x-4 border-b px-4 py-3 text-left text-xs last:border-b-0",
        "hover:bg-muted/30 focus:bg-muted/30 focus:outline-none",
        active ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "",
      ].join(" ")}
    >
      <div>
        <Badge
          variant={active ? "default" : "outline"}
          className="font-mono text-[10px]"
          {...hoverBind}
        >
          ℓ={row.label}
        </Badge>
      </div>
      <div className="pt-0.5">
        <EnvCell rows={row.env} />
      </div>
      <div className="pt-0.5">
        <KontCell kont={row.kont} />
      </div>
    </button>
  )
}

function FramesTable({
  rows,
  activeLabel,
  onSelectLabel,
}: {
  rows: AbsFrameRow[]
  activeLabel: number | null
  onSelectLabel: (label: number) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        No reachable abstract frames yet.
      </div>
    )
  }

  return (
    <div className="min-w-[44rem]">
      <div className="grid grid-cols-[7rem_minmax(14rem,1fr)_12rem] border-b bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>Label</div>
        <div>Env</div>
        <div>Kont Addrs</div>
      </div>
      {rows.map((row) => (
        <FrameRow
          key={`${row.label}:${row.kont.join("|")}`}
          row={row}
          active={activeLabel === row.label}
          onSelectLabel={onSelectLabel}
        />
      ))}
    </div>
  )
}

function VStoreTable({ rows }: { rows: AbsVStoreRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        The abstract value store is empty.
      </div>
    )
  }

  return (
    <div className="min-w-[32rem]">
      <div className="grid grid-cols-[8rem_minmax(16rem,1fr)] border-b bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>Addr</div>
        <div>Value</div>
      </div>
      {rows.map((row) => (
        <div
          key={row.addr}
          className="grid grid-cols-[8rem_minmax(16rem,1fr)] gap-x-4 border-b px-4 py-3 text-xs last:border-b-0"
        >
          <div className="font-mono text-sky-700 dark:text-sky-300">
            {row.addr}
          </div>
          <div className="break-words">{row.value}</div>
        </div>
      ))}
    </div>
  )
}

function KStoreTable({ rows }: { rows: AbsKStoreRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-4 text-sm italic text-muted-foreground">
        The continuation store is empty.
      </div>
    )
  }

  return (
    <div className="min-w-[48rem]">
      <div className="grid grid-cols-[8rem_minmax(14rem,1fr)_12rem] border-b bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>Addr</div>
        <div>Saved Env</div>
        <div>Saved Kont</div>
      </div>
      {rows.map((row) => (
        <div
          key={row.addr}
          className="grid grid-cols-[8rem_minmax(14rem,1fr)_12rem] gap-x-4 border-b px-4 py-3 text-xs last:border-b-0"
        >
          <div className="font-mono text-amber-700 dark:text-amber-300">
            {row.addr}
          </div>
          <EnvCell rows={row.env} />
          <KontCell kont={row.kont} />
        </div>
      ))}
    </div>
  )
}

export function AbsConfigView({
  view,
  activeLabel,
  onSelectLabel,
}: {
  view: AbsCfgView
  activeLabel: number | null
  onSelectLabel: (label: number) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
      <PanelShell title="Reachable Frames" count={view.frames.length}>
        <FramesTable
          rows={view.frames}
          activeLabel={activeLabel}
          onSelectLabel={onSelectLabel}
        />
      </PanelShell>
      <PanelShell title="Value Store" count={view.vstore.length}>
        <VStoreTable rows={view.vstore} />
      </PanelShell>
      <PanelShell title="Kont Store" count={view.kstore.length}>
        <KStoreTable rows={view.kstore} />
      </PanelShell>
    </div>
  )
}
