import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Q&A Dashboard",
  description: "Real-time Q&A Dashboard with WebSocket support",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
