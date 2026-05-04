import React from 'react';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
    // URL для вбудовування вашої Grafana Cloud
    const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_EMBED_URL;

    return (
        <div className="w-full flex-1 flex flex-col space-y-4 p-8 min-h-[calc(100vh-4rem)]">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
                <p className="text-muted-foreground mt-2">
                    Real-time AI ML predictions metrics and API system health.
                    Powered by Grafana Cloud & Prometheus.
                </p>
            </div>

            {/* Embedded Grafana Dashboard */}
            <div className="w-full flex-1 flex flex-col">
                {grafanaUrl ? (
                    <div className="flex flex-col space-y-4 h-full">
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-center justify-between">
                            <div className="text-sm">
                                <span className="font-semibold">Note:</span> If the dashboard below does not load (due to Grafana Cloud security policies), please open it directly.
                            </div>
                            <a
                                href={grafanaUrl.replace('?theme=dark&kiosk=1', '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap ml-4"
                            >
                                Open Grafana Dashboard &rarr;
                            </a>
                        </div>
                        <div className="w-full border rounded-xl overflow-hidden shadow-sm bg-card flex-1 min-h-[800px]">
                            <iframe
                                src={grafanaUrl}
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                title="Grafana Metrics Dashboard"
                                className="w-full h-full block"
                            ></iframe>
                        </div>
                    </div>
                ) : (
                    <div className="w-full border rounded-xl overflow-hidden shadow-sm bg-card flex-1 min-h-[800px] flex items-center justify-center">
                        <div className="text-center p-8 max-w-md">
                        <h3 className="text-lg font-semibold mb-2">Grafana Cloud is not configured</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            To view metrics, set up a free Grafana Cloud account, configure it to scrape your Railway ML API endpoint, and add the dashboard URL to your environment variables.
                        </p>
                        <code className="bg-muted p-2 rounded text-xs break-all">
                            NEXT_PUBLIC_GRAFANA_EMBED_URL="https://your-org.grafana.net/d/..."
                        </code>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


