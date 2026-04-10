// components/profile/ClaimDeviceForm.tsx
'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { claimDevice } from "@/app/actions/iot/claimDevice";
import { toast } from "sonner";

const schema = z.object({
    deviceId: z.string().trim().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Некоректний формат UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"),
    claimCode: z.string().trim().min(16, "Код має бути мінімум 16 символів"),
});

type FormValues = z.infer<typeof schema>;

export default function ClaimDeviceForm({
    user_id,
    onSuccess
}: {
    user_id: string;
    onSuccess?: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            deviceId: "",
            claimCode: "",
        }
    });

    const onSubmit = async (data: FormValues) => {
        startTransition(async () => {
            const res = await claimDevice(user_id, data.deviceId, data.claimCode);
            if (res.success) {
                toast.success("Успішно", { description: "Пристрій підключено" });
                if (onSuccess) onSuccess();
                form.reset();
            } else {
                toast.error("Помилка", { description: res.error || "Не вдалося підключити пристрій" });
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="deviceId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>ID Пристрою (UUID)</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
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
                            <FormLabel>Код підключення (Claim Code)</FormLabel>
                            <FormControl>
                                <Input {...field} type="password" placeholder="Введіть код із наклейки" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Підключаємо..." : "Підключити пристрій"}
                </Button>
            </form>
        </Form>
    );
}
