import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyGutPal — Your Gut Health Journey, Simplified",
  description:
    "Track symptoms, manage medications, time meals, and visualize your healing progress. Built for people managing SIBO, IBS, SIFO, GERD, and other digestive conditions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
