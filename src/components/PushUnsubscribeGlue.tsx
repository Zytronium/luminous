"use client";

// components/PushUnsubscribeGlue.tsx
//
// Client component that owns the push endpoint ref and wraps both
// AuthProvider and NotificationProvider. This avoids the circular-provider
// problem (AuthProvider needs to trigger a push unsubscribe, but the endpoint
// lives inside NotificationProvider which is nested inside AuthProvider) by
// keeping the ref here, above both, and passing callbacks down as props.

import { useRef, useCallback } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import TitleBar from "@/components/Titlebar";

export function PushUnsubscribeGlue({ children }: { children: React.ReactNode }) {
    const pushEndpointRef = useRef<string | null>(null);

    // Called by NotificationContext after SW subscription is established.
    const setPushEndpoint = useCallback((endpoint: string | null) => {
        pushEndpointRef.current = endpoint;
    }, []);

    const onBeforeSignOut = useCallback(async () => {
        const endpoint = pushEndpointRef.current;
        if (!endpoint) return;
        if ((window as any).electronAPI?.isElectron) return;

        try {
            const reg = await navigator.serviceWorker.getRegistration("/");
            if (reg) {
                const sub = await reg.pushManager.getSubscription();
                await sub?.unsubscribe();
            }

            const { createSupabaseClient } = await import("@/lib/supabase/client");
            const supabase = createSupabaseClient();
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) return;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/push/subscribe`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ endpoint }),
            });
        } catch (err) {
            console.warn("[PushUnsubscribeGlue] Unsubscribe failed:", err);
        }
    }, []);

    // Expose the endpoint setter so NotificationContext can write to it without
    // needing a separate context layer.
    if (typeof window !== "undefined") {
        (window as any).__luminous_setPushEndpoint = setPushEndpoint;
    }

    return (
        <AuthProvider onBeforeSignOut={onBeforeSignOut}>
            <NotificationProvider>
                <TitleBar />
                <div className="flex-1 flex flex-col h-screen w-screen overflow-auto">
                    {children}
                </div>
            </NotificationProvider>
        </AuthProvider>
    );
}
