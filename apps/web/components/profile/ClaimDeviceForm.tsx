// components/profile/ClaimDeviceForm.tsx
'use client';

import { useMemo, useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { claimDevice } from "@/app/actions/iot/claimDevice";
import { toast } from "sonner";
import { QrCode, X, ScanLine } from "lucide-react";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

type FormValues = {
    deviceId: string;
    claimCode: string;
};

export default function ClaimDeviceForm({
    user_id,
    onSuccess,
}: {
    user_id: string;
    onSuccess?: () => void;
}) {
    const t = useTranslations('ClaimDevice');
    const [isPending, startTransition] = useTransition();
    const [scannerOpen, setScannerOpen] = useState(false);
    const scannerRef = useRef<Html5QrcodeType | null>(null);

    const schema = useMemo(() => z.object({
        deviceId: z.string().trim().regex(
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
            t('deviceIdError')
        ),
        claimCode: z.string().trim().min(16, t('claimCodeError')),
    }), [t]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { deviceId: "", claimCode: "" },
    });

    const haltScanner = async () => {
        const s = scannerRef.current;
        if (!s) return;
        scannerRef.current = null;
        try { await s.stop(); s.clear(); } catch { /* already stopped */ }
    };

    useEffect(() => {
        if (!scannerOpen) return;

        let alive = true;

        (async () => {
            const { Html5Qrcode } = await import("html5-qrcode");
            if (!alive || !document.getElementById("qr-scanner-container")) return;

            const scanner = new Html5Qrcode("qr-scanner-container");
            scannerRef.current = scanner;

            try {
                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 200, height: 200 } },
                    async (text) => {
                        if (!alive) return;
                        try {
                            const parsed = JSON.parse(text) as { u?: string; c?: string };
                            if (parsed.u && parsed.c) {
                                form.setValue("deviceId", parsed.u, { shouldValidate: true });
                                form.setValue("claimCode", parsed.c, { shouldValidate: true });
                                alive = false;
                                await haltScanner();
                                setScannerOpen(false);
                                toast.success(t('scanSuccess'));
                            }
                        } catch { /* non-JSON QR */ }
                    },
                    () => { /* frame errors are expected */ }
                );
            } catch (err) {
                if (alive) {
                    toast.error("Camera error", { description: String(err) });
                    setScannerOpen(false);
                }
            }
        })();

        return () => { alive = false; haltScanner(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scannerOpen]);

    useEffect(() => () => { haltScanner(); }, []);

    const onSubmit = async (data: FormValues) => {
        startTransition(async () => {
            const res = await claimDevice(user_id, data.deviceId, data.claimCode);
            if (res.success) {
                toast.success(t('successTitle'), { description: t('successDesc') });
                if (onSuccess) onSuccess();
                form.reset();
            } else {
                toast.error(t('errorTitle'), { description: res.error || t('errorDesc') });
            }
        });
    };

    return (
        <>
            <style>{`
                @keyframes scan-line {
                    0%   { top: 12%; opacity: 0.7; }
                    50%  { opacity: 1; }
                    100% { top: 82%; opacity: 0.7; }
                }
                .scan-line-anim {
                    animation: scan-line 2s ease-in-out infinite alternate;
                }
            `}</style>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                    {/* ── QR scan CTA — mobile only ──────────────────────────── */}
                    {!scannerOpen && (
                        <button
                            type="button"
                            onClick={() => setScannerOpen(true)}
                            className="md:hidden w-full flex items-center justify-center gap-2.5 rounded-xl py-3 transition-all active:scale-[0.98]"
                            style={{
                                border: "1.5px dashed rgba(73,107,52,0.55)",
                                background: "var(--accent-soft)",
                                color: "var(--accent)",
                            }}
                        >
                            <QrCode className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('scanQr')}</span>
                        </button>
                    )}

                    {/* ── Scanner viewport ───────────────────────────────────── */}
                    {scannerOpen && (
                        <div className="relative rounded-2xl overflow-hidden" style={{ background: "#000" }}>
                            {/* html5-qrcode mounts here */}
                            <div id="qr-scanner-container" className="w-full" />

                            {/* Animated scan line */}
                            <div
                                className="scan-line-anim pointer-events-none absolute left-[10%] right-[10%] h-px"
                                style={{
                                    background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
                                    boxShadow: "0 0 8px 2px rgba(73,107,52,0.6)",
                                    top: "12%",
                                }}
                            />

                            {/* Close button */}
                            <button
                                type="button"
                                onClick={async () => { await haltScanner(); setScannerOpen(false); }}
                                className="absolute top-2.5 right-2.5 flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm transition-opacity hover:opacity-80"
                                style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* Hint */}
                            <div
                                className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 py-2 text-xs"
                                style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)" }}
                            >
                                <ScanLine className="w-3 h-3" />
                                {t('scanHint')}
                            </div>
                        </div>
                    )}

                    {/* ── Or divider — mobile only, when scanner is closed ───── */}
                    {!scannerOpen && (
                        <div className="md:hidden flex items-center gap-3">
                            <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.09)" }} />
                            <span className="text-xs" style={{ color: "#9CA3AF" }}>{t('orManual')}</span>
                            <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.09)" }} />
                        </div>
                    )}

                    {/* ── Fields ─────────────────────────────────────────────── */}
                    <FormField
                        control={form.control}
                        name="deviceId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel style={{ color: "#6B7280", fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                    {t('deviceIdLabel')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                        className="font-mono text-sm"
                                        style={{ background: "#F5F7F4", border: "1px solid #C8D1C6", color: "#1B2316" }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="claimCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel style={{ color: "#6B7280", fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                                    {t('claimCodeLabel')}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        type="password"
                                        placeholder={t('claimCodePlaceholder')}
                                        style={{ background: "#F5F7F4", border: "1px solid #C8D1C6", color: "#1B2316" }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full py-6 font-semibold transition-all"
                        style={{
                            background: "var(--accent)",
                            border: "1px solid rgba(73,107,52,0.4)",
                            color: "#fff",
                            boxShadow: "0 4px 16px rgba(73,107,52,0.25)",
                        }}
                        disabled={isPending}
                    >
                        {isPending ? t('submitting') : t('submit')}
                    </Button>
                </form>
            </Form>
        </>
    );
}
