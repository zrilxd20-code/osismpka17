// =====================================================================
// RATE LIMITER IN-MEMORY & ANTI-SCRAPING BOT DETECTOR
// =====================================================================

import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Ekstrak alamat IP client secara aman dari berbagai header reverse proxy
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  return '127.0.0.1';
}

/**
 * Deteksi apakah User-Agent adalah bot scraper agresif atau alat otomatisasi
 */
export function isKnownScraperUserAgent(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim() === '') {
    return true; // Request tanpa User-Agent umumnya berasal dari skrip scraping dasar
  }

  const ua = userAgent.toLowerCase();
  const suspiciousSignatures = [
    'scrapy',
    'python-requests',
    'python-urllib',
    'aiohttp',
    'httpclient',
    'curl/',
    'wget/',
    'bytespider',
    'petalbot',
    'ccbot',
    'gptbot',
    'chatgpt-user',
    'anthropic-ai',
    'claude-web',
    'google-extended',
    'amazonbot',
    'headlesschrome',
    'puppeteer',
    'selenium',
    'phantomjs',
    'postmanruntime',
    'go-http-client',
    'masscan',
    'zgrab',
    'nmap',
    'sqlmap',
    'nikto',
    'dirbuster',
  ];

  return suspiciousSignatures.some((signature) => ua.includes(signature));
}

/**
 * Cek apakah permintaan melewati ambang batas rate limit
 * @param identifier IP atau User ID
 * @param maxRequests Jumlah maksimal permintaan
 * @param windowMs Durasi jendela dalam milidetik (misal 60.000 ms = 1 menit)
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Bersihkan data kedaluwarsa berkala jika ukuran memori membesar
  if (rateLimitStore.size > 10000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

