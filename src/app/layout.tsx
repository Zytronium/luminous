import type { Metadata } from "next";
import "./globals.css";
import { PushUnsubscribeGlue } from "@/components/PushUnsubscribeGlue";

export const metadata: Metadata = {
  title: "Luminous - The chat app for Atlas School",
  description: "Exclusive chat app for students and graduates of Atlas School",
};

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
        <PushUnsubscribeGlue>
          {children}
        </PushUnsubscribeGlue>
      </body>
    </html>
  );
}
