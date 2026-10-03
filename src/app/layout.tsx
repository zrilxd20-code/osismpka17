import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pencatatan Ibadah OSIS & MPK',
  description: 'Sistem presensi ibadah mandiri sholat dzuhur dan pendalaman iman bagi pengurus OSIS & MPK',
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
