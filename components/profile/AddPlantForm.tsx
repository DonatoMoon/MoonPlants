// components/profile/AddPlantForm.tsx
'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPlant } from "@/app/actions/plants/addPlant";
import { getOccupiedChannels } from "@/app/actions/plants/getOccupiedChannels";
import SpeciesAutocomplete from "@/components/profile/SpeciesAutocomplete";
import { useEffect } from "react";

const schema = z.object({
    nickname: z.string().min(1, "Вкажіть свою назву"),
    species_name: z.string().min(1, "Виберіть реальну назву"),
    perenual_id: z.number().min(1, "Виберіть реальну назву"),
    image: z.any().optional(),
    deviceId: z.string().optional().nullable(),
    soilChannel: z.number().int().min(1).max(16).nullable().optional(),
    age_months: z
        .union([z.string(), z.number()])
        .refine(val => !val || !isNaN(Number(val)), "Некоректний вік"),
    pot_height_cm: z
        .union([z.string(), z.number()])
        .refine(val => !val || !isNaN(Number(val)), "Некоректна висота"),
    pot_diameter_cm: z
        .union([z.string(), z.number()])
        .refine(val => !val || !isNaN(Number(val)), "Некоректний діаметр"),
    last_watered_at: z.date().refine(val => !!val, { message: "Оберіть дату" }),
});

type FormValues = z.infer<typeof schema>;

export default function AddPlantForm({
                                         user_id,
                                         onSubmitPlant,
                                         devices = []
                                     }: {
    user_id: string;
    onSubmitPlant?: () => void;
    devices?: { id: string; display_name: string | null; channels_count: number; }[];
}) {
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            nickname: "",
            species_name: "",
            perenual_id: undefined,
            image: null,
            deviceId: null,
            soilChannel: null,
            age_months: "",
            pot_height_cm: "",
            pot_diameter_cm: "",
            last_watered_at: undefined,
        }
    });

    const [imgPreview, setImgPreview] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [occupiedChannels, setOccupiedChannels] = useState<number[]>([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);

    const selectedDeviceId = form.watch("deviceId");
    const selectedDevice = devices.find(d => d.id === selectedDeviceId);

    useEffect(() => {
        if (selectedDeviceId) {
            setIsLoadingChannels(true);
            getOccupiedChannels(selectedDeviceId).then(channels => {
                setOccupiedChannels(channels);
                setIsLoadingChannels(false);
                // Reset channel if it's now occupied
                const currentChannel = form.getValues("soilChannel");
                if (currentChannel && channels.includes(currentChannel)) {
                    form.setValue("soilChannel", null);
                }
            });
        } else {
            setOccupiedChannels([]);
        }
    }, [selectedDeviceId, form]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            form.setValue("image", e.target.files);
            setImgPreview(URL.createObjectURL(e.target.files[0]));
        }
    };

    const onSubmit = async (data: FormValues) => {
        startTransition(async () => {
            try {
                const image_file = data.image?.[0] ?? null;
                await addPlant({
                    user_id,
                    nickname: data.nickname,
                    species_name: data.species_name,
                    perenual_id: data.perenual_id,
                    image_file,
                    device_id: data.deviceId,
                    soil_channel: data.soilChannel,
                    age_months: data.age_months ? Number(data.age_months) : null,
                    pot_height_cm: data.pot_height_cm ? Number(data.pot_height_cm) : null,
                    pot_diameter_cm: data.pot_diameter_cm ? Number(data.pot_diameter_cm) : null,
                    last_watered_at: data.last_watered_at ?? null,
                });
                if (onSubmitPlant) onSubmitPlant();
                form.reset();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Не вдалося додати рослину";
                alert(msg);
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto">
                <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Назва для себе</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Мій улюблений кактус" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="species_name"
                    render={() => (
                        <FormItem>
                            <FormLabel>Реальна назва</FormLabel>
                            <FormControl>
                                <SpeciesAutocomplete
                                    value={form.watch("species_name")}
                                    onChange={(val) => {
                                        form.setValue("species_name", val.name);
                                        form.setValue("perenual_id", val.id);
                                    }}
                                    placeholder="Ficus lyrata"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* IoT Device Integration */}
                <div className="border border-white/10 p-4 rounded-lg bg-white/5 space-y-4">
                    <h3 className="text-sm font-semibold text-white/60">IoT Інтеграція (опційно)</h3>
                    
                    <FormField
                        control={form.control}
                        name="deviceId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Контролер</FormLabel>
                                <FormControl>
                                    <select 
                                        {...field} 
                                        value={field.value || ""} 
                                        onChange={(e) => field.onChange(e.target.value || null)}
                                        className="w-full bg-black border border-white/20 rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                                    >
                                        <option value="">Не підключати</option>
                                        {devices.map(d => (
                                            <option key={d.id} value={d.id}>
                                                {d.display_name || `Контролер ${d.id.slice(0, 8)}`}
                                            </option>
                                        ))}
                                    </select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {selectedDeviceId && (
                        <FormField
                            control={form.control}
                            name="soilChannel"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Виберіть канал сенсора (1-{selectedDevice?.channels_count || 4})</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {isLoadingChannels ? (
                                                <div className="text-xs text-white/40 animate-pulse">Перевірка каналів...</div>
                                            ) : (
                                                Array.from({ length: selectedDevice?.channels_count || 4 }, (_, i) => i + 1).map(ch => {
                                                    const isOccupied = occupiedChannels.includes(ch);
                                                    const isSelected = field.value === ch;
                                                    
                                                    return (
                                                        <button
                                                            key={ch}
                                                            type="button"
                                                            disabled={isOccupied}
                                                            onClick={() => field.onChange(ch)}
                                                            className={cn(
                                                                "w-10 h-10 rounded-md border flex items-center justify-center text-sm font-medium transition-all",
                                                                isOccupied 
                                                                    ? "bg-red-500/20 border-red-500/50 text-red-500/50 cursor-not-allowed opacity-50" 
                                                                    : isSelected
                                                                        ? "bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                                                        : "bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:border-white/40"
                                                            )}
                                                            title={isOccupied ? "Цей канал уже зайнятий іншою рослиною" : `Канал ${ch}`}
                                                        >
                                                            {ch}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="image"
                    render={() => (
                        <FormItem>
                            <FormLabel>Фото рослини</FormLabel>
                            <FormControl>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </FormControl>
                            {imgPreview && (
                                <div className="mt-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imgPreview} alt="Plant preview" className="rounded-lg w-32 h-32 object-cover" />
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="age_months"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Вік (місяців)</FormLabel>
                            <FormControl>
                                <Input type="number" min={0} placeholder="Напр. 12" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-4">
                    <FormField
                        control={form.control}
                        name="pot_height_cm"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Висота горщика (см)</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} placeholder="20" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="pot_diameter_cm"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Діаметр горщика (см)</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} placeholder="15" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="last_watered_at"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Останній полив</FormLabel>
                            <FormControl>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "dd.MM.yyyy") : <span>Оберіть дату</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    variant="outline"
                    type="submit"
                    className="w-full"
                    disabled={isPending}
                >
                    {isPending ? "Додаємо..." : "Додати рослину"}
                </Button>
            </form>
        </Form>
    );
}
