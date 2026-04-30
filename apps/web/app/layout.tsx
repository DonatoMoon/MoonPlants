// app/layout.tsx
import "./globals.css";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import HeaderServer from "@/components/layout/HeaderServer";
import Footer from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ArrowUpToLine } from "lucide-react";
import AuthDialogController from "@/components/auth/AuthDialogController";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Geist({
    subsets: ["latin", "cyrillic"],
    variable: "--font-geist-sans",
    display: "swap",
});

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
    display: "swap",
});

const fontDisplay = Fraunces({
    subsets: ["latin"],
    variable: "--font-fraunces",
    display: "swap",
});

export const metadata = {
    title: "MoonPlants — Розумний догляд за рослинами",
    description: "Моніторинг та рекомендації для ваших рослин.",
};

export default async function RootLayout(
    { children }: { children: React.ReactNode }
) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html
            lang={locale}
            className={`dark ${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
        >
        <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
            <HeaderServer />
            <main id="main" className="flex-1 flex flex-col">{children}</main>
            <Footer />
            <ScrollToTop aria-label="Нагору"><ArrowUpToLine /></ScrollToTop>
            <AuthDialogController />
            <Toaster richColors position="bottom-right" />
        </NextIntlClientProvider>
        </body>
        </html>
    );
}
