import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";

import "@/app/globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "DocVerCtl",
  description: "GitHub-backed documentation management"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={ibmPlexSans.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
