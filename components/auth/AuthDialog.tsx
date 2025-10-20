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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { signIn } from "@/app/actions/auth/signIn";
import { signUp } from "@/app/actions/auth/signUp";

import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";


interface AuthDialogProps {
    open: boolean;
    mode: 'signin' | 'signup' | null;
    onModeChange: (mode: 'signin' | 'signup' | null) => void;
    onClose: () => void;
}

export default function AuthDialog({ open, mode, onModeChange, onClose }: AuthDialogProps) {
    if (!mode) return null;

    const isSignIn = mode === 'signin';


    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="p-0 border-none bg-transparent" showCloseButton={false}>
                <DialogTitle className="flex justify-center">{isSignIn ? 'Sign in' : 'Sign up'}</DialogTitle>

                <Card className="w-auto rounded-xl-card shadow-card">


                    <CardHeader>
                        <CardTitle>{isSignIn ? 'Login to your account' : 'Create an account'}</CardTitle>
                        <CardDescription>
                            {isSignIn
                                ? 'Enter your credentials to continue'
                                : 'Fill in the fields below to get started'}
                        </CardDescription>

                    </CardHeader>



                    <CardContent>
                        {isSignIn
                            ? <SignInForm onSuccess={onClose} />
                            : <SignUpForm onSuccess={onClose} />
                        }
                    </CardContent>



                    <CardFooter className="flex-col gap-3">
                        {/*<Button variant="outline" type="submit" className="w-full" size="lg">*/}
                        {/*    {isSignIn ? 'Login' : 'Create account'}*/}
                        {/*</Button>*/}
                        {isSignIn && (
                            <Button variant="outline" className="w-full flex items-center gap-2" size="lg">
                                {/* google-іконку можеш імпортувати як svg або з lucide-react */}
                                <svg className="w-5 h-5" /* ...google svg... */ />
                                Login with Google
                            </Button>
                        )}
                        <CardAction className="w-full flex justify-center mt-2">
                            <Button
                                variant="link"
                                type="button"
                                className="text-accent hover:underline text-sm"
                                onClick={() => onModeChange(isSignIn ? 'signup' : 'signin')}
                            >
                                {isSignIn ? 'Need an account? Sign Up' : 'Already have one? Sign In'}
                            </Button>
                        </CardAction>
                    </CardFooter>




                </Card>
            </DialogContent>
        </Dialog>
    );
}
