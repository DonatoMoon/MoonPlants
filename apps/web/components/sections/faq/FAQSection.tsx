import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getTranslations } from 'next-intl/server';

export default async function FAQSection() {
    const t = await getTranslations('FaqSection');

    const faqs = [
        { q: t('q1'), a: t('a1') },
        { q: t('q2'), a: t('a2') },
        { q: t('q3'), a: t('a3') },
        { q: t('q4'), a: t('a4') },
    ];

    return (
        <section id="faq" className="min-h-[700px] py-16 px-4 flex flex-col items-center">
            <div className="flex flex-col items-center mb-8">
                <span className="text-white text-3xl font-bold mb-1">{t('title')}</span>
                <div className="w-10 h-1 rounded bg-green-300 opacity-70 mb-4"/>
                <p className="text-white text-center text-base opacity-80 max-w-lg">
                    {t('subtitle')}
                </p>
            </div>
            <Accordion type="single" collapsible className="w-full max-w-xl flex flex-col gap-4 mt-4">
                {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-0">
                        <AccordionTrigger
                            className="rounded-2xl border border-white/50 bg-white/10 px-6 text-left text-base font-medium data-[state=open]:bg-white/20 data-[state=open]:rounded-2xl transition">
                            {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="px-6 py-2 text-white/90 text-sm bg-transparent">
                            {faq.a}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>
    );
}
