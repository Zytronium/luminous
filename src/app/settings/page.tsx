"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserSettings } from "@/context/AuthContext";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Monitor, Sun, Moon, LogOut, ChevronLeft, Check } from "lucide-react";

type Theme = UserSettings["theme"];
type NotificationPreference = "none" | "mentions" | "all";

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light",  label: "Light",  icon: <Sun     size={15} /> },
  { value: "system", label: "System", icon: <Monitor size={15} /> },
  { value: "dark",   label: "Dark",   icon: <Moon    size={15} /> },
];

const NOTIFICATION_OPTIONS: { value: NotificationPreference; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mentions", label: "Mentions only" },
  { value: "all", label: "All messages" }
];

const supabase = createSupabaseClient();

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

function applyReduceAnimations(reduce: boolean) {
  document.documentElement.classList.toggle("reduce-motion", reduce);
}

export default function SettingsPage() {
  const { user, settings: ctxSettings, settingsLoading, cacheSettings, clearAuth } = useAuth();
  const router = useRouter();

  // Local copy so changes feel instant before the DB round-trip completes
  const [settings, setSettings] = useState<UserSettings>(ctxSettings);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

  const [minimizeToTray, setMinimizeToTray] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("minimizeToTray");
    return stored === null ? true : stored === "true"; // default on
  });

  // Sync to main process on mount and whenever the value changes
  useEffect(() => {
    if (!isElectron) return;
    (window as any).electronAPI.setMinimizeToTray(minimizeToTray);
  }, [minimizeToTray]);

  function changeMinimizeToTray(value: boolean) {
    localStorage.setItem("minimizeToTray", String(value));
    setMinimizeToTray(value);
  }

  // Sync local copy when context finishes loading (e.g. on first mount)
  useEffect(() => {
    if (!settingsLoading) setSettings(ctxSettings);
  // We only want to sync once — when the initial load resolves.
  // After that, local state is the source of truth until the page unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

  // Auto-save with 600 ms debounce

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (settingsLoading) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");

    saveTimer.current = setTimeout(async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: user.id, ...settings },
          { onConflict: "user_id" }
        );

      if (error) {
        setSaveStatus("error");
      } else {
        cacheSettings(settings);           // ← update context + localStorage
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Change handlers
  function changeTheme(theme: Theme) {
    applyTheme(theme);                     // instant DOM update
    setSettings((s) => ({ ...s, theme }));
  }

  function changeReduceAnimations(reduce: boolean) {
    applyReduceAnimations(reduce);         // instant DOM update
    setSettings((s) => ({ ...s, reduce_animations: reduce }));
  }

  function changeNotificationPreference(pref: NotificationPreference) {
    setSettings((s) => ({ ...s, notification_preference: pref }));
  }

  // Log out
  const handleLogout = async () => {
    setLoggingOut(true);
    clearAuth();                           // clears session + localStorage cache
    router.replace("/auth");
  };

  // Render
  return (
    <div className="min-h-screen w-full bg-beige dark:bg-darker-blue flex flex-col items-center px-4 py-8">

      {/* Header */}
      <div className="w-full max-w-lg mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-darker-blue/10 dark:hover:bg-offwhite/10 transition-colors"
        >
          <ChevronLeft size={20} className="text-teal" />
        </button>

        <h1 className="text-2xl font-bold text-darker-blue dark:text-offwhite flex-1">
          Settings
        </h1>

        {/* Save status */}
        <div className={`flex items-center gap-1.5 text-xs font-semibold transition-all duration-300 ${
          saveStatus === "idle"   ? "opacity-0"             :
          saveStatus === "saving" ? "opacity-60 text-teal"  :
          saveStatus === "saved"  ? "opacity-100 text-teal" :
                                    "opacity-100 text-red"
        }`}>
          {saveStatus === "saved" && <Check size={12} />}
          {saveStatus === "saving" ? "Saving…"      :
           saveStatus === "saved"  ? "Saved"         :
           saveStatus === "error"  ? "Error saving"  : ""}
        </div>
      </div>

      {/* User info chip */}
      {user?.displayName && (
        <div className="w-full max-w-lg mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-darker-blue/5 dark:bg-offwhite/5 border-2 border-darker-blue/10 dark:border-offwhite/10">
            <div className="w-9 h-9 rounded-full bg-blue flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-neon-teal">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-darker-blue dark:text-offwhite truncate">
                {user.displayName}
              </span>
              <span className="text-xs text-darker-blue/50 dark:text-offwhite/50">Signed in</span>
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <Section label="Appearance">

        <SettingRow
          title="Theme"
          description="Choose how the app looks on your device."
          loading={settingsLoading}
        >
          <div className="flex rounded-2xl bg-darker-blue/10 dark:bg-offwhite/10 p-1 gap-1 mt-3">
            {THEME_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => changeTheme(value)}
                disabled={settingsLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  settings.theme === value
                    ? "bg-teal text-darker-blue shadow-sm"
                    : "text-darker-blue/60 dark:text-offwhite/60 hover:text-darker-blue dark:hover:text-offwhite"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          title="Reduce Animations"
          description="Minimize motion effects throughout the app."
          loading={settingsLoading}
        >
          <Toggle
            checked={settings.reduce_animations}
            onChange={changeReduceAnimations}
            disabled={settingsLoading}
          />
        </SettingRow>

      </Section>

      <Section label="Notifications">
        <SettingRow
            title="Default global notification preference"
            description="Change which messages notify you by default."
            loading={settingsLoading}
        >
          <div className="flex rounded-2xl bg-darker-blue/10 dark:bg-offwhite/10 p-1 gap-1 mt-3">
          {NOTIFICATION_OPTIONS.map(({ value, label }) => (
              <button
                  key={value}
                  onClick={() => changeNotificationPreference(value)}
                  disabled={settingsLoading}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      settings.notification_preference === value
                          ? "bg-teal text-darker-blue shadow-sm"
                          : "text-darker-blue/60 dark:text-offwhite/60 hover:text-darker-blue dark:hover:text-offwhite"
                  }`}
              >
                {label}
              </button>
          ))}
          </div>
        </SettingRow>
      </Section>

      {/* App - Electron only */}
      {isElectron && (
          <Section label="App">
            <SettingRow
                title="Minimize to Tray on Close"
                description="Keep Luminous running in the background when you close the window so you can receive notifications."
            >
              <Toggle
                  checked={minimizeToTray}
                  onChange={changeMinimizeToTray}
              />
            </SettingRow>

            <SettingRow
              title="Give Luminous a mind of its own for 10 seconds"
              description="Press the button for a surprise!"
              >
              <button className="button btn-primary rounded-4xl cursor-pointer mt-3" onClick={() => (window as any).electronAPI.becomeSentient()}>
                Enable Luminous Sentience
              </button>
            </SettingRow>
          </Section>
      )}

      {/* Account */}
      <Section label="Account">
        <SettingRow
          title="Log Out"
          description="Sign out of your account on this device."
        >
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold bg-red text-offwhite hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={16} />
            {loggingOut ? "Signing out…" : "Log Out"}
          </button>
        </SettingRow>
      </Section>

      {/* Add new <Section> blocks here as more settings are introduced */}

    </div>
  );
}

// Reusable layout components

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-darker-blue/50 dark:text-offwhite/50 mb-2 pl-1">
        {label}
      </p>
      <div className="rounded-3xl border-2 border-darker-blue/10 dark:border-offwhite/10 overflow-hidden divide-y-2 divide-darker-blue/10 dark:divide-offwhite/10">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  loading,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`px-5 py-4 bg-beige dark:bg-dark-blue transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
      <p className="text-sm font-semibold text-darker-blue dark:text-offwhite">{title}</p>
      {description && (
        <p className="text-xs text-darker-blue/50 dark:text-offwhite/50 mt-0.5">{description}</p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`mt-3 relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "bg-teal border-teal"
          : "bg-darker-blue/15 dark:bg-offwhite/15 border-darker-blue/20 dark:border-offwhite/20"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-offwhite shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
