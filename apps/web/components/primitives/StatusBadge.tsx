import { cn } from '@/lib/utils';

type Status = 'online' | 'offline' | 'warning' | 'error' | 'info' | 'neutral';

const styles: Record<Status, string> = {
  online: 'bg-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_40%,transparent)]',
  offline: 'bg-[var(--glass-bg-strong)] text-[var(--fg-muted)] border-[var(--glass-border)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_25%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_40%,transparent)]',
  error: 'bg-[color-mix(in_srgb,var(--destructive)_25%,transparent)] text-[var(--destructive)] border-[color-mix(in_srgb,var(--destructive)_40%,transparent)]',
  info: 'bg-[color-mix(in_srgb,var(--info)_25%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_40%,transparent)]',
  neutral: 'bg-[var(--glass-bg)] text-[var(--fg)] border-[var(--glass-border)]',
};

interface StatusBadgeProps {
  status: Status;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, children, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border',
        styles[status],
        pulse && 'motion-safe:animate-pulse',
        className,
      )}
    >
      {children}
    </span>
  );
}
