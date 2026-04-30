// app/admin/devices/generate/page.tsx
'use client';

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Printer, RefreshCw, Cpu } from "lucide-react";
import { toast } from "sonner";

type DeviceLabel = {
    uuid: string;
    claimCode: string;
};

function randomClaimCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => chars[b % chars.length])
        .join("");
}

function generateNewDevice(): DeviceLabel {
    return { uuid: crypto.randomUUID(), claimCode: randomClaimCode() };
}

export default function GenerateDevicePage() {
    const [device, setDevice] = useState<DeviceLabel>(() => generateNewDevice());
    const qrValue = JSON.stringify({ u: device.uuid, c: device.claimCode });

    const copy = (text: string, label: string) =>
        navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .label-to-print, .label-to-print * { visibility: visible; }
                    .label-to-print {
                        position: absolute;
                        top: 0; left: 0;
                        width: 40mm; height: 30mm;
                        padding: 2mm;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 1mm;
                        background: white;
                    }
                    .label-to-print svg { width: 22mm; height: 22mm; }
                    .label-to-print .label-uuid {
                        font-size: 5pt;
                        font-family: monospace;
                        word-break: break-all;
                        text-align: center;
                        color: #000;
                        line-height: 1.2;
                    }
                }
            `}</style>

            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: "var(--bg)" }}>

                {/* Header */}
                <div className="flex items-center gap-3 mb-10">
                    <div className="p-2 rounded-xl" style={{ background: "var(--accent-soft)", border: "1px solid var(--glass-border)" }}>
                        <Cpu className="w-5 h-5" style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold leading-none" style={{ color: "var(--fg)", fontFamily: "var(--font-fraunces, serif)" }}>
                            Device Label Generator
                        </h1>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>Admin — MoonPlants</p>
                    </div>
                </div>

                {/* Card */}
                <div
                    className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
                    style={{
                        background: "var(--glass-bg-strong)",
                        border: "1px solid var(--glass-border)",
                        backdropFilter: "blur(var(--glass-blur))",
                        boxShadow: "var(--glass-shadow)",
                    }}
                >
                    {/* Printable label preview */}
                    <div className="flex justify-center">
                        <div
                            className="label-to-print flex flex-col items-center gap-2 rounded-xl p-3"
                            style={{
                                background: "#fff",
                                width: 150,
                                boxShadow: "var(--shadow-md)",
                            }}
                        >
                            <QRCodeSVG value={qrValue} size={100} bgColor="#ffffff" fgColor="#1B2316" />
                            <p className="label-uuid text-[8px] font-mono text-center break-all leading-tight" style={{ color: "#1B2316" }}>
                                {device.uuid}
                            </p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: "var(--glass-border)" }} />

                    {/* Device ID */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--fg-subtle)" }}>Device ID</p>
                        <div className="flex items-center gap-2">
                            <code
                                className="flex-1 text-xs px-3 py-2 rounded-lg break-all leading-relaxed"
                                style={{ background: "var(--bg-elev-2)", color: "var(--fg)", border: "1px solid var(--glass-border)" }}
                            >
                                {device.uuid}
                            </code>
                            <button
                                onClick={() => copy(device.uuid, "Device ID")}
                                className="shrink-0 p-2 rounded-lg transition-colors"
                                style={{ background: "var(--bg-elev-2)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
                                title="Copy Device ID"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Claim Code */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--fg-subtle)" }}>Claim Code</p>
                        <div className="flex items-center gap-2">
                            <code
                                className="flex-1 text-base font-bold px-3 py-2 rounded-lg tracking-[0.25em] text-center"
                                style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(73,107,52,0.35)" }}
                            >
                                {device.claimCode}
                            </code>
                            <button
                                onClick={() => copy(device.claimCode, "Claim Code")}
                                className="shrink-0 p-2 rounded-lg transition-colors"
                                style={{ background: "var(--bg-elev-2)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
                                title="Copy Claim Code"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* QR Payload */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--fg-subtle)" }}>QR Payload</p>
                        <code
                            className="block text-xs px-3 py-2 rounded-lg break-all leading-relaxed"
                            style={{ background: "var(--bg-elev-1)", color: "var(--fg-muted)", border: "1px solid var(--glass-border)" }}
                        >
                            {qrValue}
                        </code>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => setDevice(generateNewDevice())}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                        style={{ background: "var(--bg-elev-2)", border: "1px solid var(--glass-border)", color: "var(--fg-muted)" }}
                    >
                        <RefreshCw className="w-4 h-4" />
                        New Device
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                        style={{ background: "var(--accent)", border: "1px solid rgba(73,107,52,0.4)", color: "#fff" }}
                    >
                        <Printer className="w-4 h-4" />
                        Print Label
                    </button>
                </div>
            </div>
        </>
    );
}
