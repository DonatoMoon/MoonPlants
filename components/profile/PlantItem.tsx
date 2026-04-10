'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Unplug } from "lucide-react";

type Plant = {
    id: string;
    name: string;
    image_url?: string | null;
    last_watered_at?: string | null;
    device_id?: string | null;
    soil_channel?: number | null;
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

    return (
        <div className="bg-white/10 rounded-2xl p-4 flex flex-col items-center shadow w-full max-w-xs relative overflow-hidden">
            {isDisconnected ? (
                <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10 animate-pulse">
                    <Unplug size={10} />
                    Disconnected
                </div>
            ) : (
                <div className="absolute top-2 right-2 bg-blue-500/80 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                    Channel: {plant.soil_channel}
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
            <div className="mt-2">
                <Button
                    asChild
                    variant="default"
                    className="hover:bg-accent hover:text-white"
                >
                    <Link href={`/profile/${plant.id}`}>View Details</Link>
                </Button>
            </div>
        </div>
    );
}
