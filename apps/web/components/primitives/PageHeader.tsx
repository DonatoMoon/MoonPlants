import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6 md:mb-8',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl md:text-4xl tracking-tight text-[var(--fg)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[var(--fg-muted)] text-base">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
