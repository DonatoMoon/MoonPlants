// components/profile/AddPlantForm.tsx
'use client';

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useTransition, useCallback } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Image as ImageIcon, Upload, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPlant } from "@/app/actions/plants/addPlant";
import { getOccupiedChannels } from "@/app/actions/plants/getOccupiedChannels";
import SpeciesAutocomplete from "@/components/profile/SpeciesAutocomplete";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Shared label style — matches ClaimDeviceForm
const labelStyle: React.CSSProperties = {
    color: "#6B7280",
    fontSize: "0.75rem",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
};

// Shared input style
const inputStyle: React.CSSProperties = {
    background: "#F5F7F4",
    border: "1px solid #C8D1C6",
    color: "#1B2316",
};

type FormValues = {
    nickname: string;
    species_name: string;
    perenual_id: number;
    image?: FileList;
    deviceId?: string | null;
    soilChannel?: number | null;
    age_months: string | number;
    pot_height_cm: string | number;
    pot_diameter_cm: string | number;
    last_watered_at: Date;
};

export default function AddPlantForm({
    user_id,
    onSubmitPlant,
    devices = []
}: {
    user_id: string;
    onSubmitPlant?: () => void;
    devices?: { id: string; display_name: string | null; channels_count: number; }[];
}) {
    const t = useTranslations('AddPlantForm');

    const schema = useMemo(() => z.object({
        nickname: z.string().min(1, t('nicknameError')),
        species_name: z.string().min(1, t('speciesError')),
        perenual_id: z.number().min(1, t('speciesError')),
        image: z.custom<FileList>((v) => typeof FileList === 'undefined' || v instanceof FileList || v === null || v === undefined).optional(),
        deviceId: z.string().optional().nullable(),
        soilChannel: z.number().int().min(1).max(16).nullable().optional(),
        age_months: z.union([z.string(), z.number()]).refine(val => !val || !isNaN(Number(val)), t('ageError')),
        pot_height_cm: z.union([z.string(), z.number()]).refine(val => !val || !isNaN(Number(val)), t('potError')),
        pot_diameter_cm: z.union([z.string(), z.number()]).refine(val => !val || !isNaN(Number(val)), t('potError')),
        last_watered_at: z.date().refine(val => !!val, { message: t('dateError') }),
    }), [t]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            nickname: "",
            species_name: "",
            perenual_id: undefined,
            image: undefined,
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
    const [isLoadingChannels, startChannelFetch] = useTransition();

    const selectedDeviceId = form.watch("deviceId");
    const selectedDevice = devices.find(d => d.id === selectedDeviceId);

    const handleDeviceChange = useCallback((deviceId: string | null) => {
        form.setValue("deviceId", deviceId);
        form.setValue("soilChannel", null);
        if (deviceId) {
            startChannelFetch(async () => {
                const channels = await getOccupiedChannels(deviceId);
                setOccupiedChannels(channels);
            });
        } else {
            setOccupiedChannels([]);
        }
    }, [form]);

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
                const msg = e instanceof Error ? e.message : t('submitError');
                toast.error(msg);
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full mx-auto">

                {/* Nickname */}
                <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel style={labelStyle}>{t('nicknameLabel')}</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Мій улюблений кактус" style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Species */}
                <FormField
                    control={form.control}
                    name="species_name"
                    render={() => (
                        <FormItem>
                            <FormLabel style={labelStyle}>{t('speciesLabel')}</FormLabel>
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

                {/* IoT section */}
                <div
                    className="rounded-xl py-4 px-4 space-y-4"
                    style={{ background: "#F5F7F4", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                    <p style={{ color: "var(--accent)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {t('iotSection')}
                    </p>

                    <FormField
                        control={form.control}
                        name="deviceId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel style={labelStyle}>{t('deviceLabel')}</FormLabel>
                                <FormControl>
                                    <Select
                                        value={field.value ?? "__none__"}
                                        onValueChange={(v) => handleDeviceChange(v === "__none__" ? null : v)}
                                    >
                                        <SelectTrigger
                                            className="w-full h-10 text-sm"
                                            style={{ background: "#fff", border: "1px solid #C8D1C6", color: field.value && field.value !== "__none__" ? "#1B2316" : "#9CA3AF", borderRadius: 8 }}
                                        >
                                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                                            <SelectValue placeholder={t('noDevice')} />
                                        </SelectTrigger>
                                        <SelectContent
                                            className="rounded-xl border-0 p-1.5"
                                            style={{
                                                background: "#fff",
                                                boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)",
                                                borderRadius: 12,
                                            }}
                                        >
                                            <SelectItem
                                                value="__none__"
                                                className="rounded-lg text-sm cursor-pointer"
                                                style={{ color: "#9CA3AF" }}
                                            >
                                                {t('noDevice')}
                                            </SelectItem>
                                            {devices.map(d => (
                                                <SelectItem
                                                    key={d.id}
                                                    value={d.id}
                                                    className="rounded-lg text-sm cursor-pointer"
                                                    style={{ color: "#1B2316" }}
                                                >
                                                    {d.display_name || `Контролер ${d.id.slice(0, 8)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                    <FormLabel style={labelStyle}>{t('channelLabel', { count: selectedDevice?.channels_count || 4 })}</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {isLoadingChannels ? (
                                                <span className="text-xs animate-pulse" style={{ color: "#9CA3AF" }}>{t('checkingChannels')}</span>
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
                                                                    ? "cursor-not-allowed"
                                                                    : "cursor-pointer"
                                                            )}
                                                            style={
                                                                isOccupied
                                                                    ? { background: "#FEF2F2", border: "1px solid #FECACA", color: "#FCA5A5" }
                                                                    : isSelected
                                                                        ? { background: "var(--accent)", border: "1px solid var(--accent)", color: "#fff", boxShadow: "0 2px 8px rgba(73,107,52,0.3)" }
                                                                        : { background: "#fff", border: "1px solid #C8D1C6", color: "#4B5563" }
                                                            }
                                                            title={isOccupied ? t('channelOccupied') : t('channel', { ch })}
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

                {/* Image upload */}
                <FormField
                    control={form.control}
                    name="image"
                    render={() => (
                        <FormItem>
                            <FormLabel style={labelStyle}>{t('imageLabel')}</FormLabel>
                            <FormControl>
                                <div
                                    onClick={() => document.getElementById('plant-image-upload')?.click()}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-6 text-center transition-all"
                                    style={{ borderColor: "#C8D1C6", background: "#F5F7F4" }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(73,107,52,0.5)")}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#C8D1C6")}
                                >
                                    <input
                                        id="plant-image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                    {imgPreview ? (
                                        <div className="flex flex-col items-center gap-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={imgPreview} alt="Preview" className="h-28 w-28 rounded-lg object-cover" style={{ boxShadow: "0 0 0 2px var(--accent)" }} />
                                            <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                                                <Upload className="h-3.5 w-3.5" /> Змінити фото
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#fff", border: "1px solid #C8D1C6", color: "#9CA3AF" }}>
                                                <ImageIcon className="h-5 w-5" />
                                            </div>
                                            <span className="text-sm font-medium" style={{ color: "#374151" }}>Натисніть для завантаження</span>
                                            <span className="text-xs" style={{ color: "#9CA3AF" }}>PNG, JPG або GIF (max. 5MB)</span>
                                        </div>
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Age */}
                <FormField
                    control={form.control}
                    name="age_months"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel style={labelStyle}>{t('ageLabel')}</FormLabel>
                            <FormControl>
                                <Input type="number" min={0} placeholder={t('agePlaceholder')} {...field} style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Pot dimensions */}
                <div className="flex gap-3">
                    <FormField
                        control={form.control}
                        name="pot_height_cm"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel style={labelStyle}>{t('potHeightLabel')}</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} placeholder="20" {...field} style={inputStyle} />
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
                                <FormLabel style={labelStyle}>{t('potDiameterLabel')}</FormLabel>
                                <FormControl>
                                    <Input type="number" min={0} placeholder="15" {...field} style={inputStyle} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Last watered */}
                <FormField
                    control={form.control}
                    name="last_watered_at"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel style={labelStyle}>{t('lastWateredLabel')}</FormLabel>
                            <FormControl>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                            style={{ ...inputStyle, fontWeight: 400 }}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" style={{ color: "#9CA3AF" }} />
                                            {field.value ? format(field.value, "dd.MM.yyyy") : <span style={{ color: "#9CA3AF" }}>{t('pickDate')}</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" style={{ background: "#fff", border: "1px solid #C8D1C6", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", borderRadius: 12 }}>
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
    );
}
