// components/ui/Container.tsx
import { cn } from "@/lib/utils";
import React from "react";

export default function Container({
                              className,
                              children,
                              ...props
                          }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                // Головне: авто-центрування, max-width і адаптивний падінг
                "w-full mx-auto px-4 sm:px-6 md:px-8 max-w-screen-xl min-h-full h-full flex flex-col",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
