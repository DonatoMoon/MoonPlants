// components/layout/Header.tsx
// ----------------------------------
// залишаємо 'use client'!
'use client';

import {User, LogOut} from 'lucide-react';
import Container from './Container';
import Image from 'next/image';
import Link from 'next/link';
import logo from '@/public/logo.png';
import {Button} from '@/components/ui/button';
import {useAuthUI} from '@/lib/state/auth-ui';
import { signOut } from "@/app/actions/auth/signOut";

type HeaderProps = {
    user: { id: string; email?: string } | null;
};

const NavLink = ({href, children}: { href: string; children: React.ReactNode }) => (
    <Button asChild variant="link"><Link href={href}>{children}</Link></Button>
);

export default function Header({ user }: HeaderProps) {
    const open = useAuthUI(s => s.open);
    const isAuthed = !!user;

    return (
        <header className="bg-main">
            <Container>
                <div className="py-4 flex items-center text-main-text relative">
                    <div className="flex-1 flex items-center min-w-0">
                        <Link href="/" className="flex items-center gap-2 min-w-0">
                            <Image src={logo} alt="MoonPlants logo" width={50} height={50} draggable={false}/>
                            <span className="font-bold text-lg text-main-text truncate hidden sm:inline">MoonPlants</span>
                        </Link>
                    </div>
                    <nav className="absolute left-1/2 -translate-x-1/2 z-10 hidden md:flex">
                        <NavLink href="#about">About Us</NavLink>
                        <NavLink href="#faq">FAQ</NavLink>
                        <NavLink href="#feedback">Feedback</NavLink>
                    </nav>
                    <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
                        {isAuthed ? (
                            <>
                                <Button asChild variant="default" className="text-main-text hover:text-accent gap-1">
                                    <Link href="/profile"><User className="w-5 h-5"/>PROFILE</Link>
                                </Button>
                                <form action={signOut}>
                                    <Button
                                        variant="default"
                                        className="text-main-text hover:text-accent gap-1"
                                        type="submit"
                                    >
                                        <LogOut className="w-5 h-5"/>
                                        SIGN OUT
                                    </Button>
                                </form>


                            </>
                        ) : (
                            <>
                                <Button variant="default" onClick={() => open('signin')}>SIGN IN</Button>
                                <Button variant="default" onClick={() => open('signup')}>SIGN UP</Button>
                            </>
                        )}
                    </div>
                </div>
            </Container>
        </header>
    );
}
