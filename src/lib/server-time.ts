// =====================================================================
// SERVER-SIDE TIME UTILITY: ZONA ASIA/JAKARTA (WIB, UTC+7)
// Waktu SELALU dihitung di server, tidak pernah mempercayai jam perangkat klien
// =====================================================================

/**
 * Tanggal saat ini di zona Asia/Jakarta format YYYY-MM-DD
 */
export function getServerDateWIB(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Jam saat ini di zona Asia/Jakarta format HH:mm:ss
 */
export function getServerTimeWIB(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

/**
 * Timestamp ISO lengkap saat ini di zona Asia/Jakarta
 */
export function getServerTimestampWIB(): string {
  const dateStr = getServerDateWIB();
  const timeStr = getServerTimeWIB();
  return `${dateStr}T${timeStr}+07:00`;
}

/**
 * Dapatkan hari saat ini dalam format angka (1 = Senin, ..., 7 = Minggu) di Asia/Jakarta
 */
export function getServerDayOfWeekWIB(): number {
  const now = new Date();
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(now);

  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return dayMap[dayName] || 1;
}

/**
 * Validasi apakah jam server berada di dalam jendela waktu ibadah
 */
export function isServerWithinTimeWindow(
  startTime: string, // "11:30:00" atau "11:30"
  endTime: string,   // "14:00:00" atau "14:00"
  daysActive: number[] = [1, 2, 3, 4, 5]
): { isOpen: boolean; reason?: string; currentTimeWIB: string } {
  const currentDay = getServerDayOfWeekWIB();
  const currentTimeStr = getServerTimeWIB();

  if (!daysActive.includes(currentDay)) {
    return {
      isOpen: false,
      reason: 'Hari ini tidak dijadwalkan untuk check-in ibadah (hanya hari sekolah aktif).',
      currentTimeWIB: currentTimeStr,
    };
  }

  const toSeconds = (t: string) => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  };

  const curSec = toSeconds(currentTimeStr);
  const startSec = toSeconds(startTime);
  const endSec = toSeconds(endTime);

  if (curSec < startSec) {
    const diffMin = Math.ceil((startSec - curSec) / 60);
    return {
      isOpen: false,
      reason: `Jendela check-in belum dibuka. Jam server saat ini: ${currentTimeStr} WIB. Dimulai pukul ${startTime.slice(0, 5)} WIB (${diffMin} menit lagi).`,
      currentTimeWIB: currentTimeStr,
    };
  }

  if (curSec > endSec) {
    return {
      isOpen: false,
      reason: `Jendela check-in telah ditutup pada pukul ${endTime.slice(0, 5)} WIB. Jam server saat ini: ${currentTimeStr} WIB.`,
      currentTimeWIB: currentTimeStr,
    };
  }

  return {
    isOpen: true,
    currentTimeWIB: currentTimeStr,
  };
}
