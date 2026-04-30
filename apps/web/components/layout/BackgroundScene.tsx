import { type ReactNode } from 'react';

interface BackgroundSceneProps {
    children: ReactNode;
    variant?: 'profile' | 'plain';
}

export function BackgroundScene({ children, variant = 'profile' }: BackgroundSceneProps) {
    return (
        <div className="relative flex flex-col flex-1">
            {variant === 'profile' && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(73,107,52,0.35)_0%,transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(73,107,52,0.25)_0%,transparent_50%)]" />
                    <svg
                        className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <filter id="moonplants-noise">
                            <feTurbulence
                                type="fractalNoise"
                                baseFrequency="0.9"
                                numOctaves="2"
                                stitchTiles="stitch"
                            />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#moonplants-noise)" />
                    </svg>
                </div>
            )}
            <div className="relative flex flex-col flex-1">{children}</div>
        </div>
    );
}
