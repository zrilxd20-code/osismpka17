// =====================================================================
// PARSER & VALIDATOR IMPOR DATA SISWA (XLSX, XLS, CSV)
// =====================================================================

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export interface RawRowItem {
  rowNumber: number;
  nis: string;
  nama: string;
  kelas: string;
  jabatan: string;
  agama: string;
  email?: string;
}

export interface ValidRowItem extends RawRowItem {
  agamaNormalized: 'islam' | 'kristen' | 'katolik' | 'hindu' | 'buddha' | 'konghucu';
  isNewAccount: boolean;
}

export interface ErrorRowItem {
  rowNumber: number;
  nis?: string;
  nama?: string;
  alasan: string;
  dataMentah?: Record<string, unknown>;
}

export interface PreviewImportResult {
  totalBaris: number;
  barisValid: ValidRowItem[];
  barisError: ErrorRowItem[];
  jumlahAkunBaru: number;
  jumlahAkunDiperbarui: number;
}

const AGAMA_ALLOWED = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu'];

/**
 * Deteksi dan parsing buffer file Excel/CSV
 */
export function parseUploadedFileBuffer(
  buffer: Buffer,
  fileName: string,
  fileMimeType: string
): { rows: RawRowItem[]; error?: string } {
  const lowerName = fileName.toLowerCase();

  // Tolak jika file berupa PDF atau Word
  if (
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    fileMimeType.includes('pdf') ||
    fileMimeType.includes('word') ||
    fileMimeType.includes('officedocument.wordprocessingml')
  ) {
    return {
      rows: [],
      error: 'Ubah dulu ke Excel/CSV memakai template.',
    };
  }

  // Cek ekstensi yang diizinkan
  const isCsv = lowerName.endsWith('.csv') || fileMimeType.includes('csv') || fileMimeType.includes('text/plain');
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || fileMimeType.includes('sheet') || fileMimeType.includes('excel');

  if (!isCsv && !isExcel) {
    return {
      rows: [],
      error: 'Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv (maksimal 5 MB).',
    };
  }

  const rawRows: RawRowItem[] = [];

  try {
    if (isCsv) {
      const csvText = buffer.toString('utf-8');
      const parseResult = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      parseResult.data.forEach((row, idx) => {
        rawRows.push(extractRowFields(row, idx + 2)); // Baris 1 header
      });
    } else {
      // Excel (.xlsx / .xls)
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return { rows: [], error: 'File Excel tidak memiliki lembar kerja (sheet).' };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        raw: false,
        defval: '',
      });

      jsonData.forEach((row, idx) => {
        // Normalisasi key header ke lowercase
        const normalizedRow: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          normalizedRow[key.trim().toLowerCase()] = String(value ?? '').trim();
        }
        rawRows.push(extractRowFields(normalizedRow, idx + 2));
      });
    }

    return { rows: rawRows };
  } catch (err) {
    return {
      rows: [],
      error: `Gagal membaca isi file: ${err instanceof Error ? err.message : 'Format data tidak valid.'}`,
    };
  }
}

/**
 * Ekstraksi kolom dari header yang mungkin sedikit bervariasi
 */
function extractRowFields(row: Record<string, string>, rowNumber: number): RawRowItem {
  const findValue = (...possibleKeys: string[]) => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== '') {
        return row[key].trim();
      }
      // Cek substring
      for (const [k, v] of Object.entries(row)) {
        if (k.includes(key) && v !== '') {
          return String(v).trim();
        }
      }
    }
    return '';
  };

  return {
    rowNumber,
    nis: findValue('nis', 'nomor induk', 'no induk'),
    nama: findValue('nama', 'nama lengkap', 'siswa'),
    kelas: findValue('kelas', 'tingkat', 'rombel'),
    jabatan: findValue('jabatan', 'organisasi', 'divisi'),
    agama: findValue('agama', 'kepercayaan'),
    email: findValue('email', 'surel', 'e-mail') || undefined,
  };
}

/**
 * Validasi baris-baris data impor terhadap aturan bisnis & database
 */
export function validateImportRows(
  rows: RawRowItem[],
  existingNisSet: Set<string>
): PreviewImportResult {
  const barisValid: ValidRowItem[] = [];
  const barisError: ErrorRowItem[] = [];
  const seenNisInFile = new Set<string>();

  let jumlahAkunBaru = 0;
  let jumlahAkunDiperbarui = 0;

  for (const row of rows) {
    const errorReasons: string[] = [];

    // 1. Cek NIS
    if (!row.nis) {
      errorReasons.push('NIS tidak boleh kosong');
    } else if (!/^\d+$/.test(row.nis)) {
      errorReasons.push(`NIS '${row.nis}' harus berupa deret angka numerik`);
    } else if (seenNisInFile.has(row.nis)) {
      errorReasons.push(`NIS '${row.nis}' duplikat / ganda di dalam file yang sama`);
    }

    // 2. Cek Nama
    if (!row.nama || row.nama.length < 2) {
      errorReasons.push('Nama lengkap wajib diisi minimal 2 karakter');
    }

    // 3. Cek Kelas
    if (!row.kelas) {
      errorReasons.push('Kelas wajib diisi');
    }

    // 4. Cek Jabatan
    if (!row.jabatan) {
      errorReasons.push('Jabatan wajib diisi');
    }

    // 5. Cek Agama
    const normalizedAgama = row.agama ? row.agama.toLowerCase().trim() : '';
    if (!normalizedAgama) {
      errorReasons.push('Agama wajib diisi');
    } else if (!AGAMA_ALLOWED.includes(normalizedAgama)) {
      errorReasons.push(
        `Agama '${row.agama}' tidak valid. Pilihan: ${AGAMA_ALLOWED.join(', ')}`
      );
    }

    // 6. Cek Format Email (jika ada)
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errorReasons.push(`Format email '${row.email}' tidak valid`);
    }

    if (errorReasons.length > 0) {
      barisError.push({
        rowNumber: row.rowNumber,
        nis: row.nis || undefined,
        nama: row.nama || undefined,
        alasan: errorReasons.join('; '),
      });
    } else {
      seenNisInFile.add(row.nis);
      const isExisting = existingNisSet.has(row.nis);
      if (isExisting) {
        jumlahAkunDiperbarui += 1;
      } else {
        jumlahAkunBaru += 1;
      }

      barisValid.push({
        ...row,
        agamaNormalized: normalizedAgama as ValidRowItem['agamaNormalized'],
        isNewAccount: !isExisting,
      });
    }
  }

  return {
    totalBaris: rows.length,
    barisValid,
    barisError,
    jumlahAkunBaru,
    jumlahAkunDiperbarui,
  };
}

/**
 * Buat file template Excel (.xlsx) dengan kolom resmi dan sheet panduan
 */
export async function generateTemplateExcelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OSIS MPK Sistem Ibadah';
  workbook.created = new Date();

  // Sheet 1: Template Data
  const sheetData = workbook.addWorksheet('Data Siswa');
  sheetData.columns = [
    { header: 'NIS', key: 'nis', width: 15 },
    { header: 'Nama', key: 'nama', width: 30 },
    { header: 'Kelas', key: 'kelas', width: 15 },
    { header: 'Jabatan (OSIS/MPK)', key: 'jabatan', width: 25 },
    { header: 'Agama', key: 'agama', width: 18 },
    { header: 'Email (opsional)', key: 'email', width: 30 },
  ];

  // Styling header sheet 1
  const headerRow = sheetData.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF107E3E' }, // Emerald Green
  };

  // Contoh data
  sheetData.addRow({
    nis: '2425001',
    nama: 'Contoh Siswa Pratama',
    kelas: 'X-1',
    jabatan: 'Anggota OSIS',
    agama: 'Islam',
    email: 'siswa1@sekolah.sch.id',
  });
  sheetData.addRow({
    nis: '2425002',
    nama: 'Contoh Siswi Kristina',
    kelas: 'XI IPA 1',
    jabatan: 'Anggota MPK',
    agama: 'Kristen',
    email: '',
  });

  // Sheet 2: Petunjuk Pengisian
  const sheetGuide = workbook.addWorksheet('Petunjuk Pengisian');
  sheetGuide.columns = [
    { header: 'Kolom', key: 'kolom', width: 25 },
    { header: 'Wajib / Opsional', key: 'wajib', width: 18 },
    { header: 'Ketentuan & Format', key: 'ketentuan', width: 60 },
  ];

  const guideHeader = sheetGuide.getRow(1);
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };

  sheetGuide.addRows([
    {
      kolom: 'NIS',
      wajib: 'WAJIB',
      ketentuan: 'Harus berupa deret angka, unik untuk setiap siswa (contoh: 2425001).',
    },
    {
      kolom: 'Nama',
      wajib: 'WAJIB',
      ketentuan: 'Nama lengkap siswa sesuai buku induk kesiswaan.',
    },
    {
      kolom: 'Kelas',
      wajib: 'WAJIB',
      ketentuan: 'Contoh: X-1, X-2, XI IPA 1, XII IPS 2.',
    },
    {
      kolom: 'Jabatan (OSIS/MPK)',
      wajib: 'WAJIB',
      ketentuan: 'Tuliskan organisasi dan jabatannya, misal: "Anggota OSIS", "Ketua Sekbid 1", "Anggota MPK".',
    },
    {
      kolom: 'Agama',
      wajib: 'WAJIB',
      ketentuan: 'Pilihan resmi: Islam, Kristen, Katolik, Hindu, Buddha, atau Konghucu.',
    },
    {
      kolom: 'Email (opsional)',
      wajib: 'OPSIONAL',
      ketentuan: 'Jika dikosongkan, sistem akan otomatis membuatkan email berbasis NIS: [nis]@sekolah.local.',
    },
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Buat file Excel kredensial awal (NIS, Nama, Email, Password Acak) yang dapat diunduh SEKALI oleh pengurus
 */
export async function generateCredentialsExcelBuffer(
  credentials: Array<{
    nis: string;
    nama: string;
    email: string;
    temporaryPassword: string;
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Kredensial Awal Siswa');

  sheet.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'NIS', key: 'nis', width: 16 },
    { header: 'Nama Lengkap', key: 'nama', width: 30 },
    { header: 'Email Akun Login', key: 'email', width: 35 },
    { header: 'Password Awal', key: 'password', width: 22 },
    { header: 'Keterangan', key: 'keterangan', width: 35 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF854D0E' }, // Warm amber
  };

  credentials.forEach((item, idx) => {
    sheet.addRow({
      no: idx + 1,
      nis: item.nis,
      nama: item.nama,
      email: item.email,
      password: item.temporaryPassword,
      keterangan: 'Wajib ganti password saat login pertama',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
