// Utility Waktu & Format Tanggal Zona WIB (Asia/Jakarta, UTC+7)

/**
 * Dapatkan tanggal saat ini dalam format YYYY-MM-DD sesuai zona WIB
 */
export function getTodayWIB(): string {
  const now = new Date();
  // Format ke timezone Asia/Jakarta
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA formatnya YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Dapatkan waktu jam sekarang format "HH:mm" atau "HH:mm:ss" di WIB
 */
export function getCurrentTimeWIB(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('id-ID', options).format(now).replace(/\./g, ':');
}

/**
 * Format tanggal Indonesia lengkap: misal "Senin, 17 November 2025"
 */
export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00+07:00');
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/**
 * Format jam menit WIB (misal "12:15 WIB")
 */
export function formatJamWIB(isoOrTimeStr?: string | null): string {
  if (!isoOrTimeStr) return '-';
  try {
    if (isoOrTimeStr.length <= 8 && isoOrTimeStr.includes(':')) {
      const [h, m] = isoOrTimeStr.split(':');
      return `${h}:${m} WIB`;
    }
    const date = new Date(isoOrTimeStr);
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(date).replace(/\./g, ':');
    return `${timeFormatted} WIB`;
  } catch {
    return isoOrTimeStr;
  }
}

/**
 * Cek apakah waktu sekarang berada dalam jendela waktu ibadah
 * @param startTime format "HH:mm:ss" atau "HH:mm"
 * @param endTime format "HH:mm:ss" atau "HH:mm"
 * @param daysActive array hari [1,2,3,4,5] (1=Senin, 7=Minggu)
 */
export function isWithinTimeWindow(
  startTime: string,
  endTime: string,
  daysActive: number[] = [1, 2, 3, 4, 5],
  bypassForTesting: boolean = false
): { isOpen: boolean; reason?: string; minutesLeft?: number } {
  if (bypassForTesting) {
    return { isOpen: true };
  }

  const now = new Date();
  
  // Dapatkan hari dalam minggu di WIB (1=Senin, 7=Minggu)
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Jakarta',
  });
  const dayName = dayFormatter.format(now);
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const currentDay = dayMap[dayName] || 1;

  if (!daysActive.includes(currentDay)) {
    return {
      isOpen: false,
      reason: 'Hari ini tidak dijadwalkan untuk check-in ibadah (hanya hari sekolah aktif).',
    };
  }

  // Dapatkan jam & menit sekarang di WIB
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
  const currentTimeStr = timeFormatter.format(now);

  const toSeconds = (t: string) => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  };

  const currentSec = toSeconds(currentTimeStr);
  const startSec = toSeconds(startTime);
  const endSec = toSeconds(endTime);

  if (currentSec < startSec) {
    const diffMin = Math.ceil((startSec - currentSec) / 60);
    return {
      isOpen: false,
      reason: `Jendela belum dibuka. Dimulai pukul ${startTime.slice(0, 5)} WIB (${diffMin} menit lagi).`,
    };
  }

  if (currentSec > endSec) {
    return {
      isOpen: false,
      reason: `Jendela check-in telah ditutup pada pukul ${endTime.slice(0, 5)} WIB.`,
    };
  }

  const minutesLeft = Math.floor((endSec - currentSec) / 60);
  return {
    isOpen: true,
    minutesLeft,
  };
}
