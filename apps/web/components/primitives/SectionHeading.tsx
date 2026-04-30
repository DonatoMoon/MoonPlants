import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  kicker?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  actions?: ReactNode;
  className?: string;
}

export function SectionHeading({
  kicker,
  title,
  description,
  align = 'left',
  actions,
  className,
}: SectionHeadingProps) {
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 mb-6',
        align === 'center' ? 'mx-auto' : 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-2', alignment)}>
        {kicker && (
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--accent)] font-medium">
            {kicker}
          </span>
        )}
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-[var(--fg)]">
          {title}
        </h2>
        {description && (
          <p className="text-[var(--fg-muted)] text-base max-w-xl">{description}</p>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'block h-[2px] w-12 rounded-full bg-[var(--accent)] mt-1',
            align === 'center' && 'mx-auto',
          )}
        />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
