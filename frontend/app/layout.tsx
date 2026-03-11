import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DesignMuse AI — AI Interior Design Agent",
  description:
    "Transform any floor plan into a fully visualized, themed living space powered by Google Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
