// Utilitas Ekspor Laporan Presensi ke Excel (.xlsx) dan PDF Resmi
// Mendukung Mode Rekapitulasi: Per Minggu, Per Bulan, dan Per Hari
// Dilengkapi Penyematan Diagram Grafik Visual Kehadiran Otomatis ke dalam Excel & PDF

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PresensiIbadah } from '@/types/database';
import { formatTanggalIndonesia, formatJamWIB } from './time-utils';

export type ExportPeriodType = 'mingguan' | 'bulanan' | 'harian';

export interface ExportOptions {
  periodType?: ExportPeriodType;
  includeDailySheets?: boolean; // Jika false, TIDAK ADA tabel harian yang menumpuk (fokus rekap)
  title?: string;
  periodeLabel?: string;
  kordinatorName?: string;
  pembinaName?: string;
}

interface ProfileLike {
  id?: string;
  nis?: string;
  full_name?: string;
  nama?: string;
  kelas?: string;
  jabatan?: string;
  organisasi?: string;
  agama?: string;
}

/**
 * Helper untuk membuat visual batang persentase sederhana di Excel menggunakan karakter Unicode Bar
 * Contoh: 100% -> '██████████ 100%', 80% -> '████████░░ 80%'
 */
export function makeUnicodeBar(percent: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filledCount = Math.round(clamped / 10);
  const emptyCount = 10 - filledCount;
  return `${'█'.repeat(filledCount)}${'░'.repeat(emptyCount)} ${clamped}%`;
}

/**
 * Sanitasi nama sheet Excel (maksimal 31 karakter, tidak boleh mengandung karakter : \ / ? * [ ])
 */
function sanitizeSheetName(name: string): string {
  const clean = name.replace(/[:\\/?*[\]]/g, '-').trim();
  return clean.slice(0, 31) || 'Sheet';
}

/**
 * Helper mendapatkan grup Mingguan (Senin s/d Minggu)
 */
function getWeekGroup(dateStr: string): { key: string; label: string; shortLabel: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { key: 'Lainnya', label: 'Lainnya', shortLabel: 'Lainnya' };
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monStr = monday.toISOString().slice(0, 10);
  const monFmt = monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const sunFmt = sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return {
    key: monStr,
    label: `Minggu (${monFmt} - ${sunFmt})`,
    shortLabel: `${monFmt}-${sunFmt}`,
  };
}

/**
 * Helper mendapatkan grup Bulanan
 */
function getMonthGroup(dateStr: string): { key: string; label: string; shortLabel: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { key: 'Lainnya', label: 'Lainnya', shortLabel: 'Lainnya' };
  const key = dateStr.slice(0, 7);
  const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const shortLabel = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  return { key, label, shortLabel };
}

export interface SummaryBucket {
  key: string;
  label: string;
  shortLabel: string;
  hadir: number;
  izin: number;
  tidakHadir: number;
  total: number;
  persen: number;
  items: PresensiIbadah[];
}

/**
 * Mengelompokkan data berdasarkan periode yang dipilih (Harian, Mingguan, atau Bulanan)
 */
export function aggregatePresensiData(
  data: PresensiIbadah[],
  periodType: ExportPeriodType
): {
  buckets: SummaryBucket[];
  totalHadir: number;
  totalIzin: number;
  totalTidakHadir: number;
  totalCatatan: number;
  persenKehadiranTotal: number;
  memberMatrix: Array<{
    nis: string;
    nama: string;
    kelas: string;
    jabatan: string;
    organisasi: string;
    agama: string;
    hadir: number;
    izin: number;
    tidakHadir: number;
    total: number;
    persen: number;
  }>;
} {
  const bucketMap = new Map<string, SummaryBucket>();

  data.forEach((item) => {
    const tgl = item.tanggal || 'Tanpa-Tanggal';
    let key = tgl;
    let label = tgl;
    let shortLabel = tgl;

    if (periodType === 'mingguan') {
      const g = getWeekGroup(tgl);
      key = g.key;
      label = g.label;
      shortLabel = g.shortLabel;
    } else if (periodType === 'bulanan') {
      const g = getMonthGroup(tgl);
      key = g.key;
      label = g.label;
      shortLabel = g.shortLabel;
    } else {
      label = formatTanggalIndonesia(tgl);
      shortLabel = tgl.length >= 10 ? tgl.slice(5) : tgl;
    }

    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        label,
        shortLabel,
        hadir: 0,
        izin: 0,
        tidakHadir: 0,
        total: 0,
        persen: 0,
        items: [],
      });
    }

    const b = bucketMap.get(key)!;
    b.total++;
    b.items.push(item);
    if (item.status === 'hadir') b.hadir++;
    else if (item.status === 'izin' || item.status === 'izin_halangan') b.izin++;
    else b.tidakHadir++;
  });

  const buckets = Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  buckets.forEach((b) => {
    b.persen = b.total > 0 ? Math.round(((b.hadir + b.izin) / b.total) * 100) : 0;
  });

  // Hitung total keseluruhan
  let totalHadir = 0;
  let totalIzin = 0;
  let totalTidakHadir = 0;
  data.forEach((i) => {
    if (i.status === 'hadir') totalHadir++;
    else if (i.status === 'izin' || i.status === 'izin_halangan') totalIzin++;
    else totalTidakHadir++;
  });
  const totalCatatan = data.length;
  const persenKehadiranTotal = totalCatatan > 0 ? Math.round(((totalHadir + totalIzin) / totalCatatan) * 100) : 0;

  // Matriks Presensi Anggota (Unique Siswa)
  const memberMap = new Map<
    string,
    {
      nis: string;
      nama: string;
      kelas: string;
      jabatan: string;
      organisasi: string;
      agama: string;
      hadir: number;
      izin: number;
      tidakHadir: number;
    }
  >();

  data.forEach((item) => {
    const prof = (item.profile || {}) as ProfileLike;
    const memKey = item.user_id || prof.id || prof.nis || prof.full_name || 'unknown';
    if (!memberMap.has(memKey)) {
      memberMap.set(memKey, {
        nis: prof.nis || '-',
        nama: prof.full_name || prof.nama || 'Anggota',
        kelas: prof.kelas || '-',
        jabatan: prof.jabatan || '-',
        organisasi: prof.organisasi || '-',
        agama: (prof.agama || '-').toUpperCase(),
        hadir: 0,
        izin: 0,
        tidakHadir: 0,
      });
    }
    const mem = memberMap.get(memKey)!;
    if (item.status === 'hadir') mem.hadir++;
    else if (item.status === 'izin' || item.status === 'izin_halangan') mem.izin++;
    else mem.tidakHadir++;
  });

  const memberMatrix = Array.from(memberMap.values())
    .map((m) => {
      const tot = m.hadir + m.izin + m.tidakHadir;
      const pct = tot > 0 ? Math.round(((m.hadir + m.izin) / tot) * 100) : 0;
      return {
        ...m,
        total: tot,
        persen: pct,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return {
    buckets,
    totalHadir,
    totalIzin,
    totalTidakHadir,
    totalCatatan,
    persenKehadiranTotal,
    memberMatrix,
  };
}

/**
 * Menghasilkan Gambar Grafik Batang Kehadiran Beresolusi Tinggi (PNG Base64) via HTML5 Canvas
 * Digunakan untuk disematkan langsung ke Excel (.xlsx) dan PDF (.pdf)
 */
export function generateAttendanceChartImage(
  buckets: SummaryBucket[],
  title: string,
  totalPersen: number
): string {
  if (typeof document === 'undefined') return '';

  const width = 1100;
  const height = 520;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Background Card
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Background Header Bar Gradient
  const gradHeader = ctx.createLinearGradient(0, 0, width, 0);
  gradHeader.addColorStop(0, '#0F172A'); // Slate 900
  gradHeader.addColorStop(1, '#1E293B'); // Slate 800
  ctx.fillStyle = gradHeader;
  ctx.fillRect(0, 0, width, 70);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.fillText('DIAGRAM TREN KEHADIRAN PRESENSI IBADAH', 28, 38);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillText(title, 28, 58);

  // Badge Rata-rata
  ctx.fillStyle = '#0F766E';
  ctx.beginPath();
  ctx.roundRect(width - 240, 16, 212, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillText(`Rata-rata Kehadiran: ${totalPersen}%`, width - 230, 40);

  // 2. Legend Box
  const legendY = 88;
  const drawLegendItem = (color: string, label: string, x: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, legendY, 14, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillText(label, x + 20, legendY + 11);
  };

  drawLegendItem('#10B981', 'Hadir', width - 290);
  drawLegendItem('#F59E0B', 'Izin', width - 200);
  drawLegendItem('#EF4444', 'Tidak Hadir (Alpha)', width - 130);

  // 3. Area Plot Batang
  const plotX = 70;
  const plotY = 115;
  const plotW = width - 100;
  const plotH = 320;
  const baselineY = plotY + plotH;

  // Sumbu & Gridlines
  const maxTotal = Math.max(...buckets.map((b) => b.total), 5);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;

  for (let s = 0; s <= 4; s++) {
    const yVal = baselineY - (plotH / 4) * s;
    ctx.beginPath();
    ctx.moveTo(plotX, yVal);
    ctx.lineTo(plotX + plotW, yVal);
    ctx.stroke();

    const countVal = Math.round((maxTotal / 4) * s);
    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(countVal), plotX - 10, yVal + 4);
  }

  // Garis Sumbu X
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX, baselineY);
  ctx.lineTo(plotX + plotW, baselineY);
  ctx.stroke();

  // Batang Tiap Bucket (Maksimal 14 bucket agar tidak berdesakan)
  const displayBuckets = buckets.slice(-14);
  const slotW = plotW / Math.max(displayBuckets.length, 1);
  const barW = Math.min(slotW * 0.58, 48);

  displayBuckets.forEach((b, idx) => {
    const centerX = plotX + idx * slotW + slotW / 2;
    const startX = centerX - barW / 2;

    const hadirH = (b.hadir / maxTotal) * plotH;
    const izinH = (b.izin / maxTotal) * plotH;
    const alphaH = (b.tidakHadir / maxTotal) * plotH;

    // Batang Hadir (Emerald)
    if (hadirH > 0) {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(startX, baselineY - hadirH, barW, hadirH, 4);
      ctx.fill();
    }

    // Batang Izin (Amber bertingkat)
    if (izinH > 0) {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(startX, baselineY - hadirH - izinH, barW, izinH, 4);
      ctx.fill();
    }

    // Batang Alpha (Rose bertingkat)
    if (alphaH > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(startX, baselineY - hadirH - izinH - alphaH, barW, alphaH, 4);
      ctx.fill();
    }

    // Angka Total di Atas Batang
    const totalH = hadirH + izinH + alphaH;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.total} (${b.persen}%)`, centerX, Math.max(baselineY - totalH - 6, plotY + 12));

    // Label di Bawah Sumbu X
    ctx.fillStyle = '#334155';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.shortLabel, centerX, baselineY + 20);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Ekspor data presensi ke format Excel (.xlsx)
 * - Mendukung Mode Rekapitulasi: 'mingguan' | 'bulanan' | 'harian'
 * - Memiliki tab 'Rekap & Grafik Kehadiran' dengan GAMBAR GRAFIK VISUAL TERTANAM
 * - Memiliki tab 'Rekapitulasi Siswa'
 * - Opsi includeDailySheets: jika false (default), TIDAK MEMBUAT puluhan sheet harian!
 */
export async function exportToExcel(
  data: PresensiIbadah[],
  titleOrOptions: string | ExportOptions = 'Rekap_Ibadah_OSIS_MPK'
): Promise<void> {
  const options: ExportOptions =
    typeof titleOrOptions === 'string'
      ? { title: titleOrOptions, periodType: 'mingguan', includeDailySheets: false }
      : {
          periodType: 'mingguan',
          includeDailySheets: false,
          title: 'Rekap_Ibadah_OSIS_MPK',
          ...titleOrOptions,
        };

  const periodType = options.periodType || 'mingguan';
  const includeDailySheets = options.includeDailySheets ?? false;
  const fileName = options.title || `Rekap_Ibadah_${periodType.toUpperCase()}`;

  const {
    buckets,
    totalHadir,
    totalIzin,
    totalTidakHadir,
    totalCatatan,
    persenKehadiranTotal,
    memberMatrix,
  } = aggregatePresensiData(data, periodType);

  const periodTitle =
    periodType === 'mingguan'
      ? 'REKAPITULASI MINGGUAN'
      : periodType === 'bulanan'
      ? 'REKAPITULASI BULANAN'
      : 'REKAPITULASI HARIAN';

  // Hasilkan Gambar Grafik Batang PNG
  const chartImageBase64 = generateAttendanceChartImage(
    buckets,
    `${periodTitle} (Total Data: ${totalCatatan} Presensi)`,
    persenKehadiranTotal
  );

  // Coba gunakan ExcelJS untuk menyematkan gambar grafik & styling tingkat tinggi
  try {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OSIS MPK Divisi Keagamaan SMKN 17';
    workbook.created = new Date();

    // =========================================================================
    // SHEET 1: REKAPITULASI & GRAFIK VISUAL
    // =========================================================================
    const sheet1 = workbook.addWorksheet('Rekap & Grafik');

    // Judul Laporan
    sheet1.mergeCells('A1:I1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = `LAPORAN ${periodTitle} PRESENSI IBADAH OSIS & MPK`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

    sheet1.mergeCells('A2:I2');
    const subCell = sheet1.getCell('A2');
    subCell.value = `Waktu Ekspor: ${new Date().toLocaleString('id-ID')} WIB | Total: ${totalCatatan} Presensi | Rata-rata Kehadiran: ${persenKehadiranTotal}%`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

    // Sematkan Gambar Grafik ke Worksheet jika tersedia
    if (chartImageBase64) {
      const imageId = workbook.addImage({
        base64: chartImageBase64,
        extension: 'png',
      });
      sheet1.addImage(imageId, {
        tl: { col: 0, row: 3 }, // Mulai Kolom A, Baris 4
        ext: { width: 720, height: 340 },
        editAs: 'oneCell',
      });
    }

    // Baris awal tabel di bawah grafik (Baris 22)
    const tableStartRow = 22;

    sheet1.getRow(tableStartRow).values = [
      'No',
      periodType === 'mingguan' ? 'Rentang Minggu' : periodType === 'bulanan' ? 'Bulan' : 'Tanggal',
      'Total Hadir',
      'Total Izin',
      'Tidak Hadir',
      'Total Siswa',
      'Persentase',
      'Grafik Progress Bar',
    ];
    sheet1.getRow(tableStartRow).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(tableStartRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal 700
    };
    sheet1.getRow(tableStartRow).alignment = { horizontal: 'center' };

    buckets.forEach((b, idx) => {
      const r = sheet1.addRow([
        idx + 1,
        b.label,
        b.hadir,
        b.izin,
        b.tidakHadir,
        b.total,
        `${b.persen}%`,
        makeUnicodeBar(b.persen),
      ]);
      r.alignment = { vertical: 'middle' };
    });

    // Baris Total Ringkasan
    const totalRow = sheet1.addRow([
      'TOTAL',
      'SEMUA PERIODE',
      totalHadir,
      totalIzin,
      totalTidakHadir,
      totalCatatan,
      `${persenKehadiranTotal}%`,
      makeUnicodeBar(persenKehadiranTotal),
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    sheet1.columns = [
      { key: 'no', width: 6 },
      { key: 'periode', width: 32 },
      { key: 'hadir', width: 14 },
      { key: 'izin', width: 14 },
      { key: 'alpha', width: 14 },
      { key: 'total', width: 14 },
      { key: 'persen', width: 16 },
      { key: 'grafik', width: 28 },
    ];

    // =========================================================================
    // SHEET 2: REKAPITULASI MATRIKS ANGGOTA
    // =========================================================================
    const sheet2 = workbook.addWorksheet('Rekapitulasi Anggota');

    sheet2.mergeCells('A1:I1');
    sheet2.getCell('A1').value = `DAFTAR REKAPITULASI PRESENSI ANGGOTA (${periodTitle})`;
    sheet2.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF0F766E' } };

    sheet2.getRow(3).values = [
      'No',
      'NIS',
      'Nama Anggota',
      'Organisasi',
      'Kelas',
      'Agama',
      'Total Hadir',
      'Total Izin',
      'Tidak Hadir',
      'Total Pertemuan',
      '% Kehadiran',
    ];
    sheet2.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet2.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };

    memberMatrix.forEach((m, idx) => {
      sheet2.addRow([
        idx + 1,
        m.nis,
        m.nama,
        m.organisasi,
        m.kelas,
        m.agama,
        m.hadir,
        m.izin,
        m.tidakHadir,
        m.total,
        `${m.persen}%`,
      ]);
    });

    sheet2.columns = [
      { key: 'no', width: 6 },
      { key: 'nis', width: 14 },
      { key: 'nama', width: 28 },
      { key: 'org', width: 14 },
      { key: 'kelas', width: 12 },
      { key: 'agama', width: 14 },
      { key: 'hadir', width: 12 },
      { key: 'izin', width: 12 },
      { key: 'alpha', width: 14 },
      { key: 'total', width: 16 },
      { key: 'persen', width: 14 },
    ];

    // =========================================================================
    // SHEET 3..N: HANYA DIBUAT JIKA includeDailySheets === true
    // =========================================================================
    if (includeDailySheets) {
      const dateMap = new Map<string, PresensiIbadah[]>();
      data.forEach((item) => {
        const tgl = item.tanggal || 'Tanpa-Tanggal';
        if (!dateMap.has(tgl)) dateMap.set(tgl, []);
        dateMap.get(tgl)!.push(item);
      });

      const sortedDates = Array.from(dateMap.keys()).sort();
      sortedDates.forEach((tgl) => {
        const items = dateMap.get(tgl) || [];
        const cleanName = sanitizeSheetName(tgl);
        const daySheet = workbook.addWorksheet(cleanName);

        daySheet.mergeCells('A1:H1');
        daySheet.getCell('A1').value = `PRESENSI HARIAN: ${tgl}`;
        daySheet.getCell('A1').font = { bold: true, size: 11, color: { argb: 'FF0F766E' } };

        daySheet.getRow(3).values = [
          'No',
          'NIS',
          'Nama Siswa',
          'Organisasi',
          'Kelas',
          'Agama',
          'Status',
          'Jam Check-in',
          'Status Verifikasi',
        ];
        daySheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        daySheet.getRow(3).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' },
        };

        items.forEach((item, index) => {
          const profile = (item.profile || {}) as ProfileLike;
          const isIzin = item.status === 'izin' || item.status === 'izin_halangan';
          const statusLabel = item.status === 'hadir' ? 'Hadir' : isIzin ? 'Izin' : 'Tidak Hadir';

          daySheet.addRow([
            index + 1,
            profile.nis || '-',
            profile.full_name || profile.nama || '-',
            profile.organisasi || '-',
            profile.kelas || '-',
            (profile.agama || '-').toUpperCase(),
            statusLabel,
            formatJamWIB(item.waktu_checkin || item.dibuat_pada),
            item.status_verifikasi || 'menunggu',
          ]);
        });
      });
    }

    // Trigger download buffer ExcelJS
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn('ExcelJS fallback to XLSX due to:', err);
    // Fallback ke SheetJS standard jika ExcelJS terhambat di runtime
    const wb = XLSX.utils.book_new();
    const summaryRows = buckets.map((b, idx) => ({
      No: idx + 1,
      Periode: b.label,
      'Total Hadir': b.hadir,
      'Total Izin': b.izin,
      'Tidak Hadir': b.tidakHadir,
      'Total Presensi': b.total,
      'Tingkat Kehadiran': `${b.persen}%`,
      'Grafik Bar': makeUnicodeBar(b.persen),
    }));
    const s1 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, s1, 'Rekapitulasi');

    const memberRows = memberMatrix.map((m, idx) => ({
      No: idx + 1,
      NIS: m.nis,
      Nama: m.nama,
      Organisasi: m.organisasi,
      Kelas: m.kelas,
      Agama: m.agama,
      Hadir: m.hadir,
      Izin: m.izin,
      'Tidak Hadir': m.tidakHadir,
      Total: m.total,
      '% Kehadiran': `${m.persen}%`,
    }));
    const s2 = XLSX.utils.json_to_sheet(memberRows);
    XLSX.utils.book_append_sheet(wb, s2, 'Rekap Siswa');

    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}

/**
 * Ekspor data presensi ke PDF resmi landscape:
 * - Halaman 1: Ringkasan Eksekutif & DIAGRAM GRAFIK BATANG KEHADIRAN (PNG High-Res)
 * - Halaman 2: Tabel Rekapitulasi Presensi Anggota (Per Minggu / Per Bulan)
 * - Halaman Tambahan (Harian): HANYA DIBUAT jika includeDailySheets === true!
 * - Halaman Penutup: Kolom Tanda Tangan Resmi Pembina & Koordinator
 */
export function exportToPDF(
  data: PresensiIbadah[],
  periodeTextOrOptions: string | ExportOptions = 'Rekapitulasi Ibadah',
  kordinatorNameParam: string = 'Fadhil Pratama',
  pembinaNameParam: string = 'Nurkholis Aiman / Maria Ulfa'
): void {
  const options: ExportOptions =
    typeof periodeTextOrOptions === 'string'
      ? {
          periodeLabel: periodeTextOrOptions,
          periodType: 'mingguan',
          includeDailySheets: false,
          kordinatorName: kordinatorNameParam,
          pembinaName: pembinaNameParam,
        }
      : {
          periodType: 'mingguan',
          includeDailySheets: false,
          kordinatorName: kordinatorNameParam,
          pembinaName: pembinaNameParam,
          ...periodeTextOrOptions,
        };

  const periodType = options.periodType || 'mingguan';
  const includeDailySheets = options.includeDailySheets ?? false;
  const periodeLabel = options.periodeLabel || 'Rekapitulasi Ibadah';
  const kordinatorName = options.kordinatorName || 'Fadhil Pratama';
  const pembinaName = options.pembinaName || 'Nurkholis Aiman / Maria Ulfa';

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  const {
    buckets,
    totalHadir,
    totalIzin,
    totalTidakHadir,
    totalCatatan,
    persenKehadiranTotal,
    memberMatrix,
  } = aggregatePresensiData(data, periodType);

  const periodTitle =
    periodType === 'mingguan'
      ? 'REKAPITULASI MINGGUAN'
      : periodType === 'bulanan'
      ? 'REKAPITULASI BULANAN'
      : 'REKAPITULASI HARIAN';

  // Hasilkan Gambar Grafik PNG
  const chartImg = generateAttendanceChartImage(
    buckets,
    `${periodTitle}: ${periodeLabel}`,
    persenKehadiranTotal
  );

  // =========================================================================
  // HALAMAN 1: KOP SURAT RESMI, KPI, & DIAGRAM GRAFIK BATANG KEHADIRAN
  // =========================================================================
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DIVISI KEAGAMAAN (A17) OSIS & MPK SMKN 17 JAKARTA', pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(16, 115, 110); // Teal 700
  doc.text(`LAPORAN ${periodTitle} & GRAFIK PRESENSI IBADAH`, pageWidth / 2, 19, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Periode: ${periodeLabel}  |  Dicetak: ${formatTanggalIndonesia(new Date().toISOString().slice(0, 10))} WIB`,
    pageWidth / 2,
    24,
    { align: 'center' }
  );

  // Garis Pemisah Kop
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 26.5, pageWidth - 14, 26.5);

  // KPI Summary Cards (4 Box)
  const cardY = 29;
  const cardWidth = 63;
  const cardHeight = 15;
  const cardGap = 5;
  const startX = (pageWidth - (cardWidth * 4 + cardGap * 3)) / 2;

  const kpis = [
    { label: 'Total Presensi', val: `${totalCatatan}`, color: [30, 41, 59] },
    { label: 'Tingkat Kehadiran', val: `${persenKehadiranTotal}%`, color: [16, 115, 110] },
    { label: 'Hadir / Izin', val: `${totalHadir} / ${totalIzin}`, color: [16, 185, 129] },
    { label: 'Tidak Hadir (Alpha)', val: `${totalTidakHadir}`, color: [239, 68, 68] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = startX + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label.toUpperCase(), x + cardWidth / 2, cardY + 5, { align: 'center' });

    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + cardWidth / 2, cardY + 12, { align: 'center' });
  });

  // SEMATKAN GAMBAR GRAFIK BATANG KE PDF
  if (chartImg) {
    const chartY = 46;
    const chartW = pageWidth - 28;
    const chartH = 78;
    doc.addImage(chartImg, 'PNG', 14, chartY, chartW, chartH);
  }

  // TABEL RINGKASAN REKAPITULASI DI HALAMAN 1 (Bawah Grafik)
  const summaryTableData = buckets.slice(0, 6).map((b, idx) => [
    idx + 1,
    b.label,
    b.hadir,
    b.izin,
    b.tidakHadir,
    b.total,
    `${b.persen}%`,
    makeUnicodeBar(b.persen),
  ]);

  autoTable(doc, {
    startY: 128,
    head: [[
      'No',
      periodType === 'mingguan' ? 'Rentang Minggu' : periodType === 'bulanan' ? 'Bulan' : 'Tanggal',
      'Hadir',
      'Izin',
      'Alpha',
      'Total',
      '% Hadir',
      'Grafik Progress Bar',
    ]],
    body: summaryTableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      halign: 'center',
    },
    headStyles: {
      fillColor: [15, 118, 110], // Teal
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
      7: { cellWidth: 95, halign: 'left', fontStyle: 'bold' },
    },
  });

  // =========================================================================
  // HALAMAN 2: TABEL REKAPITULASI PRESENSI ANGGOTA (MATRIKS REKAP SISWA)
  // =========================================================================
  doc.addPage();

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TABEL REKAPITULASI PRESENSI ANGGOTA (${periodTitle})`, 14, 15);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Total Anggota Terdata: ${memberMatrix.length} Orang  |  Persentase Rata-rata: ${persenKehadiranTotal}%`,
    14,
    21
  );

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 24, pageWidth - 14, 24);

  const memberRows = memberMatrix.map((m, idx) => [
    idx + 1,
    m.nis,
    m.nama.slice(0, 24),
    m.organisasi,
    m.kelas,
    m.agama,
    m.hadir,
    m.izin,
    m.tidakHadir,
    m.total,
    `${m.persen}%`,
  ]);

  autoTable(doc, {
    startY: 27,
    head: [['No', 'NIS', 'Nama Siswa', 'Org', 'Kelas', 'Agama', 'Hadir', 'Izin', 'Alpha', 'Total', '% Hadir']],
    body: memberRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 55 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'center', cellWidth: 20 },
      9: { halign: 'center', cellWidth: 22 },
      10: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
    },
  });

  // =========================================================================
  // HALAMAN 3..N: TABEL DETAIL HARIAN (HANYA JIKA includeDailySheets === true)
  // =========================================================================
  if (includeDailySheets) {
    const dateMap = new Map<string, PresensiIbadah[]>();
    data.forEach((item) => {
      const tgl = item.tanggal || 'Lainnya';
      if (!dateMap.has(tgl)) dateMap.set(tgl, []);
      dateMap.get(tgl)!.push(item);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    sortedDates.forEach((tgl) => {
      const dailyItems = dateMap.get(tgl) || [];
      doc.addPage();

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`RINCIAN HARIAN: ${formatTanggalIndonesia(tgl).toUpperCase()}`, 14, 15);

      const tableRows = dailyItems.map((item, idx) => {
        const isIzin = item.status === 'izin' || item.status === 'izin_halangan';
        const statusText = item.status === 'hadir' ? 'Hadir' : isIzin ? 'Izin' : 'Tidak Hadir';
        const ibadah =
          (item.ibadah || item.jenis_ibadah?.nama) === 'sholat_dzuhur' ? 'Dzuhur' : 'Pend. Iman';

        return [
          idx + 1,
          item.profile?.nis || '-',
          (item.profile?.full_name || item.profile?.nama || '-').slice(0, 24),
          item.profile?.organisasi || '-',
          item.profile?.kelas || '-',
          item.profile?.agama?.toUpperCase() || '-',
          ibadah,
          statusText,
          formatJamWIB(item.waktu_checkin || item.dibuat_pada),
          item.status_verifikasi || 'menunggu',
        ];
      });

      autoTable(doc, {
        startY: 22,
        head: [['No', 'NIS', 'Nama Siswa', 'Org', 'Kelas', 'Agama', 'Ibadah', 'Status', 'Jam', 'Verif']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [16, 78, 139], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 18 },
          2: { cellWidth: 52 },
          3: { halign: 'center', cellWidth: 14 },
          4: { halign: 'center', cellWidth: 16 },
          5: { halign: 'center', cellWidth: 16 },
          6: { halign: 'center', cellWidth: 22 },
          7: { halign: 'center', cellWidth: 22 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 24 },
        },
      });
    });
  }

  // =========================================================================
  // TANDA TANGAN RESMI PENGESAHAN
  // =========================================================================
  // @ts-expect-error autoTable adds lastAutoTable to doc
  const finalY = doc.lastAutoTable?.finalY || 120;
  let signY = finalY + 14;

  if (signY > pageHeight - 40) {
    doc.addPage();
    signY = 35;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  // Tanda Tangan Kiri: Pembina
  doc.text('Mengetahui,', 40, signY);
  doc.setFont('helvetica', 'bold');
  doc.text('Pembina OSIS & MPK', 40, signY + 4.5);
  doc.text(`( ${pembinaName} )`, 40, signY + 24);

  // Tanda Tangan Kanan: Koordinator Divisi Keagamaan
  doc.setFont('helvetica', 'normal');
  doc.text('Diverifikasi oleh,', pageWidth - 85, signY);
  doc.setFont('helvetica', 'bold');
  doc.text('Koordinator Divisi Keagamaan', pageWidth - 85, signY + 4.5);
  doc.text(`( ${kordinatorName} )`, pageWidth - 85, signY + 24);

  // Simpan file PDF
  doc.save(`Laporan_Presensi_${periodType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
