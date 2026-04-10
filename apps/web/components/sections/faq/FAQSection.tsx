import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
    {
        q: "How does MoonPlants work?",
        a: "MoonPlants uses sensors to collect real-time data on your plants’ environment. This data is sent to our platform, where AI analyzes it to provide personalized care recommendations."
    },
    {
        q: "What types of plants can I monitor?",
        a: "You can monitor a wide variety of houseplants and garden plants. MoonPlants supports any plant that can use a sensor device for tracking environmental conditions."
    },
    {
        q: "Do I need technical skills to use MoonPlants?",
        a: "No, MoonPlants is designed for everyone. The setup is simple, and our platform guides you through every step."
    },
    {
        q: "How accurate are the predictions?",
        a: "Our AI-powered predictions are highly accurate, but results may vary depending on plant type, sensor placement, and data quality."
    }
];

export default function FAQSection() {
    return (
        <section id="faq" className="min-h-[700px] py-16 px-4 flex flex-col items-center">
            <div className="flex flex-col items-center mb-8">
                <span className="text-white text-3xl font-bold mb-1">FAQ</span>
                <div className="w-10 h-1 rounded bg-green-300 opacity-70 mb-4"/>
                <p className="text-white text-center text-base opacity-80 max-w-lg">
                    Got questions? We`ve got answers. Learn more about how MoonPlants works and how it can transform
                    your plant care routine.
                </p>
            </div>
            <Accordion type="single" collapsible className="w-full max-w-xl flex flex-col gap-4 mt-4">
                {faqs.map((faq) => (
                    <AccordionItem key={faq.q} value={faq.q } className="border-0">
                        <AccordionTrigger
                            className=" rounded-2xl border border-white/50 bg-white/10 px-6 text-left text-base font-medium data-[state=open]:bg-white/20 data-[state=open]:rounded-2xl transition">
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
