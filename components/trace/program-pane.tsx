"use client"

import type { Loc } from "@/lib/s/ast"
import { SourceEditor } from "./source-editor"
import { SourceView } from "./source-view"

interface Props {
  sourceText: string
  runnableSource: string | null
  onChange: (v: string) => void
  locked: boolean
  highlight?: Loc | null
  kontHighlights?: Loc[]
  hoverHighlight?: Loc | null
}

/**
 * Merged editor + highlighted viewer. When `locked` and a trace is available,
 * renders the trace-synced source (read-only) with current/kont highlights.
 * When unlocked, renders the editable textarea bound to `sourceText`.
 *
 * The locked/unlocked split exists because highlights carry character
 * offsets against the source that was parsed; letting the user type while
 * those offsets were still rendered would silently drift the highlight.
 *
 * The lock toggle itself lives in the parent (shared row with the tab
 * list) so that this component can fill the available vertical space
 * without its own chrome.
 */
export function ProgramPane({
  sourceText,
  runnableSource,
  onChange,
  locked,
  highlight,
  kontHighlights,
  hoverHighlight,
}: Props) {
  const showLocked = locked && runnableSource !== null

  return (
    <div className="h-full min-h-0 overflow-hidden">
      {showLocked && runnableSource !== null ? (
        <SourceView
          source={runnableSource}
          highlight={highlight}
          kontHighlights={kontHighlights}
          hoverHighlight={hoverHighlight}
        />
      ) : (
        <SourceEditor
          value={sourceText}
          onChange={onChange}
          ariaLabel="S source"
        />
      )}
    </div>
  )
}
