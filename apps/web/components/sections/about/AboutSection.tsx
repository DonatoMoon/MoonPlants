// components/sections/about/AboutSection.tsx
import AboutItem from './AboutItem'
import about1 from '@/public/about1.png'
import about2 from '@/public/about2.png'
import about3 from '@/public/about3.png'
import { getTranslations } from 'next-intl/server';

export default async function AboutSection() {
    const t = await getTranslations('AboutSection');

    const features = [
        { title: t('feature1Title'), desc: t('feature1Desc'), img: about1 },
        { title: t('feature2Title'), desc: t('feature2Desc'), img: about2 },
        { title: t('feature3Title'), desc: t('feature3Desc'), img: about3 },
    ];

    return (
        <section id="about" className="py-20 w-full flex flex-col items-center gap-12 md:gap-24 lg:gap-32">
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-medium tracking-wide mb-1">{t('title')}</span>
                    <div className="w-15 h-1 rounded bg-green-300 opacity-70" />
                </div>

                {features.map((f, i) => (
                    <AboutItem
                        key={f.title}
                        title={f.title}
                        desc={f.desc}
                        img={f.img}
                        reverse={i % 2 === 1}
                    />
                ))}
        </section>
    )
}
