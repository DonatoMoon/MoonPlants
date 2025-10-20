// app/layout.tsx
import "./globals.css";
import HeaderServer from "@/components/layout/HeaderServer";
import Footer from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ArrowUpToLine } from "lucide-react";
import AuthDialogController from '@/components/auth/AuthDialogController';
export const metadata = {
    title: "MoonPlants — Smart Plant Care",
    description: "plant monitoring and recommendations.",
};

export default function RootLayout(
    { children, }: { children: React.ReactNode; }
) {
    return (
        <html lang="en">
        <body className="flex flex-col min-h-screen">
        <HeaderServer />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />

        <ScrollToTop aria-label="Back to top"><ArrowUpToLine/></ScrollToTop>

        <AuthDialogController />

        </body>
        </html>
    );
}
