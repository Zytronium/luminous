"use client";

import {createSupabaseClient} from "@/lib/supabase/client";
import {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import {useAuth} from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type Channel = { id: string; name: string };

type InsertBroadcastPayload = {
    payload: { record: { id: string; user_id: string; content: string; created_at: string } };
};

const supabase = createSupabaseClient();

type NotificationContextValue = {
    setActiveChannel: (id: string | null) => void;
};

const NotificationContext = createContext<NotificationContextValue>({
    setActiveChannel: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { token, user, settings, loading } = useAuth();
    const [channels, setChannels] = useState<Channel[]>([]);

    const activeChannelRef = useRef<string | null>(null);
    const windowFocusedRef = useRef<boolean>(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isElectronRef = useRef<boolean>(false);
    const profileCache = useRef<Map<string, string>>(new Map());
    const router = useRouter();


    const setActiveChannel = useCallback((id: string | null) => {
        activeChannelRef.current = id;
    }, []);

    const getDisplayName = useCallback(async (userId: string): Promise<string> => {
        if (profileCache.current.has(userId))
            return profileCache.current.get(userId)!;
        const { data } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", userId)
            .single();
        const name = data?.display_name ?? "Unknown";
        profileCache.current.set(userId, name);
        return name;
    }, []);

    useEffect(() => {
        audioRef.current = new Audio("/audio/ping.ogg");
        isElectronRef.current = !!window.electronAPI?.isElectron;
    }, []);

    // Register the click handler on mount
    useEffect(() => {
        if (!window.electronAPI?.isElectron) return;
        window.electronAPI.onNotificationClick((channelId, messageId) => {
            router.push(`/chat?channel=${channelId}&message=${messageId}`);
        });
    }, [router]);

    useEffect(() => {
        const onFocus = () => { windowFocusedRef.current = true; };
        const onBlur = () => { windowFocusedRef.current = false; };
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);

        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    useEffect(() => {
        if (loading || !token) return;

        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/channels`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => { if (!r.ok) return null; return r.json(); })
            .then((data) => { if (Array.isArray(data)) setChannels(data); });
    }, [token, loading]);

    useEffect(() => {
        if (!token || !Array.isArray(channels) || channels.length === 0)
            return;

        const subs = channels.map((ch) => {
            const sub = supabase.channel(`channel:${ch.id}:messages`, {
                config: { private: true },
            });

            sub.on("broadcast", { event: "INSERT" }, async ({ payload }: InsertBroadcastPayload) => {
                const record = payload.record;
                // Skip if this user sent the message
                if (record.user_id === user?.id)
                    return;

                // Skip if the user is looking at this channel with the window in focus
                if (windowFocusedRef.current && activeChannelRef.current === ch.id)
                    return;

                // Skip depending on notification preferences and context of message

                // Skip if user notification preference is "none"
                if (settings.notification_preference === "none")
                    return;

                // Skip if user notification preference is "mention" // todo: implement mentions/pings, then only skip if this message does not mention the user
                if (settings.notification_preference === "mentions")
                    return;

                const displayName = await getDisplayName(record.user_id);
                const title = `${displayName} (#${ch.name})`;

                if (isElectronRef.current) {
                    window.electronAPI?.notify(title, record.content, ch.id, record.id);
                }

                audioRef.current?.play().catch(() => {});
            });

            sub.subscribe();
            return sub;
        });

        return () => { subs.forEach((s) => supabase.removeChannel(s)); };
    }, [channels, token, user?.id]);

    return (
        <NotificationContext.Provider value={{ setActiveChannel }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
