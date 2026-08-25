import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Claude Queue",
  description: "Multi-User Task-Queue für Claude",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
