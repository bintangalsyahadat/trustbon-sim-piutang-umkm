import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "TrustBon — Sistem Manajemen Piutang UMKM & Skoring Risiko Kredit",
  description: "Aplikasi pencatatan kasbon dan piutang UMKM pintar dengan skoring risiko kredit otomatis, reminder WhatsApp, dan sistem multi-tenant Owner-Kasir.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "TrustBon — Sistem Manajemen Piutang UMKM & Skoring Risiko Kredit",
    description: "Bukan sekadar buku kasbon. TrustBon memberikan skor risiko kredit pelanggan dan proteksi limit kredit untuk mencegah piutang macet.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
