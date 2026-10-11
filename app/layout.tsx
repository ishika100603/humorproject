import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One family, used at different widths: condensed for signs, normal for reading
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Caption the City",
  description: "Upload a campus photo, get AI captions, and upvote the funniest. Made for Columbia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
