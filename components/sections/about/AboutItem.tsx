// components/sections/about/AboutItem.tsx
import Image, { StaticImageData } from 'next/image'

type AboutItemProps = {
    title: string
    desc: string
    img: StaticImageData
    reverse?: boolean
}

export default function AboutItem({ title, desc, img, reverse }: AboutItemProps) {
    return (
        <div
            className={[
                'relative overflow-visible',
                'w-full max-w-3xl mx-auto rounded-[56px] shadow-xl',
                'bg-white/10 backdrop-blur-md px-10 py-8',
                'flex flex-col',
                reverse ? 'md:flex-row-reverse' : 'md:flex-row',
                'gap-4 md:gap-8',
            ].join(' ')}
        >
            {/* Картинка — завжди по центру на мобілці */}
            <div
                className={[
                    'relative z-20',
                    'flex-shrink-0 flex items-center justify-center',
                    reverse ? 'md:justify-end md:-mr-12' : 'md:justify-start md:-ml-12',
                    'md:-mt-20 lg:-mt-35',
                ].join(' ')}
            >
                <Image
                    src={img}
                    alt={title}
                    width={300}
                    height={300}
                    draggable={false}
                />
            </div>
            <div
                className={[
                    'flex-1 min-w-0',
                    'flex flex-col justify-center',
                    'text-center md:text-left',
                ].join(' ')}
            >
                <h3 className="text-2xl font-bold mb-2">{title}</h3>
                <p className="text-base opacity-90">{desc}</p>
            </div>
        </div>

    )
}
