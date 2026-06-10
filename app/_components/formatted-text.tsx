import { ReactNode } from 'react'

/** Render inline **bold** segments within a single line. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

/**
 * Lightweight text formatter: keeps line breaks (each line on its own line)
 * and renders **bold** segments. Blank lines become spacing between blocks.
 */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className}>
      {lines.map((line, i) =>
        line.trim() === ''
          ? <div key={i} className="h-2" />
          : <p key={i} className="leading-relaxed">{renderInline(line, String(i))}</p>
      )}
    </div>
  )
}
