// components/auth/AuthDialogController.tsx
'use client';

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AuthDialog from '@/components/auth/AuthDialog';
import { useAuthUI } from '@/lib/state/auth-ui';

export default function AuthDialogController() {
    const { mode, open, close } = useAuthUI();
    const pathname = usePathname();

    // Головна магія — закриваємо модалку на зміну роуту:
    useEffect(() => {
        if (mode) close();
        // eslint-disable-next-line
    }, [pathname]);

    return (
        <AuthDialog
            open={!!mode}
            mode={mode}
            onModeChange={(m) => m && open(m)}
            onClose={close}
        />
    );
}
