import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://osismpka17.vercel.app'),
  title: 'Buku Presensi Ibadah A17 — OSIS & MPK SMKN 17',
  description:
    'Buku presensi harian Sholat Dzuhur dan Pendalaman Iman untuk pengurus OSIS & MPK SMKN 17 Jakarta, dikelola Divisi 1 Keagamaan (A17).',
  applicationName: 'Buku Presensi A17 SMKN 17',
  icons: {
    icon: '/logo-a17.jpg',
    apple: '/logo-a17.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Presensi A17 SMKN 17',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f3d28',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`h-full ${jakarta.variable} ${plexMono.variable}`}>
      <body className="min-h-full text-stone-900 flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
