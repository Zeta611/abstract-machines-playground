"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Label } from "@/lib/s/ast"

interface LabelHoverCtx {
  hovered: Label | null
  setHovered: (l: Label | null) => void
}

const Ctx = createContext<LabelHoverCtx | null>(null)

export function LabelHoverProvider({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState<Label | null>(null)
  const value = useMemo(() => ({ hovered, setHovered }), [hovered])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLabelHover(): LabelHoverCtx {
  const v = useContext(Ctx)
  if (!v) {
    return { hovered: null, setHovered: () => {} }
  }
  return v
}

/**
 * Returns handlers to attach to any element that represents `label`.
 * Hovering/focusing sets the shared hovered label; leaving/blurring clears
 * it if it's still the same label (avoids racing handlers between siblings).
 */
export function useLabelHoverBind(label: Label) {
  const { hovered, setHovered } = useLabelHover()
  const enter = useCallback(() => setHovered(label), [label, setHovered])
  const leave = useCallback(() => {
    setHovered(null)
  }, [setHovered])
  return {
    onMouseEnter: enter,
    onMouseLeave: leave,
    onFocus: enter,
    onBlur: leave,
    "data-hovered": hovered === label ? "" : undefined,
  } as const
}
