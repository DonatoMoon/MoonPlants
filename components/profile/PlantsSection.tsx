'use client';

import { useState } from 'react';
import AddPlantModal from "@/components/profile/AddPlantModal";
import PlantItem from '@/components/profile/PlantItem';
import { Button } from '@/components/ui/button';

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

type PlantsSectionProps = {
    plants: Plant[];
    user_id: string;
    plantMoistureMap: Record<string, PlantMoisture | undefined>;
};

export default function PlantsSection({
                                          plants,
                                          user_id,
                                          plantMoistureMap,
                                      }: PlantsSectionProps) {
    const [open, setOpen] = useState(false);

    if (plants.length === 0) {
        return (
            <>
                <div className="text-center py-10">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        Add your first plant
                    </Button>
                </div>
                <AddPlantModal open={open} onOpenChange={setOpen} user_id={user_id} />
            </>
        );
    }

    return (
        <section className="w-full">
            <h1 className="text-3xl font-bold mb-8 text-center">Your Plants</h1>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 w-full">
                {plants.map(plant => (
                    <PlantItem
                        key={plant.id}
                        plant={plant}
                        lastMoisture={plantMoistureMap[plant.id]}
                    />
                ))}
            </div>
            <div className="text-center py-10">
                <Button variant="outline" onClick={() => setOpen(true)}>
                    Add new plant
                </Button>
            </div>
            <AddPlantModal open={open} onOpenChange={setOpen} user_id={user_id} />
        </section>
    );
}
