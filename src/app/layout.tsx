import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import TitleBar from "@/components/Titlebar";

export const metadata: Metadata = {
  title: "Luminous - The chat app for Atlas School",
  description: "Exclusive chat app for students and graduates of Atlas School",
};

// Runs before React hydrates — reads the localStorage settings cache written
// by AuthContext so the correct theme and reduce-motion state are applied
// before the first paint, eliminating any flash of the wrong theme.
const themeScript = `
(function () {
  try {
    var cached = localStorage.getItem('luminous_settings');
    if (cached) {
      var s = JSON.parse(cached);
      if (s.reduce_animations) document.documentElement.classList.add('reduce-motion');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var dark = s.theme === 'dark' || (s.theme === 'system' && prefersDark) || (!s.theme && prefersDark);
      if (dark) document.documentElement.classList.add('dark');
      return;
    }
  } catch (_) {}
  // No cache yet (first visit / logged out) — fall back to OS preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased flex flex-col h-screen w-screen overflow-hidden">
        <AuthProvider>
          <TitleBar />
          <div className="flex-1 flex flex-col h-screen w-screen overflow-auto">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
