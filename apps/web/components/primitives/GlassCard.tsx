import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  hoverable?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, strong, hoverable, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      className={cn(
        'rounded-[var(--radius-lg)] border shadow-glass backdrop-blur-glass',
        'border-[var(--glass-border)]',
        strong ? 'bg-[var(--glass-bg-strong)]' : 'bg-[var(--glass-bg)]',
        hoverable &&
          'transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-lg)]',
        className,
      )}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
