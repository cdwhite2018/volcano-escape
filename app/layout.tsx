import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volcano Escape",
  description: "A cinematic mobile-first pixel-art survival adventure.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#160d1e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return <html lang="en"><head><link rel="manifest" href={`${base}/manifest.webmanifest`} /></head><body>{children}</body></html>;
}
