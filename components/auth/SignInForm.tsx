// components/auth/SignInForm.tsx
'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import * as z from "zod";
import { useState } from "react";
import { signIn } from "@/app/actions/auth/signIn";

const schema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
    const [error, setError] = useState<string | null>(null);
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        mode: "onTouched",
        defaultValues: {
            email: "",
            password: "",
        }
    });

    const onSubmit = async (data: FormValues) => {
        setError(null);
        try {
            const fd = new FormData();
            fd.append("email", data.email);
            fd.append("password", data.password);
            await signIn(fd);
            if (onSuccess) onSuccess();
        } catch (e: any) {
            setError(e.message || "Login failed");
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
                            <FormLabel>Email</FormLabel>
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
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input {...field} type="password" autoComplete="current-password" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {error && <div className="text-destructive text-sm mt-1">{error}</div>}

                <Button variant="outline" type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Logging in..." : "Login"}
                </Button>
            </form>
        </Form>
    );
}
