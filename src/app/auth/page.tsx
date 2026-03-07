"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";
type Status = { type: "error" | "success"; message: string } | null;

const supabase = createSupabaseClient();

export default function AuthPage() {
  const { setAuth } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupDisplay, setSignupDisplay] = useState("");
  const [signupSecondary, setSignupSecondary] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", message: data.error });
      } else {
        // Give the session to the client-side Supabase instance so it
        // persists in localStorage and onAuthStateChange fires correctly
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setAuth(data.user, data.session);
        setStatus({ type: "success", message: "Signed in! Redirecting..." });
        router.push("/chat");
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (signupPassword !== signupConfirm) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          displayName: signupDisplay,
          secondaryEmail: showSecondary ? signupSecondary : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", message: data.error });
      } else {
        setStatus({ type: "success", message: data.message });
      }
    } catch {
      setStatus({ type: "error", message: "Something went wrong. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginEmail) {
      alert("Please enter your email address first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: "https://luminous-chat.vercel.app/reset-password",
    });

    if (error) {
      console.error(error);
      alert("Failed to send email.");
    } else {
      alert("Check your email for a password reset link.");
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
            Luminous
          </h1>
          <p className="text-sm text-darker-blue/60 dark:text-offwhite/60 text-center">
            Lumi-approved chat for Atlas students and alumni
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-2xl overflow-hidden border-2 border-teal">
          <button
            onClick={() => { setMode("login"); setStatus(null); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              mode === "login"
                ? "bg-teal text-darker-blue"
                : "bg-transparent text-teal hover:bg-teal/10"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setStatus(null); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              mode === "signup"
                ? "bg-teal text-darker-blue"
                : "bg-transparent text-teal hover:bg-teal/10"
            }`}
          >
            Create Account
          </button>
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

        {/* Login Form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field label="Atlas Email" type="email" placeholder="you@atlasstudents.com"
              value={loginEmail} onChange={setLoginEmail} required />
            <Field label="Password" type="password" placeholder="••••••••"
              value={loginPassword} onChange={setLoginPassword} required />
            <SubmitButton loading={loading} label="Sign In" />
            <p className="text-center text-xs text-darker-blue/50 dark:text-offwhite/50">
              Forgot your password?{" "}
              <span
                  className="text-teal cursor-pointer hover:underline"
                  onClick={handleResetPassword}
              >
                Reset it
              </span>
            </p>
          </form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <Field label="Display Name" type="text" placeholder="Your name"
              value={signupDisplay} onChange={setSignupDisplay} required />
            <Field label="Atlas Email" type="email" placeholder="you@atlasstudents.com"
              value={signupEmail} onChange={setSignupEmail} required
              hint="Must be an @atlasstudents.com address" />
            <Field label="Password" type="password" placeholder="At least 8 characters"
              value={signupPassword} onChange={setSignupPassword} required />
            <Field label="Confirm Password" type="password" placeholder="••••••••"
              value={signupConfirm} onChange={setSignupConfirm} required />

            {/* Secondary email toggle */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setShowSecondary(!showSecondary); setSignupSecondary(""); }}
                className="text-sm text-teal hover:underline text-left"
              >
                {showSecondary ? "− Remove backup email" : "+ Add a backup email (optional)"}
              </button>
              {showSecondary && (
                <Field label="Backup Email" type="email" placeholder="you@example.com"
                  value={signupSecondary} onChange={setSignupSecondary}
                  hint="Used if your Atlas email ever becomes inaccessible. Will be verified separately." />
              )}
            </div>

            <SubmitButton loading={loading} label="Create Account" />
            <p className="text-center text-xs text-darker-blue/50 dark:text-offwhite/50">
              You&apos;ll receive a verification email at your Atlas address.
            </p>
          </form>
        )}
      </div>

      <Link href="/" className="mt-6 text-sm text-teal hover:underline">
        ← Back to home
      </Link>
    </div>
  );
}

// --- Reusable field component ---
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
