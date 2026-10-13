import "./globals.css";
import { LangProvider } from "@/components/ui/LangProvider";

export const metadata = {
  title: "VITAL ID",
  description: "VITAL ID — NFC + QR personal medical identity for emergency access and protected medical records.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
