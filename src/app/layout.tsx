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
    <html lang="en">
      <body
        className={'antialiased'}
      >
        {children}
      </body>
    </html>
  );
}
