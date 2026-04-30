'use client';

import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import feedback from "@/public/feedback.png";
import { useState } from "react";
import Container from '@/components/layout/Container';
import { useTranslations } from 'next-intl';

export default function FeedbackSection() {
    const t = useTranslations('FeedbackSection');
    const [form, setForm] = useState({ name: "", email: "", message: "" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert(t('thankYou'));
        setForm({ name: "", email: "", message: "" });
    };

    return (
        <section id="feedback" className="bg-white py-16 px-4">
            <Container className="flex flex-col md:flex-row items-center justify-center gap-10">
            <div className="flex-1 flex items-center justify-center">
                <Image
                    src={feedback}
                    alt="Feedback illustration"
                    width={270}
                    height={200}
                    priority
                    draggable={false}
                    className="w-auto h-auto"
                />
            </div>
            <form onSubmit={handleSubmit} className="flex-1 max-w-xl flex flex-col gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-[#21261B] mb-2">{t('title')}</h2>
                <p className="text-[#21261B] opacity-80 mb-4">{t('subtitle')}</p>
                <div className="flex flex-col md:flex-row gap-4">
                    <Input
                        type="text"
                        name="name"
                        placeholder={t('namePlaceholder')}
                        value={form.name}
                        onChange={handleChange}
                        required
                        className="flex-1"
                    />
                    <Input
                        type="email"
                        name="email"
                        placeholder={t('emailPlaceholder')}
                        value={form.email}
                        onChange={handleChange}
                        required
                        className="flex-1"
                    />
                </div>
                <Textarea
                    name="message"
                    placeholder={t('messagePlaceholder')}
                    value={form.message}
                    onChange={handleChange}
                    required
                    className="min-h-[88px]"
                />
                <div className="flex justify-end">
                    <Button variant="outline" type="submit" className="px-7 py-2 mt-2">
                        {t('submit')}
                    </Button>
                </div>
            </form>
            </Container>
        </section>
    );
}
