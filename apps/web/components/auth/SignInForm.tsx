// components/auth/SignInForm.tsx
'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useMemo, useState } from "react";
import { signIn } from "@/app/actions/auth/signIn";
import { useTranslations } from 'next-intl';

export default function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
    const t = useTranslations('Auth');
    const [error, setError] = useState<string | null>(null);

    const schema = useMemo(() => z.object({
        email: z.string().email(t('emailError')),
        password: z.string().min(8, t('passwordError')),
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
            await signIn(fd);
            if (onSuccess) onSuccess();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('loginFailed');
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
                                <Input {...field} type="password" autoComplete="current-password" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {error && <div className="text-destructive text-sm mt-1">{error}</div>}

                <Button variant="outline" type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? t('loggingIn') : t('login')}
                </Button>
            </form>
        </Form>
    );
}
