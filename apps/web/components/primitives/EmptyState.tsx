import { type ComponentType, type ReactNode, type SVGProps } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-12 px-6',
        className,
      )}
    >
      {Icon && (
        <div className="rounded-full bg-[var(--glass-bg-strong)] p-4 mb-2">
          <Icon className="h-8 w-8 text-[var(--fg-muted)]" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-2xl text-[var(--fg)]">{title}</h3>
      {description && (
        <p className="max-w-md text-[var(--fg-muted)] text-base">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
