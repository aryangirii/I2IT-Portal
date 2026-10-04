import type { Metadata } from "next";
import "./globals.css";
import "./portal-polish.css";
import "./welcome.css";
export const metadata: Metadata = {
  title: "Placement Desk",
  description:
    "Verified placement-event access and student attendance for TNP.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
