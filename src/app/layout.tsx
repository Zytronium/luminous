import type { Metadata } from "next";
import "./globals.css";

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
    <body
      className={'antialiased'}
    >
    {children}
    </body>
    </html>
  );
}