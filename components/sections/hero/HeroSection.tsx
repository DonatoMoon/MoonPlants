// components/sections/hero/HeroSection.tsx
import Image from 'next/image';
import heroImg from '@/public/hero.png';
import AuthCta from "@/components/auth/AuthCta"


export default function HeroSection({ user }: { user: { id: string } | null }) {
    return (
        <section className="py-12 px-0">
                <div className="flex flex-col md:flex-row items-center justify-between gap-10 md:gap-0">
                    {/* Лівий текст */}
                    <div className="flex-1 max-w-xl">
                        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">MoonPlants</h1>
                        <p className="text-lg mb-8">
                            Welcome to MoonPlants, your ultimate companion for effortless plant care.
                            Monitor soil moisture, temperature, and light levels in real-time, and let our AI-powered system
                            guide you with tailored watering recommendations. Keep your plants thriving with ease!
                        </p>
                        <AuthCta user={user} />
                    </div>

                    {/* Контейнер-картинка+фон: зникає на мобільних */}
                    <div className="relative flex-shrink-0 hidden md:flex items-center">
                        {/* Картинка, яка виходить за межі блоку */}
                        <div className="relative z-20 flex items-center justify-center">
                            <Image
                                src={heroImg}
                                alt="Plant in pot"
                                width={380}
                                height={380}
                                draggable={false}
                            />
                        </div>
                        {/* Розмитий блок-підкладка */}
                        <div className="absolute z-10 right-0 bottom-0 bg-white/10 backdrop-blur-md rounded-[56px] w-[220px] h-[270px] md:w-[260px] md:h-[340px] shadow-xl" />
                    </div>
                </div>
        </section>
    );
}
