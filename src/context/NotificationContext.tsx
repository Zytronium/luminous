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
    const settingsRef = useRef(settings);
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

    const parse_msg = useCallback(async (text: string): Promise<string> => {
        // Strip markdown by parsing to HTML and then extracting text
        // Or better, just strip potential markdown characters for simple plain text
        // Let's use marked to get HTML and then strip tags for a more robust "plain text"
        const matches = [...text.matchAll(/<@!([0-9a-f-]+)>/g)];
        if (matches.length) {
            await Promise.all(matches.map((m) => getDisplayName(m[1])));
        }

        const mentionReplaced = text.replace(/<@!([0-9a-f-]+)>/g, (_, userId) =>
            `@${profileCache.current.get(userId) ?? "Unknown"}`
        );

        // Simple markdown to plain text conversion:
        // 1. Remove bold, italic, strikethrough
        // 2. Remove code blocks
        // 3. Remove links but keep text
        let plainText = mentionReplaced
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/(\*|_)(.*?)\1/g, '$2')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1');

        return plainText;
    }, [getDisplayName]);

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
        settingsRef.current = settings;
    }, [settings]);

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
                if (settingsRef.current.notification_preference === "none")
                    return;

                // Skip if user notification preference is "mention" and message mentions this user
                if (
                    settingsRef.current.notification_preference === "mentions" &&
                    !record.content.includes(`<@!${user?.id}>`) &&
                    !record.content.includes("@everyone") // TODO: Ignore @everyone if sender doesn't have perms to ping @everyone
                ) return;

                const displayName = await getDisplayName(record.user_id);
                const title = `${displayName} (#${ch.name})`;
                const body = await parse_msg(record.content);

                if (isElectronRef.current) {
                    window.electronAPI?.notify(title, body, ch.id, record.id);
                }

                audioRef.current?.play().catch(() => {});
            });

            sub.subscribe();
            return sub;
        });

        return () => { subs.forEach((s) => supabase.removeChannel(s)); };
    }, [channels, token, user?.id, parse_msg]);

    return (
        <NotificationContext.Provider value={{ setActiveChannel }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
