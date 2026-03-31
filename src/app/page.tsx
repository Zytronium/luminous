"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase/client";

type Status = "loading" | "offline";

const RETRY_INTERVAL = 10;

function isElectron() {
    return typeof window !== "undefined" &&
        !!(window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron;
}

function BgGlow() {
    return (
        <div
            className="animate-glow pointer-events-none"
            style={{
                position: "fixed", top: "42%", left: "50%",
                width: 560, height: 560, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(30,210,175,0.18) 0%, transparent 70%)",
                transform: "translate(-50%, -50%)", zIndex: 0,
            }}
        />
    );
}

function LoadingScreen() {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden">
            <BgGlow />
            <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <svg
                        style={{ position: "absolute", inset: 0, animation: "spin 1.2s linear infinite" }}
                        width={80} height={80} viewBox="0 0 80 80"
                    >
                        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(30,210,175,0.15)" strokeWidth="3" />
                        <circle cx="40" cy="40" r="36" fill="none" stroke="#1ED2AF" strokeWidth="3"
                                strokeLinecap="round" strokeDasharray="60 165" />
                    </svg>
                    <Image src="/logo.png" alt="Luminous" width={52} height={52}
                           style={{ borderRadius: "50%", position: "relative", zIndex: 1 }} />
                </div>
                <p style={{ color: "rgba(254,249,230,0.45)", fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Loading…
                </p>
            </div>
        </div>
    );
}

function OfflineScreen({ onRetry, countdown }: { onRetry: () => void; countdown: number }) {
    const circumference = 2 * Math.PI * 20;
    const progress = ((RETRY_INTERVAL - countdown) / RETRY_INTERVAL) * circumference;

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden">
            <BgGlow />
            <div
                className="relative z-10 flex flex-col items-center w-full max-w-sm mx-4 px-10 py-12 text-center"
                style={{
                    background: "rgba(0, 0, 60, 0.72)",
                    border: "2px solid rgba(254, 249, 230, 0.12)",
                    borderRadius: "3rem",
                    backdropFilter: "blur(24px)",
                    boxShadow: "0 8px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(254,249,230,0.08)",
                }}
            >
                <Image src="/logo.png" alt="Luminous" width={52} height={52}
                       style={{ borderRadius: "50%", marginBottom: "1.5rem", opacity: 0.6 }} />
                <h2 style={{ color: "rgba(254,249,230,0.9)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                    No connection
                </h2>
                <p style={{ color: "rgba(254,249,230,0.45)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "2rem" }}>
                    Couldn&apos;t reach Luminous. Check your internet connection.
                </p>
                <div className="relative flex items-center justify-center"
                     style={{ width: 64, height: 64, marginBottom: "1rem", cursor: "pointer" }}
                     onClick={onRetry} title="Retry now"
                >
                    <svg width={64} height={64} viewBox="0 0 64 64"
                         style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                        <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(30,210,175,0.15)" strokeWidth="3.5" />
                        <circle cx="32" cy="32" r="20" fill="none" stroke="#1ED2AF" strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeDasharray={`${progress} ${circumference}`}
                                style={{ transition: "stroke-dasharray 0.9s linear" }} />
                    </svg>
                    <span style={{ color: "#1ED2AF", fontSize: "1.1rem", fontWeight: 700, position: "relative", zIndex: 1 }}>
            {countdown}
          </span>
                </div>
                <p style={{ color: "rgba(254,249,230,0.3)", fontSize: "0.75rem", letterSpacing: "0.04em" }}>
                    Retrying in {countdown}s. Click to retry now.
                </p>
            </div>
        </div>
    );
}

export default function RootPage() {
    const router   = useRouter();
    const electron = isElectron();
    const [status,    setStatus]    = useState<Status>("loading");
    const [countdown, setCountdown] = useState(RETRY_INTERVAL);
    const retryTimer        = useRef<ReturnType<typeof setTimeout>  | null>(null);
    const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    // prevent the auth listener from redirecting while an offline check is in flight
    const checkingOnline    = useRef(false);

    const clearTimers = () => {
        if (retryTimer.current)        clearTimeout(retryTimer.current);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
    };

    const startRetryLoop = () => {
        setStatus("offline");
        setCountdown(RETRY_INTERVAL);
        countdownInterval.current = setInterval(() =>
            setCountdown(p => {
                if (p <= 1) { clearInterval(countdownInterval.current!); return 0; }
                return p - 1;
            }), 1_000);
        retryTimer.current = setTimeout(() => {
            clearInterval(countdownInterval.current!);
            checkAuth();
        }, RETRY_INTERVAL * 1_000);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const checkAuth = async () => {
        setStatus("loading");
        checkingOnline.current = true;

        if (electron) {
            const online = await (
                (window as Window & { electronAPI?: { checkOnline?: () => Promise<boolean> } })
                    .electronAPI?.checkOnline?.() ?? Promise.resolve(true)
            );
            if (!online) {
                // leave checkingOnline=true so the auth listener stays blocked
                // while the offline screen is up (avoids a stale localStorage redirect)
                startRetryLoop();
                return;
            }
        }

        const supabase = createSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession()
            .catch(() => ({ data: { session: null } }));

        checkingOnline.current = false;

        if (!session) {
            router.replace("/lander");
            return;
        }

        router.replace("/chat");
    };

    useEffect(() => {
        checkAuth();
        return clearTimers;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const supabase = createSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            if (checkingOnline.current) return;
            if (session) router.replace("/chat");
        });
        return () => subscription.unsubscribe();
    }, [router]);

    if (status === "offline" && electron) {
        return (
            <>
                <Styles />
                <OfflineScreen onRetry={() => { clearTimers(); checkAuth(); }} countdown={countdown} />
            </>
        );
    }

    return <><Styles /><LoadingScreen /></>;
}

function Styles() {
    return (
        <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes glow-drift {
        0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
        50%       { opacity: 0.5;  transform: translate(-50%, -50%) scale(1.1); }
      }
      .animate-glow { animation: glow-drift 6s ease-in-out infinite; }
    `}</style>
    );
}
