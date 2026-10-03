// Definisi Tipe Database & Entitas Sistem Ibadah OSIS & MPK (Sinkron Frontend & Backend)

export type UserRole = 'anggota' | 'pengurus' | 'pembina';
export type AgamaType = 'islam' | 'kristen' | 'katolik' | 'hindu' | 'buddha' | 'konghucu';
export type OrganisasiType = 'OSIS' | 'MPK';
export type IbadahType = 'sholat_dzuhur' | 'pendalaman_iman';

export type CheckinStatus = 'hadir' | 'tidak_hadir' | 'izin' | 'izin_halangan';
export type PresensiStatus = CheckinStatus;

export type StatusVerifikasi = 'menunggu' | 'valid' | 'tidak_valid' | 'terverifikasi' | 'ditolak' | 'pelanggaran';
export type VerifikasiStatus = StatusVerifikasi;

export type HasilCekAcak = 'sesuai' | 'tidak_sesuai' | 'belum_dicek';

export interface Profile {
  id: string;
  nis: string;
  nama: string;
  full_name: string; // Kompatibilitas frontend
  kelas: string;
  jabatan: string;
  organisasi: OrganisasiType;
  agama: AgamaType;
  role: UserRole;
  aktif: boolean;
  is_active: boolean; // Kompatibilitas frontend
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface JenisIbadah {
  id: string;
  nama: string;
  ibadah?: IbadahType; // Kompatibilitas frontend
  label: string;
  agama_wajib: string[];
  jam_mulai: string; // "11:30:00"
  jam_selesai: string; // "14:00:00"
  start_time: string; // Kompatibilitas frontend
  end_time: string;   // Kompatibilitas frontend
  hari_aktif: number[]; // [1, 2, 3, 4, 5]
  days_active: number[]; // Kompatibilitas frontend
  is_active: boolean;
  keterangan?: string;
  updated_by?: string;
  updated_at?: string;
  created_at?: string;
}
export type SettingsTimeWindow = JenisIbadah;

export interface Checkin {
  id: string;
  profile_id: string;
  user_id: string; // Kompatibilitas frontend
  jenis_ibadah_id?: string;
  ibadah?: IbadahType; // Kompatibilitas frontend
  tanggal: string; // "YYYY-MM-DD"
  status: CheckinStatus;
  keterangan?: string | null;
  keterangan_halangan?: string | null; // Kompatibilitas frontend
  saksi?: string | null;
  diverifikasi_oleh?: string | null;
  verified_by?: string | null; // Kompatibilitas frontend
  verified_at?: string | null;
  status_verifikasi: StatusVerifikasi;
  catatan_verifikasi?: string | null;
  catatan_pengurus?: string | null; // Kompatibilitas frontend
  input_mode?: 'mandiri' | 'manual_pengurus';
  waktu_checkin?: string; // Kompatibilitas frontend
  dibuat_pada: string;
  created_at?: string;
  updated_at?: string;

  // Joined relations
  profile?: Profile;
  verifier_profile?: Profile;
  jenis_ibadah?: JenisIbadah;
}
export type PresensiIbadah = Checkin;

export interface RandomCheckItem {
  user_id: string;
  nis: string;
  full_name: string;
  kelas: string;
  organisasi: OrganisasiType;
  status_cek: 'sesuai' | 'tidak_ada' | 'belum_dicek';
  catatan?: string;
}

export interface RandomCheckRecord {
  id: string;
  tanggal: string;
  ibadah: IbadahType;
  pengurus_id: string;
  target_count: number;
  selected_users: RandomCheckItem[];
  catatan?: string | null;
  created_at: string;
}

export interface CekAcak {
  id: string;
  tanggal: string;
  checkin_id: string;
  dicek_oleh: string;
  hasil: HasilCekAcak;
  catatan?: string | null;
  dibuat_pada: string;

  checkin?: Checkin;
  dicek_oleh_profile?: Profile;
}

export interface Pelanggaran {
  id: string;
  profile_id: string;
  checkin_id?: string | null;
  keterangan: string;
  dicatat_oleh: string;
  tanggal: string;
  dibuat_pada: string;

  profile?: Profile;
  dicatat_oleh_profile?: Profile;
}

export interface ImportBatch {
  id: string;
  nama_file: string;
  diunggah_oleh: string;
  total_baris: number;
  berhasil: number;
  gagal: number;
  laporan_error: Array<{
    baris?: number;
    rowNumber?: number;
    nis?: string;
    nama?: string;
    alasan: string;
  }>;
  dibuat_pada: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  actor_name?: string;
  aktor_id?: string | null;
  action?: string;
  aksi?: string;
  table_name?: string;
  tabel?: string;
  record_id?: string | null;
  details?: Record<string, unknown> | null;
  data_lama?: Record<string, unknown> | null;
  data_baru?: Record<string, unknown> | null;
  waktu?: string;
  created_at?: string;
}
export type AuditLogItem = AuditLog;
