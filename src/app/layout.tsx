import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Notex chat", description: "Private text chat" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
