import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "لوحة إدارة SMM",
  description: "لوحة تحكم إدارية لمنصة إعادة بيع خدمات السوشيال ميديا",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: { fontFamily: "inherit", direction: "rtl" },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
