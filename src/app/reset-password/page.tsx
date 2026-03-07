"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

type Status = { type: "error" | "success"; message: string } | null;

const supabase = createSupabaseClient();

export default function ResetPasswordPage() {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [status, setStatus] = useState<Status>(null);
    const [loading, setLoading] = useState(false);
    const [validSession, setValidSession] = useState<boolean | null>(null);

    // Supabase appends the recovery token as a hash fragment.
    // Calling getSession() after the redirect will exchange it automatically.
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setValidSession(!!data.session);
        });

        // Also listen in case the session resolves slightly after mount
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                setValidSession(!!session);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        if (password !== confirm) {
            setStatus({ type: "error", message: "Passwords do not match." });
            return;
        }
        if (password.length < 8) {
            setStatus({ type: "error", message: "Password must be at least 8 characters." });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
                setStatus({ type: "error", message: error.message });
            } else {
                setStatus({ type: "success", message: "Password updated. Redirecting to sign in..." });
                await supabase.auth.signOut();
                setTimeout(() => router.push("/auth"), 2000);
            }
        } catch {
            setStatus({ type: "error", message: "Something went wrong. Try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center mt-[10vh] pb-[10vh] h-screen w-full">
            {/* Card */}
            <div
                className="
                w-full max-w-md mx-4
                bg-offwhite dark:bg-dark-blue
                border-4 border-darker-blue dark:border-beige
                rounded-[2.5rem]
                p-8 flex flex-col gap-6
                shadow-[8px_8px_0px_0px] shadow-darker-blue dark:shadow-beige
            "
            >
                {/* Logo + Title */}
                <div className="flex flex-col items-center gap-2">
                    <Image src="/logo.png" alt="Luminous logo" width={56} height={56} className="rounded-full" />
                    <h1 className="text-3xl font-bold tracking-tight text-darker-blue dark:text-offwhite">
                        Reset Password
                    </h1>
                    <p className="text-sm text-darker-blue/60 dark:text-offwhite/60 text-center">
                        Choose a new password for your Luminous account
                    </p>
                </div>

                {/* Status banner */}
                {status && (
                    <div className={`rounded-2xl px-4 py-3 text-sm font-medium text-center ${
                        status.type === "error"
                            ? "bg-red/10 text-red border-2 border-red"
                            : "bg-teal/10 text-teal border-2 border-teal"
                    }`}>
                        {status.message}
                    </div>
                )}

                {/* Invalid / expired link state */}
                {validSession === false && (
                    <div className="flex flex-col gap-3 text-center">
                        <p className="text-sm text-darker-blue/70 dark:text-offwhite/70">
                            This reset link is invalid or has expired.
                        </p>
                        <Link
                            href="/auth"
                            className="w-full py-3 rounded-2xl font-bold bg-teal text-darker-blue hover:brightness-110 active:scale-95 transition-all text-center"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                )}

                {/* Reset form — only shown when session is valid */}
                {validSession === true && (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Field
                            label="New Password"
                            type="password"
                            placeholder="At least 8 characters"
                            value={password}
                            onChange={setPassword}
                            required
                        />
                        <Field
                            label="Confirm Password"
                            type="password"
                            placeholder="••••••••"
                            value={confirm}
                            onChange={setConfirm}
                            required
                        />
                        <SubmitButton loading={loading} label="Update Password" />
                    </form>
                )}

                {/* Loading state while session check is in flight */}
                {validSession === null && (
                    <p className="text-center text-sm text-darker-blue/50 dark:text-offwhite/50">
                        Verifying link...
                    </p>
                )}
            </div>

            <Link href="/" className="mt-6 text-sm text-teal hover:underline">
                ← Back to home
            </Link>
        </div>
    );
}

// --- Reusable field component (mirrored from auth/page.tsx) ---
function Field({ label, type, placeholder, value, onChange, required, hint }: {
    label: string; type: string; placeholder: string; value: string;
    onChange: (v: string) => void; required?: boolean; hint?: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-darker-blue/70 dark:text-offwhite/70">
                {label}
            </label>
            <input
                type={type} placeholder={placeholder} value={value}
                onChange={(e) => onChange(e.target.value)} required={required}
                className="w-full px-4 py-2.5 rounded-2xl bg-beige dark:bg-darker-blue border-2 border-darker-blue/20 dark:border-offwhite/20 focus:border-teal focus:outline-none text-darker-blue dark:text-offwhite placeholder:text-darker-blue/30 dark:placeholder:text-offwhite/30 transition-colors"
            />
            {hint && <p className="text-xs text-darker-blue/40 dark:text-offwhite/40 pl-1">{hint}</p>}
        </div>
    );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
    return (
        <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl font-bold bg-teal text-darker-blue hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1">
            {loading ? "Please wait..." : label}
        </button>
    );
}
