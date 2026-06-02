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
    <div className="flex-1 overflow-x-hidden overflow-y-auto w-full min-w-0">
      {(title || description) && (
        <div className="border-b border-border px-4 py-4 sm:px-6 sm:py-6">
          {title && <h1 className="text-xl sm:text-3xl font-bold">{title}</h1>}
          {description && (
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{description}</p>
          )}
        </div>
      )}
      <div className="px-4 py-4 sm:px-6 sm:py-8">{children}</div>
    </div>
  )
}
