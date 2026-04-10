// components/ui/ScrollToTop.tsx
'use client';

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type ScrollToTopProps = React.ComponentProps<typeof Button> & {
    minHeight?: number; // Від якої висоти показувати кнопку
    scrollTo?: number;  // На яку позицію скролити (0 = топ)
};

export function ScrollToTop({
                                minHeight,
                                scrollTo,
                                ...props
                            }: ScrollToTopProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(document.documentElement.scrollTop >= (minHeight ?? 0));
        };
        onScroll();
        document.addEventListener("scroll", onScroll);
        return () => document.removeEventListener("scroll", onScroll);
    }, [minHeight]);

    return visible ? (
        <Button
            variant="outline"
            className="fixed right-6 bottom-6 z-50 rounded-full shadow-xl py-3"
            onClick={() =>
                window.scrollTo({
                    top: scrollTo ?? 0,
                    behavior: "smooth",
                })
            }
            {...props}
        />
    ) : null;
}
