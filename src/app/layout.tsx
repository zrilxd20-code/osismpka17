import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://osismpka17.vercel.app'),
  title: 'Presensi Ibadah A17 - OSIS & MPK SMKN 17',
  description: 'Sistem presensi ibadah mandiri sholat dzuhur dan pendalaman iman bagi pengurus OSIS & MPK SMKN 17 (Divisi Keagamaan A17)',
  applicationName: 'Presensi Ibadah A17 SMKN 17',
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
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
