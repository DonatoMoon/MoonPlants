'use client';

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type Plant = {
    id: string;
    name: string;
    image_url?: string | null;
    last_watered_at?: string | null;
};

type PlantMoisture = {
    soil_moisture: number;
    measured_at: string;
};

export default function PlantItem({
                                      plant,
                                      lastMoisture,
                                  }: {
    plant: Plant;
    lastMoisture?: PlantMoisture;
}) {
    return (
        <div className="bg-white/10 rounded-2xl p-4 flex flex-col items-center shadow w-full max-w-xs">
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
                    <span className="font-semibold">{lastMoisture.soil_moisture}%</span>
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
