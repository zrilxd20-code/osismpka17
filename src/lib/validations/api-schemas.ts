// =====================================================================
// SKEMA VALIDASI ZOD DENGAN PESAN ERROR BAHASA INDONESIA
// =====================================================================

import { z } from 'zod';

export function formatZodError(error: unknown): string {
  const err = error as { issues?: Array<{ message: string }>; errors?: Array<{ message: string }>; message?: string };
  if (err?.issues && Array.isArray(err.issues)) {
    return err.issues.map((i) => i.message).join(' ');
  }
  if (err?.errors && Array.isArray(err.errors)) {
    return err.errors.map((e) => e.message).join(' ');
  }
  return err?.message || 'Validasi input gagal.';
}

export const CheckinSchema = z
  .object({
    jenis_ibadah_id: z.string().min(1, 'ID jenis ibadah wajib diisi.'),
    status: z.enum(['hadir', 'tidak_hadir', 'izin']),
    keterangan: z.string().trim().optional().nullable(),
    saksi: z.string().trim().max(150, 'Nama saksi maksimal 150 karakter.').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'izin' && (!data.keterangan || data.keterangan.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Keterangan alasan wajib dicantumkan jika status Anda adalah izin.',
      path: ['keterangan'],
    }
  );

export const VerifikasiSchema = z.object({
  status_verifikasi: z.enum(['valid', 'tidak_valid']),
  catatan_verifikasi: z.string().trim().max(500, 'Catatan verifikasi maksimal 500 karakter.').optional().nullable(),
});

export const InputManualSchema = z
  .object({
    profile_id: z.string().min(1, 'Pilih anggota siswa terlebih dahulu.'),
    jenis_ibadah_id: z.string().min(1, 'ID jenis ibadah wajib diisi.'),
    tanggal: z.string().min(1, 'Tanggal wajib diisi.').regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
    status: z.enum(['hadir', 'tidak_hadir', 'izin']),
    keterangan: z.string().trim().optional().nullable(),
    saksi: z.string().trim().max(150).optional().nullable(),
    catatan_verifikasi: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'izin' && (!data.keterangan || data.keterangan.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Keterangan alasan wajib dicantumkan jika status adalah izin.',
      path: ['keterangan'],
    }
  );

export const CekAcakGenerateSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.').optional(),
  jenis_ibadah_id: z.string().optional(),
  jumlah: z.number().int().min(1, 'Jumlah minimal 1 anggota.').max(20, 'Jumlah maksimal 20 anggota.').default(3),
});

export const CekAcakUpdateSchema = z.object({
  hasil: z.enum(['sesuai', 'tidak_sesuai']),
  catatan: z.string().trim().max(500, 'Catatan hasil cek maksimal 500 karakter.').optional().nullable(),
});

export const PelanggaranSchema = z.object({
  profile_id: z.string().min(1, 'ID siswa pelanggar wajib diisi.'),
  checkin_id: z.string().optional().nullable(),
  keterangan: z.string().trim().min(3, 'Keterangan pelanggaran minimal 3 karakter.'),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.').optional(),
});

export const JenisIbadahPatchSchema = z.object({
  jam_mulai: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format jam mulai harus HH:mm atau HH:mm:ss.'),
  jam_selesai: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format jam selesai (batas normal) harus HH:mm atau HH:mm:ss.'),
  jam_maksimal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format jam maksimal (batas toleransi) harus HH:mm atau HH:mm:ss.').optional(),
  hari_aktif: z.array(z.number().int().min(1).max(7), { message: 'Hari aktif harus berupa array angka 1 (Senin) hingga 7 (Minggu).' }).min(1, 'Paling sedikit pilih 1 hari aktif.'),
});

export const AnggotaCreateSchema = z.object({
  nis: z.string().trim().regex(/^\d+$/, 'NIS harus berupa deret angka.').min(4, 'NIS minimal 4 digit.').max(20, 'NIS maksimal 20 digit.'),
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(150, 'Nama maksimal 150 karakter.'),
  kelas: z.string().trim().min(2, 'Kelas minimal 2 karakter.').max(30),
  jabatan: z.string().trim().min(2, 'Jabatan minimal 2 karakter.').max(80),
  agama: z.enum(['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu']),
  role: z.enum(['anggota', 'pengurus', 'pembina']).default('anggota'),
  email: z.string().trim().email('Format email tidak valid.').optional().or(z.literal('')),
});

export const AnggotaUpdateSchema = AnggotaCreateSchema.partial();
