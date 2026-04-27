import { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  title?: string
  description?: string
}

export function PageContainer({
  children,
  title,
  description,
}: PageContainerProps) {
  return (
    <main className="flex-1 overflow-auto">
      {(title || description) && (
        <div className="border-b border-border px-6 py-6">
          {title && <h1 className="text-3xl font-bold">{title}</h1>}
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
      )}
      <div className="px-6 py-6">{children}</div>
    </main>
  )
}
