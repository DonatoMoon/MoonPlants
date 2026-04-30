import { type ComponentType, type ReactNode, type SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { GlassCard } from './GlassCard';

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  hint?: string;
  className?: string;
  colorClassName?: string;
}

export function Stat({ label, value, unit, icon: Icon, hint, className, colorClassName }: StatProps) {
  return (
    <GlassCard className={cn('flex flex-col gap-2 p-4 md:p-5', className)}>
      <div className={cn('flex items-center gap-2 text-xs uppercase tracking-wide', colorClassName || 'text-[var(--fg-muted)]')}>
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-display text-2xl md:text-3xl leading-none', colorClassName || 'text-[var(--fg)]')}>
          {value}
        </span>
        {unit && <span className={cn('text-sm', colorClassName || 'text-[var(--fg-muted)]', colorClassName && 'opacity-80')}>{unit}</span>}
      </div>
      {hint && <p className="text-[var(--fg-subtle)] text-xs">{hint}</p>}
    </GlassCard>
  );
}
