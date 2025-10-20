// components/sections/about/AboutSection.tsx
import AboutItem from './AboutItem'
import about1 from '@/public/about1.png'
import about2 from '@/public/about2.png'
import about3 from '@/public/about3.png'
import Container from '@/components/layout/Container'

const features = [
    {
        title: 'Real-Time Monitoring',
        desc: "Stay informed with live updates on your plant’s soil moisture, air humidity, temperature, and light levels",
        img: about1,
    },
    {
        title: 'Smart Recommendations',
        desc: 'Get precise, AI-driven advice on when to water your plants to ensure they stay healthy and vibrant',
        img: about2,
    },
    {
        title: 'AI Predictions',
        desc: 'Our neural networks analyze your plant data to predict future needs, helping you plan care with confidence',
        img: about3,
    },
]

export default function AboutSection() {
    return (
        <section id="about" className="py-20 w-full flex flex-col items-center gap-12 md:gap-24 lg:gap-32">
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-medium tracking-wide mb-1">About Us</span>
                    <div className="w-15 h-1 rounded bg-green-300 opacity-70" />
                </div>

                {features.map((f, i) => (
                    <AboutItem
                        key={f.title}
                        title={f.title}
                        desc={f.desc}
                        img={f.img}
                        reverse={i % 2 === 1} // парні міняємо місцями
                    />
                ))}
        </section>
    )
}
