import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <Card className={cn('border-border/70 shadow-sm transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 sm:gap-3">
              {icon && (
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl border border-border bg-muted/60 text-foreground shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 sm:mt-1 text-xl sm:text-3xl font-semibold tracking-tight">{value}</p>
              </div>
            </div>

            {trend && (
              <div
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  trend.direction === 'up'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
                )}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
