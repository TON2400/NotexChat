import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Notex chat", description: "Private text chat" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
