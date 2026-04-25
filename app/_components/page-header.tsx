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
    <div className="mb-8">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-3">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-balance">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {action && <div className="lg:ml-4">{action}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
