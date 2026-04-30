// components/auth/AuthDialog.tsx
'use client';

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardAction,
    CardContent,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";

interface AuthDialogProps {
    open: boolean;
    mode: 'signin' | 'signup' | null;
    onModeChange: (mode: 'signin' | 'signup' | null) => void;
    onClose: () => void;
}

export default function AuthDialog({ open, mode, onModeChange, onClose }: AuthDialogProps) {
    const t = useTranslations('Auth');
    if (!mode) return null;

    const isSignIn = mode === 'signin';

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="p-0 border-none bg-transparent" showCloseButton={false}>
                <DialogTitle className="flex justify-center">
                    {isSignIn ? t('signInTitle') : t('signUpTitle')}
                </DialogTitle>

                <Card className="w-auto rounded-xl-card shadow-card">
                    <CardHeader>
                        <CardTitle>{isSignIn ? t('signInTitle') : t('signUpTitle')}</CardTitle>
                        <CardDescription>
                            {isSignIn ? t('signInDescription') : t('signUpDescription')}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {isSignIn
                            ? <SignInForm onSuccess={onClose} />
                            : <SignUpForm onSuccess={onClose} />
                        }
                    </CardContent>

                    <CardFooter className="flex-col gap-3">
                        {isSignIn && (
                            <Button variant="outline" className="w-full flex items-center gap-2" size="lg">
                                <svg className="w-5 h-5" />
                                {t('loginWithGoogle')}
                            </Button>
                        )}
                        <CardAction className="w-full flex justify-center mt-2">
                            <Button
                                variant="link"
                                type="button"
                                className="text-accent hover:underline text-sm"
                                onClick={() => onModeChange(isSignIn ? 'signup' : 'signin')}
                            >
                                {isSignIn ? t('switchToSignUp') : t('switchToSignIn')}
                            </Button>
                        </CardAction>
                    </CardFooter>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
