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
import { addPlant } from "@/app/actions/plants/addPlant"; // імпортуй свою action
import SpeciesAutocomplete from "@/components/profile/SpeciesAutocomplete";

// Валідація через zod
const schema = z.object({
    nickname: z.string().min(1, "Вкажіть свою назву"),
    species_name: z.string().min(1, "Виберіть реальну назву"),
    species_id: z.number().min(1, "Виберіть реальну назву"),
    image: z.any().optional(),
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
                                         onSubmitPlant
                                     }: {
    user_id: string;
    onSubmitPlant?: () => void;
}) {
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            nickname: "",
            species_name: "",
            species_id: undefined,
            image: null,
            age_months: "",
            pot_height_cm: "",
            pot_diameter_cm: "",
            last_watered_at: undefined,
        }
    });

    const [imgPreview, setImgPreview] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Для preview
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
                    species_id: data.species_id,
                    image_file,
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
                {/* Ваше ім'я рослини */}
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

                {/* Реальна назва */}
                <FormField
                    control={form.control}
                    name="species_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Реальна назва</FormLabel>
                            <FormControl>

                                <SpeciesAutocomplete
                                    value={form.watch("species_name")}
                                    onChange={(val) => {
                                        // val: { name: string, id: number }
                                        form.setValue("species_name", val.name);
                                        form.setValue("species_id", val.id);
                                    }}
                                    placeholder="Ficus lyrata"
                                />

                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Фото */}
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
                                    <img src={imgPreview} alt="Plant preview" className="rounded-lg w-32 h-32 object-cover" />
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Вік */}
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

                {/* Висота та діаметр горщика */}
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

                {/* Дата останнього поливу */}
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
