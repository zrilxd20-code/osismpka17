import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, isKnownScraperUserAgent, checkRateLimit } from '@/lib/rate-limiter';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get('user-agent');
  const clientIp = getClientIp(req);

  // 1. BLOKIR BOT SCRAPER & AUTOMATION TOOLS
  if (isKnownScraperUserAgent(userAgent)) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Akses API ditolak. Otomatisasi dan web scraping tidak diizinkan pada sistem ini.',
        },
        {
          status: 403,
          headers: {
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        }
      );
    }

    // Jika bot mencoba merayapi halaman utama
    return new NextResponse('Access Denied: Automated scraping is strictly prohibited.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  }

  // 2. IP RATE LIMITING UNTUK ENDPOINT API (Maksimal 60 request per menit per IP)
  if (pathname.startsWith('/api')) {
    const rateCheck = checkRateLimit(`ip-${clientIp}`, 60, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terlalu banyak permintaan dari alamat IP Anda. Silakan coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSeconds),
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        }
      );
    }

    // 3. CSRF & CROSS-SITE CHECK PADA REQUEST MUTASI (POST, PATCH, DELETE, PUT)
    const method = req.method.toUpperCase();
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      const secFetchSite = req.headers.get('sec-fetch-site');
      if (secFetchSite === 'cross-site') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Permintaan lintas domain (Cross-Site Request) ditolak demi keamanan data.',
          },
          { status: 403 }
        );
      }
    }
  }

  // 4. TERAPKAN RESPONSE SECURITY HEADERS MERATA
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  // Anti-Scraping / Anti-Indexing tag
  if (pathname.startsWith('/api') || pathname.startsWith('/_next/data')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  } else {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path request kecuali:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo assets, dsb
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
