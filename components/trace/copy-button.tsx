"use client"

import { useEffect, useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  text: string
  label: string
  className?: string
}

export function CopyButton({ text, label, className }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.top = "-9999px"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
  }

  return (
    <Button
      type="button"
      size="icon-xs"
      variant="outline"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={copy}
      className={cn(
        "pointer-events-none absolute top-1 right-1 z-10 bg-background/90 opacity-0 shadow-sm backdrop-blur transition-opacity",
        "group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100",
        className
      )}
    >
      {copied ? <RiCheckLine /> : <RiFileCopyLine />}
    </Button>
  )
}
