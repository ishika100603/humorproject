import type { Metadata } from "next";
import { Archivo, Patrick_Hand_SC } from "next/font/google";
import "./globals.css";
import Splash from "./splash";
import Toasts from "./toasts";

// One family, used at different widths: condensed for signs, normal for reading
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Hand-lettered capitals for the landing title
const hand = Patrick_Hand_SC({ variable: "--font-hand", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "At 116 & Broadway",
  description: "Upload a campus photo, get AI captions, and upvote the funniest. Made for Columbia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Makes line drawings look hand-sketched */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id="sketch">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="3.2" />
          </filter>
        </svg>
        <Splash />
        {children}
        <Toasts />
      </body>
    </html>
  );
}
