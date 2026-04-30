// components/auth/SignUpForm.tsx
'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useMemo, useState } from "react";
import { signUp } from "@/app/actions/auth/signUp";
import { useTranslations } from 'next-intl';

export default function SignUpForm({ onSuccess }: { onSuccess?: () => void }) {
    const t = useTranslations('Auth');
    const [error, setError] = useState<string | null>(null);

    const schema = useMemo(() => z.object({
        email: z.string().email(t('emailError')),
        password: z.string()
            .min(8, t('passwordError'))
            .regex(/^[A-Za-z0-9!@#$%^&*()_+=-]+$/, t('passwordInvalidChars')),
    }), [t]);

    type FormValues = z.infer<typeof schema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        mode: "onTouched",
        defaultValues: { email: "", password: "" },
    });

    const onSubmit = async (data: FormValues) => {
        setError(null);
        try {
            const fd = new FormData();
            fd.append("email", data.email);
            fd.append("password", data.password);
            await signUp(fd);
            if (onSuccess) onSuccess();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('registrationFailed');
            setError(msg);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('email')}</FormLabel>
                            <FormControl>
                                <Input {...field} type="email" autoComplete="email" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('password')}</FormLabel>
                            <FormControl>
                                <Input {...field} type="password" autoComplete="new-password" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {error && <div className="text-destructive text-sm mt-1">{error}</div>}

                <Button variant="outline" type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? t('registering') : t('register')}
                </Button>
            </form>
        </Form>
    );
}
