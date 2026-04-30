'use client';

import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps extends HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
  once?: boolean;
}

export function ScrollReveal({
  delayMs = 0,
  once = true,
  className,
  style,
  children,
  ...props
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        transitionDelay: visible ? `${delayMs}ms` : '0ms',
      }}
      className={cn(
        'motion-safe:transition-[opacity,transform] motion-safe:duration-[var(--dur-slow)] motion-safe:ease-[var(--ease-out)]',
        visible
          ? 'opacity-100 translate-y-0'
          : 'motion-safe:opacity-0 motion-safe:translate-y-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
