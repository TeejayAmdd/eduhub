import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-5 sm:mb-8">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-balance">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{description}</p>
          )}
        </div>
        {action && <div className="sm:ml-4 w-full sm:w-auto">{action}</div>}
      </div>
      {children && <div className="mt-4 sm:mt-6">{children}</div>}
    </div>
  );
}
