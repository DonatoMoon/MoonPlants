// components/layout/BackgroundImageContainer.tsx

import Image, { StaticImageData } from "next/image";

import { ReactNode } from "react";

type BackgroundImageContainerProps = {
    children: ReactNode;
    src: StaticImageData | string;
};

export default function BackgroundImageContainer({ children, src }: BackgroundImageContainerProps) {
    return (
        <div className="relative w-full h-full flex-1 overflow-x-clip ">
            <Image
                src={src}
                alt="Decorative background"
                fill
                className="object-cover object-center opacity-70 select-none pointer-events-none z-0"
                priority
                draggable={false}
            />

            <div className="relative z-10 flex flex-col h-full min-h-full">
                {children}
            </div>
        </div>
    )
}