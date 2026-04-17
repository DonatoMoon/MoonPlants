'use client';

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Unplug, Droplet, Lightbulb, Loader2 } from "lucide-react";

type Plant = {
    id: string;
    name: string;
    image_url?: string | null;
    last_watered_at?: string | null;
    device_id?: string | null;
    soil_channel?: number | null;
    devices?: { display_name?: string | null } | null;
};

type PlantMoisture = {
    soil_moisture_pct: number;
    measured_at: string;
};

export default function PlantItem({
                                      plant,
                                      lastMoisture,
                                  }: {
    plant: Plant;
    lastMoisture?: PlantMoisture;
}) {
    const isDisconnected = !plant.device_id;
    const deviceName = plant.devices?.display_name || "Unknown device";

    const [waterMl, setWaterMl] = useState(50);
    const [lightSec, setLightSec] = useState(60);
    const [loadingWater, setLoadingWater] = useState(false);
    const [loadingLight, setLoadingLight] = useState(false);

    const handleWater = async () => {
        if (!plant.id) return;
        setLoadingWater(true);
        try {
            const res = await fetch(`/api/v1/plants/${plant.id}/actions/water-now`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ waterMl }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to water'}`);
            } else {
                alert("Water command queued!");
            }
        } catch (e) {
            alert("Error: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoadingWater(false);
        }
    };

    const handleLight = async () => {
        if (!plant.device_id) return;
        setLoadingLight(true);
        try {
            const res = await fetch(`/api/v1/devices/${plant.device_id}/actions/light`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "on_for", durationSec: lightSec }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed to light'}`);
            } else {
                alert("Light command queued!");
            }
        } catch (e) {
            alert("Error: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoadingLight(false);
        }
    };

    return (
        <div className="bg-white/10 rounded-2xl p-4 flex flex-col items-center shadow w-full max-w-xs relative overflow-hidden">
            {isDisconnected ? (
                <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10 animate-pulse">
                    <Unplug size={10} />
                    Disconnected
                </div>
            ) : (
                <div className="absolute top-2 right-2 bg-blue-500/80 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                    {deviceName} | Ch: {plant.soil_channel}
                </div>
            )}
            
            {plant.image_url && (
                <Image
                    src={plant.image_url}
                    alt={plant.name}
                    width={120}
                    height={120}
                    className="rounded-xl object-cover mb-3"
                    draggable={false}
                />
            )}
            <h2 className="text-xl font-bold mb-1">{plant.name}</h2>
            {/* Last soil moisture */}
            <div className="text-white/80 text-sm mb-1">
                Soil moisture:{" "}
                {lastMoisture ? (
                    <span className="font-semibold">{lastMoisture.soil_moisture_pct}%</span>
                ) : (
                    "--"
                )}
            </div>
            {/* Last watering date */}
            <div className="text-white/60 text-xs mb-2">
                Last watering:{" "}
                {plant.last_watered_at
                    ? format(new Date(plant.last_watered_at), "dd.MM.yyyy")
                    : "--"}
            </div>
            
            {/* Action buttons */}
            {!isDisconnected && (
                <div className="flex flex-col gap-2 w-full mt-2 mb-2 bg-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Input 
                            type="number" 
                            value={waterMl} 
                            onChange={e => setWaterMl(Number(e.target.value))}
                            className="h-8 w-16 bg-white/10 border-0 text-white focus-visible:ring-1 focus-visible:ring-white/30"
                            min={1}
                        />
                        <span className="text-xs text-white/70">ml</span>
                        <Button 
                            onClick={handleWater} 
                            disabled={loadingWater}
                            size="sm" 
                            variant="ghost" 
                            className="flex-1 h-8 bg-white/10 hover:bg-white/20 text-white border-0"
                        >
                            {loadingWater ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Droplet className="w-4 h-4 mr-1 text-blue-400" /> Water</>}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input 
                            type="number" 
                            value={lightSec} 
                            onChange={e => setLightSec(Number(e.target.value))}
                            className="h-8 w-16 bg-white/10 border-0 text-white focus-visible:ring-1 focus-visible:ring-white/30"
                            min={1}
                        />
                        <span className="text-xs text-white/70">sec</span>
                        <Button 
                            onClick={handleLight} 
                            disabled={loadingLight}
                            size="sm" 
                            variant="ghost" 
                            className="flex-1 h-8 bg-white/10 hover:bg-white/20 text-white border-0"
                        >
                            {loadingLight ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lightbulb className="w-4 h-4 mr-1 text-yellow-400" /> Light</>}
                        </Button>
                    </div>
                </div>
            )}

            <div className="mt-2 w-full">
                <Button
                    asChild
                    variant="default"
                    className="w-full bg-primary/20 hover:bg-primary/40 text-white backdrop-blur-sm border border-white/10"
                >
                    <Link href={`/profile/${plant.id}`}>View Details</Link>
                </Button>
            </div>
        </div>
    );
}
