import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import TitleBar from "@/components/Titlebar";

export const metadata: Metadata = {
  title: "Luminous - The chat app for Atlas School",
  description: "Exclusive chat app for students and graduates of Atlas School",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{
        __html: `
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  `
      }} />
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