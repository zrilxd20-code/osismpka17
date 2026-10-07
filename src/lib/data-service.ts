// Service Layer untuk Data Presensi Ibadah OSIS & MPK
// Mendukung Supabase Postgres secara live serta mode fallback interaktif lokal

import {
  Profile,
  PresensiIbadah,
  SettingsTimeWindow,
  RandomCheckRecord,
  AuditLog,
  IbadahType,
  PresensiStatus,
  VerifikasiStatus,
} from '@/types/database';
import { getTodayWIB, isWithinTimeWindow } from './time-utils';

const STORAGE_KEY_PROFILES = 'osis_mpk_ibadah_profiles_v3';
const STORAGE_KEY_PRESENSI = 'osis_mpk_ibadah_presensi_v3';
const STORAGE_KEY_SETTINGS = 'osis_mpk_ibadah_settings_v3';
const STORAGE_KEY_CHECKS = 'osis_mpk_ibadah_checks_v3';
const STORAGE_KEY_LOGS = 'osis_mpk_ibadah_logs_v3';
const STORAGE_KEY_CURRENT_USER = 'osis_mpk_ibadah_current_user_v3';
const STORAGE_KEY_PASSWORDS = 'osis_mpk_ibadah_passwords_v3';

// 39 ANGGOTA ASLI SESUAI REKAP MONITORING OSIS & MPK + 2 PEMBINA
export const DEFAULT_PROFILES: Profile[] = [
  { id: 'usr-01', nis: '2425001', nama: 'Adelia Nur Zahra', full_name: 'Adelia Nur Zahra', kelas: 'XI MP', organisasi: 'MPK', jabatan: 'Anggota MPK', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-02', nis: '2425002', nama: 'A Isy Mifta Nazhilfa', full_name: 'A Isy Mifta Nazhilfa', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-03', nis: '2425003', nama: 'Al Qoirul Lathif Nazzril Putra', full_name: 'Al Qoirul Lathif Nazzril Putra', kelas: 'X RPL', organisasi: 'OSIS', jabatan: 'Divisi Keagamaan OSIS', agama: 'islam', role: 'pengurus', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-04', nis: '2425004', nama: 'Amelia Putri', full_name: 'Amelia Putri', kelas: 'XI AK 1', organisasi: 'MPK', jabatan: 'Anggota MPK', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-05', nis: '2425005', nama: 'Amyra Nur Azalia', full_name: 'Amyra Nur Azalia', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-06', nis: '2425006', nama: 'Annisa Maulida Putri Hardiansyah', full_name: 'Annisa Maulida Putri Hardiansyah', kelas: 'XI AK 2', organisasi: 'MPK', jabatan: 'Anggota MPK', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-07', nis: '2425007', nama: 'Aulia Fitri', full_name: 'Aulia Fitri', kelas: 'X BR 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-08', nis: '2425008', nama: 'Bintang Very Purwanto', full_name: 'Bintang Very Purwanto', kelas: 'X RPL', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'kristen', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-09', nis: '2425009', nama: 'Dimas Putra Satria', full_name: 'Dimas Putra Satria', kelas: 'XI AK 2', organisasi: 'MPK', jabatan: 'Anggota MPK', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-10', nis: '2425010', nama: 'Fadhyl Alhafizd', full_name: 'Fadhyl Alhafizd', kelas: 'X RPL', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-11', nis: '2425011', nama: 'Hanivia Putria Idris', full_name: 'Hanivia Putria Idris', kelas: 'X BR 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-12', nis: '2425012', nama: 'Isya Al Faqih Hasan', full_name: 'Isya Al Faqih Hasan', kelas: 'X BR 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-13', nis: '2425013', nama: 'Jihada Amalia', full_name: 'Jihada Amalia', kelas: 'XI AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-14', nis: '2425014', nama: 'Jordhan Khadhil Setiawan', full_name: 'Jordhan Khadhil Setiawan', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-15', nis: '2425015', nama: 'Kartika Luna Amallya', full_name: 'Kartika Luna Amallya', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-16', nis: '2425016', nama: 'Keyla Ayu Fitriandini', full_name: 'Keyla Ayu Fitriandini', kelas: 'X MP', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-17', nis: '2425017', nama: 'Keysha Aurelia', full_name: 'Keysha Aurelia', kelas: 'X AK 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-18', nis: '2425018', nama: 'Maria Jame', full_name: 'Maria Jame', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Divisi Keagamaan OSIS (Kristen)', agama: 'kristen', role: 'pengurus', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-19', nis: '2425019', nama: 'Muhamad Faiq Adnan', full_name: 'Muhamad Faiq Adnan', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-20', nis: '2425020', nama: 'Muhamad Zidan Pirgyawan', full_name: 'Muhamad Zidan Pirgyawan', kelas: 'XI RPL', organisasi: 'MPK', jabatan: 'Anggota MPK', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-21', nis: '2425021', nama: 'Muhammad Dafa', full_name: 'Muhammad Dafa', kelas: 'XI BR', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-22', nis: '2425022', nama: 'Muhammad Faris', full_name: 'Muhammad Faris', kelas: 'XI BR', organisasi: 'OSIS', jabatan: 'Divisi Keagamaan OSIS', agama: 'islam', role: 'pengurus', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-23', nis: '2425023', nama: 'Muhammad Hafid Addison', full_name: 'Muhammad Hafid Addison', kelas: 'X AK 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-24', nis: '2425024', nama: 'Muhammad Irvan Hakim', full_name: 'Muhammad Irvan Hakim', kelas: 'XI RPL 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-25', nis: '2425025', nama: 'Nabila Firanisa Ramadhani', full_name: 'Nabila Firanisa Ramadhani', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-26', nis: '2425026', nama: 'Nisfa Alvia Rahmadany', full_name: 'Nisfa Alvia Rahmadany', kelas: 'X BR 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-27', nis: '2425027', nama: 'Novita Gendhis Pramesththi', full_name: 'Novita Gendhis Pramesththi', kelas: 'X MP', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-28', nis: '2425028', nama: 'Nur Efendy', full_name: 'Nur Efendy', kelas: 'X BR 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-29', nis: '2425029', nama: 'Oneal Pratama', full_name: 'Oneal Pratama', kelas: 'XI AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-30', nis: '2425030', nama: 'Polbe Seriota Sihite', full_name: 'Polbe Seriota Sihite', kelas: 'XI AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'kristen', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-31', nis: '2425031', nama: 'Rafifah Salsabila Zahra', full_name: 'Rafifah Salsabila Zahra', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-32', nis: '2425032', nama: 'Rifky Aditya Hadi', full_name: 'Rifky Aditya Hadi', kelas: 'XI AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-33', nis: '2425033', nama: 'Sahal Kholidil Azam', full_name: 'Sahal Kholidil Azam', kelas: 'XI RPL 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-34', nis: '2425034', nama: 'Selli Edelweiss Salsabila', full_name: 'Selli Edelweiss Salsabila', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-35', nis: '2425035', nama: 'Shania Aurelia Syarief', full_name: 'Shania Aurelia Syarief', kelas: 'X AK 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-36', nis: '2425036', nama: 'Sisca Aulia Rahmadani', full_name: 'Sisca Aulia Rahmadani', kelas: 'X BR 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-37', nis: '2425037', nama: 'Syafira Aulia', full_name: 'Syafira Aulia', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-38', nis: '2425038', nama: 'Zakiya Innayati', full_name: 'Zakiya Innayati', kelas: 'X BR 2', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-39', nis: '2425039', nama: 'Zhiva Iqnantia Nandini', full_name: 'Zhiva Iqnantia Nandini', kelas: 'X AK 1', organisasi: 'OSIS', jabatan: 'Anggota OSIS', agama: 'islam', role: 'anggota', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-98', nis: '19800101', nama: 'Nurkholis Aiman', full_name: 'Nurkholis Aiman', kelas: 'Guru Pembina', organisasi: 'OSIS', jabatan: 'Pembina OSIS', agama: 'islam', role: 'pembina', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'usr-99', nis: '19850202', nama: 'Maria Ulfa', full_name: 'Maria Ulfa', kelas: 'Guru Pembina', organisasi: 'MPK', jabatan: 'Pembina MPK', agama: 'islam', role: 'pembina', aktif: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const DEFAULT_SETTINGS: SettingsTimeWindow[] = [
  {
    id: 'setting-dzuhur-1',
    nama: 'sholat_dzuhur',
    ibadah: 'sholat_dzuhur',
    label: 'Sholat Dzuhur Berjamaah',
    agama_wajib: ['islam'],
    jam_mulai: '11:30:00',
    jam_selesai: '14:00:00',
    start_time: '11:30:00',
    end_time: '14:00:00',
    is_active: true,
    hari_aktif: [1, 2, 3, 4, 5],
    days_active: [1, 2, 3, 4, 5],
    keterangan: 'Musholla Utama SMA (WIB)',
  },
  {
    id: 'setting-iman-2',
    nama: 'pendalaman_iman',
    ibadah: 'pendalaman_iman',
    label: 'Pendalaman Iman Kristen/Katolik',
    agama_wajib: ['kristen', 'katolik'],
    jam_mulai: '11:45:00',
    jam_selesai: '13:45:00',
    start_time: '11:45:00',
    end_time: '13:45:00',
    is_active: true,
    hari_aktif: [1, 2, 3, 4, 5],
    days_active: [1, 2, 3, 4, 5],
    keterangan: 'Ruang Agama Kristen & Katolik (WIB)',
  },
];

function getInitialPresensi(): PresensiIbadah[] {
  const today = getTodayWIB();
  return [
    {
      id: 'pre-1',
      profile_id: 'usr-02',
      user_id: 'usr-02',
      tanggal: today,
      ibadah: 'sholat_dzuhur',
      status: 'hadir',
      saksi: 'Al Qoirul Lathif Nazzril Putra',
      waktu_checkin: `${today}T11:45:00+07:00`,
      dibuat_pada: `${today}T11:45:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'terverifikasi',
      catatan_pengurus: 'Tercatat di musholla',
      catatan_verifikasi: 'Tercatat di musholla',
      diverifikasi_oleh: 'usr-03',
      verified_by: 'usr-03',
      verified_at: `${today}T12:05:00+07:00`,
      created_at: `${today}T11:45:00+07:00`,
      updated_at: `${today}T12:05:00+07:00`,
    },
    {
      id: 'pre-2',
      profile_id: 'usr-05',
      user_id: 'usr-05',
      tanggal: today,
      ibadah: 'sholat_dzuhur',
      status: 'izin_halangan',
      keterangan: 'Halangan syar\'i (haid)',
      keterangan_halangan: 'Halangan syar\'i (haid)',
      waktu_checkin: `${today}T11:35:00+07:00`,
      dibuat_pada: `${today}T11:35:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'terverifikasi',
      catatan_pengurus: 'Dikonfirmasi',
      catatan_verifikasi: 'Dikonfirmasi',
      diverifikasi_oleh: 'usr-03',
      verified_by: 'usr-03',
      verified_at: `${today}T12:10:00+07:00`,
      created_at: `${today}T11:35:00+07:00`,
      updated_at: `${today}T12:10:00+07:00`,
    },
    {
      id: 'pre-3',
      profile_id: 'usr-08',
      user_id: 'usr-08',
      tanggal: today,
      ibadah: 'pendalaman_iman',
      status: 'hadir',
      saksi: 'Maria Jame',
      waktu_checkin: `${today}T12:00:00+07:00`,
      dibuat_pada: `${today}T12:00:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'menunggu',
      created_at: `${today}T12:00:00+07:00`,
      updated_at: `${today}T12:00:00+07:00`,
    },
    {
      id: 'pre-4',
      profile_id: 'usr-18',
      user_id: 'usr-18',
      tanggal: today,
      ibadah: 'pendalaman_iman',
      status: 'hadir',
      saksi: 'Bintang Very',
      waktu_checkin: `${today}T12:05:00+07:00`,
      dibuat_pada: `${today}T12:05:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'menunggu',
      created_at: `${today}T12:05:00+07:00`,
      updated_at: `${today}T12:05:00+07:00`,
    },
  ];
}

class DataService {
  private isBrowser = typeof window !== 'undefined';

  private getItem<T>(key: string, defaultVal: T): T {
    if (!this.isBrowser) return defaultVal;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to set localStorage', e);
    }
  }

  // --- AUTH & PROFILE ---
  public getProfiles(): Profile[] {
    return this.getItem<Profile[]>(STORAGE_KEY_PROFILES, DEFAULT_PROFILES);
  }

  public getProfileById(id: string): Profile | undefined {
    return this.getProfiles().find((p) => p.id === id);
  }

  public getProfileByNis(nis: string): Profile | undefined {
    return this.getProfiles().find((p) => p.nis.trim() === nis.trim());
  }

  public getProfileByNisOrName(query: string): Profile | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    const profiles = this.getProfiles();

    // 1. Match NIS / NISN
    let match = profiles.find((p) => p.nis.trim().toLowerCase() === q);
    if (match) return match;

    // 2. Match Exact Nama Lengkap
    match = profiles.find((p) => 
      (p.nama && p.nama.trim().toLowerCase() === q) || 
      (p.full_name && p.full_name.trim().toLowerCase() === q)
    );
    if (match) return match;

    // 3. Match Starts With
    match = profiles.find((p) => 
      (p.nama && p.nama.toLowerCase().startsWith(q)) || 
      (p.full_name && p.full_name.toLowerCase().startsWith(q))
    );
    if (match) return match;

    // 4. Match Substring
    return profiles.find((p) => 
      (p.nama && p.nama.toLowerCase().includes(q)) || 
      (p.full_name && p.full_name.toLowerCase().includes(q))
    );
  }

  public getProfileByName(name: string): Profile | undefined {
    const q = name.trim().toLowerCase();
    if (!q) return undefined;
    const profiles = this.getProfiles();

    // 1. Match Exact Nama Lengkap
    let match = profiles.find((p) => 
      (p.nama && p.nama.trim().toLowerCase() === q) || 
      (p.full_name && p.full_name.trim().toLowerCase() === q)
    );
    if (match) return match;

    // 2. Match Starts With
    match = profiles.find((p) => 
      (p.nama && p.nama.toLowerCase().startsWith(q)) || 
      (p.full_name && p.full_name.toLowerCase().startsWith(q))
    );
    if (match) return match;

    // 3. Match Substring
    return profiles.find((p) => 
      (p.nama && p.nama.toLowerCase().includes(q)) || 
      (p.full_name && p.full_name.toLowerCase().includes(q))
    );
  }

  public searchProfilesByName(query: string, limit = 6): Profile[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.getProfiles()
      .filter((p) => 
        (p.nama && p.nama.toLowerCase().includes(q)) ||
        (p.full_name && p.full_name.toLowerCase().includes(q))
      )
      .slice(0, limit);
  }

  public getPasswords(): Record<string, string> {
    return this.getItem<Record<string, string>>(STORAGE_KEY_PASSWORDS, {});
  }

  public setPassword(userId: string, newPass: string): void {
    const map = this.getPasswords();
    map[userId] = newPass;
    this.setItem(STORAGE_KEY_PASSWORDS, map);
  }

  public verifyPassword(user: Profile, passInput: string): boolean {
    const trimmed = passInput.trim();
    if (!trimmed) return false;
    const map = this.getPasswords();
    const stored = map[user.id];
    if (stored) {
      return stored === trimmed;
    }
    // Default password jika belum pernah diubah:
    // Password resmi: 'osismpka17' (fallback fleksibel '123456', 'osis17', atau nomor NIS-nya)
    return trimmed === 'osismpka17' || trimmed === '123456' || trimmed === 'osis17' || trimmed === user.nis;
  }

  public getCurrentUser(): Profile | null {
    return this.getItem<Profile | null>(STORAGE_KEY_CURRENT_USER, null);
  }

  public setCurrentUser(user: Profile): void {
    this.setItem(STORAGE_KEY_CURRENT_USER, user);
  }

  public logout(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch (e) {
      console.error('Failed to logout', e);
    }
  }

  public addProfile(newProfile: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'nama' | 'aktif'> & { nama?: string; aktif?: boolean }): Profile {
    const profiles = this.getProfiles();
    const created: Profile = {
      ...newProfile,
      id: 'usr-' + Math.random().toString(36).substring(2, 9),
      nama: newProfile.nama || newProfile.full_name,
      full_name: newProfile.full_name || newProfile.nama || '',
      aktif: newProfile.aktif !== undefined ? newProfile.aktif : (newProfile.is_active !== undefined ? newProfile.is_active : true),
      is_active: newProfile.is_active !== undefined ? newProfile.is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    profiles.push(created);
    this.setItem(STORAGE_KEY_PROFILES, profiles);

    this.logAudit({
      actor_name: this.getCurrentUser()?.full_name || 'Pengurus OSIS',
      action: 'TAMBAH_ANGGOTA',
      table_name: 'profiles',
      record_id: created.id,
      details: { nis: created.nis, nama: created.full_name, role: created.role },
    });

    return created;
  }

  // --- SETTINGS JENDELA WAKTU ---
  public getSettings(): SettingsTimeWindow[] {
    return this.getItem<SettingsTimeWindow[]>(STORAGE_KEY_SETTINGS, DEFAULT_SETTINGS);
  }

  public updateSetting(ibadah: IbadahType, updates: Partial<SettingsTimeWindow>): void {
    const settings = this.getSettings().map((s) => (s.ibadah === ibadah ? { ...s, ...updates, updated_at: new Date().toISOString() } : s));
    this.setItem(STORAGE_KEY_SETTINGS, settings);

    this.logAudit({
      actor_name: this.getCurrentUser()?.full_name || 'Pengurus OSIS',
      action: 'UPDATE_JENDELA_WAKTU',
      table_name: 'settings_time_windows',
      details: { ibadah, ...updates },
    });
  }

  // --- PRESENSI ---
  public getPresensiList(dateFilter?: string): PresensiIbadah[] {
    const list = this.getItem<PresensiIbadah[]>(STORAGE_KEY_PRESENSI, getInitialPresensi());
    const profiles = this.getProfiles();

    const withProfiles = list.map((item) => {
      const uId = item.profile_id || item.user_id;
      const vId = item.diverifikasi_oleh || item.verified_by;
      return {
        ...item,
        profile_id: uId,
        user_id: uId,
        diverifikasi_oleh: vId,
        verified_by: vId,
        profile: profiles.find((p) => p.id === uId),
        verifier_profile: vId ? profiles.find((p) => p.id === vId) : undefined,
      };
    });

    if (dateFilter) {
      return withProfiles.filter((p) => p.tanggal === dateFilter);
    }
    return withProfiles;
  }

  public getPresensiByUser(userId: string): PresensiIbadah[] {
    const list = this.getPresensiList();
    return list.filter((p) => (p.profile_id || p.user_id) === userId).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }

  public checkInMandiri(params: {
    userId: string;
    ibadah: IbadahType;
    status: PresensiStatus;
    keteranganHalangan?: string;
    saksi?: string;
    bypassTimeCheck?: boolean;
  }): { success: boolean; message: string; data?: PresensiIbadah } {
    const today = getTodayWIB();
    const settings = this.getSettings().find((s) => (s.nama === params.ibadah || s.ibadah === params.ibadah));

    if (settings && settings.is_active) {
      const windowCheck = isWithinTimeWindow(
        settings.start_time || settings.jam_mulai,
        settings.end_time || settings.jam_selesai,
        settings.days_active || settings.hari_aktif,
        params.bypassTimeCheck
      );
      if (!windowCheck.isOpen) {
        return {
          success: false,
          message: windowCheck.reason || 'Jendela waktu check-in belum dibuka atau sudah lewat.',
        };
      }
    }

    const existing = this.getPresensiList().find(
      (p) => (p.profile_id || p.user_id) === params.userId && p.tanggal === today && (p.ibadah === params.ibadah || p.jenis_ibadah_id === params.ibadah)
    );

    if (existing) {
      return {
        success: false,
        message: 'Anda sudah melakukan check-in untuk ibadah ini hari ini.',
      };
    }

    const presensiList = this.getItem<PresensiIbadah[]>(STORAGE_KEY_PRESENSI, getInitialPresensi());
    const profile = this.getProfileById(params.userId);

    const now = new Date().toISOString();
    const newRecord: PresensiIbadah = {
      id: 'pre-' + Math.random().toString(36).substring(2, 9),
      profile_id: params.userId,
      user_id: params.userId,
      tanggal: today,
      ibadah: params.ibadah,
      status: params.status,
      keterangan: params.keteranganHalangan || null,
      keterangan_halangan: params.keteranganHalangan || null,
      saksi: params.saksi?.trim() || null,
      waktu_checkin: now,
      dibuat_pada: now,
      input_mode: 'mandiri',
      status_verifikasi: 'menunggu',
      created_at: now,
      updated_at: now,
    };

    presensiList.unshift(newRecord);
    this.setItem(STORAGE_KEY_PRESENSI, presensiList);

    this.logAudit({
      user_id: params.userId,
      actor_name: profile?.full_name || 'Anggota',
      action: 'CHECKIN',
      table_name: 'presensi_ibadah',
      record_id: newRecord.id,
      details: { ibadah: params.ibadah, status: params.status, saksi: params.saksi },
    });

    return {
      success: true,
      message: 'Check-in berhasil dikirim. Menunggu verifikasi pengurus.',
      data: newRecord,
    };
  }

  public inputManualPengurus(params: {
    targetUserId: string;
    tanggal: string;
    ibadah: IbadahType;
    status: PresensiStatus;
    keteranganHalangan?: string;
    catatanPengurus?: string;
  }): { success: boolean; message: string; data?: PresensiIbadah } {
    const pengurus = this.getCurrentUser() || DEFAULT_PROFILES[2];
    const presensiList = this.getItem<PresensiIbadah[]>(STORAGE_KEY_PRESENSI, getInitialPresensi());

    const existingIndex = presensiList.findIndex(
      (p) => (p.profile_id || p.user_id) === params.targetUserId && p.tanggal === params.tanggal && (p.ibadah === params.ibadah)
    );

    const now = new Date().toISOString();
    let record: PresensiIbadah;

    if (existingIndex >= 0) {
      record = {
        ...presensiList[existingIndex],
        status: params.status,
        keterangan: params.keteranganHalangan || null,
        keterangan_halangan: params.keteranganHalangan || null,
        catatan_verifikasi: params.catatanPengurus || 'Diinput manual oleh pengurus',
        catatan_pengurus: params.catatanPengurus || 'Diinput manual oleh pengurus',
        status_verifikasi: 'terverifikasi',
        diverifikasi_oleh: pengurus.id,
        verified_by: pengurus.id,
        verified_at: now,
        input_mode: 'manual_pengurus',
        updated_at: now,
      };
      presensiList[existingIndex] = record;
    } else {
      record = {
        id: 'pre-' + Math.random().toString(36).substring(2, 9),
        profile_id: params.targetUserId,
        user_id: params.targetUserId,
        tanggal: params.tanggal,
        ibadah: params.ibadah,
        status: params.status,
        keterangan: params.keteranganHalangan || null,
        keterangan_halangan: params.keteranganHalangan || null,
        saksi: null,
        waktu_checkin: now,
        dibuat_pada: now,
        input_mode: 'manual_pengurus',
        status_verifikasi: 'terverifikasi',
        catatan_verifikasi: params.catatanPengurus || 'Diinput manual oleh pengurus',
        catatan_pengurus: params.catatanPengurus || 'Diinput manual oleh pengurus',
        diverifikasi_oleh: pengurus.id,
        verified_by: pengurus.id,
        verified_at: now,
        created_at: now,
        updated_at: now,
      };
      presensiList.unshift(record);
    }

    this.setItem(STORAGE_KEY_PRESENSI, presensiList);

    const targetProfile = this.getProfileById(params.targetUserId);
    this.logAudit({
      user_id: pengurus.id,
      actor_name: pengurus.full_name,
      action: 'INPUT_MANUAL',
      table_name: 'presensi_ibadah',
      record_id: record.id,
      details: { target: targetProfile?.full_name, status: params.status, tanggal: params.tanggal },
    });

    return { success: true, message: 'Presensi berhasil disimpan oleh pengurus.', data: record };
  }

  public updateVerifikasi(
    presensiId: string,
    statusVerifikasi: VerifikasiStatus,
    catatan?: string
  ): { success: boolean; message: string } {
    const pengurus = this.getCurrentUser() || DEFAULT_PROFILES[2];
    const presensiList = this.getItem<PresensiIbadah[]>(STORAGE_KEY_PRESENSI, getInitialPresensi());
    const index = presensiList.findIndex((p) => p.id === presensiId);

    if (index === -1) {
      return { success: false, message: 'Data presensi tidak ditemukan.' };
    }

    const now = new Date().toISOString();
    presensiList[index] = {
      ...presensiList[index],
      status_verifikasi: statusVerifikasi,
      catatan_verifikasi: catatan || presensiList[index].catatan_verifikasi || null,
      catatan_pengurus: catatan || presensiList[index].catatan_pengurus || null,
      diverifikasi_oleh: pengurus.id,
      verified_by: pengurus.id,
      verified_at: now,
      updated_at: now,
    };

    this.setItem(STORAGE_KEY_PRESENSI, presensiList);

    const actionName = statusVerifikasi === 'pelanggaran' ? 'FLAG_PELANGGARAN' : 'VERIFIKASI';
    this.logAudit({
      user_id: pengurus.id,
      actor_name: pengurus.full_name,
      action: actionName,
      table_name: 'presensi_ibadah',
      record_id: presensiId,
      details: { status_verifikasi: statusVerifikasi, catatan },
    });

    return {
      success: true,
      message: statusVerifikasi === 'pelanggaran' ? 'Ditandai sebagai pelanggaran.' : 'Status verifikasi berhasil diperbarui.',
    };
  }

  // --- PENGECEKAN ACAK (RANDOM CHECKS) ---
  public getRandomChecks(): RandomCheckRecord[] {
    return this.getItem<RandomCheckRecord[]>(STORAGE_KEY_CHECKS, []);
  }

  public generateRandomCheck(ibadah: IbadahType, targetCount: number = 3): RandomCheckRecord {
    const pengurus = this.getCurrentUser() || DEFAULT_PROFILES[2];
    const today = getTodayWIB();
    const profiles = this.getProfiles().filter((p) => {
      if (!p.is_active || p.role === 'pembina') return false;
      if (ibadah === 'sholat_dzuhur') return p.agama === 'islam';
      return p.agama === 'kristen' || p.agama === 'katolik';
    });

    const shuffled = [...profiles].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(targetCount, profiles.length));

    const checkRecord: RandomCheckRecord = {
      id: 'chk-' + Math.random().toString(36).substring(2, 9),
      tanggal: today,
      ibadah,
      pengurus_id: pengurus.id,
      target_count: selected.length,
      selected_users: selected.map((u) => ({
        user_id: u.id,
        nis: u.nis,
        full_name: u.full_name,
        kelas: u.kelas,
        organisasi: u.organisasi,
        status_cek: 'belum_dicek',
      })),
      created_at: new Date().toISOString(),
    };

    const checks = this.getRandomChecks();
    checks.unshift(checkRecord);
    this.setItem(STORAGE_KEY_CHECKS, checks);

    return checkRecord;
  }

  public updateRandomCheckItem(
    checkId: string,
    userId: string,
    statusCek: 'sesuai' | 'tidak_ada',
    catatan?: string
  ): void {
    const checks = this.getRandomChecks();
    const check = checks.find((c) => c.id === checkId);
    if (!check) return;

    const item = check.selected_users.find((u: { user_id: string }) => u.user_id === userId);
    if (item) {
      item.status_cek = statusCek;
      if (catatan) item.catatan = catatan;
    }

    this.setItem(STORAGE_KEY_CHECKS, checks);
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return this.getItem<AuditLog[]>(STORAGE_KEY_LOGS, [
      {
        id: 'log-1',
        actor_name: 'Al Qoirul Lathif Nazzril Putra',
        action: 'VERIFIKASI',
        table_name: 'presensi_ibadah',
        details: { nis: '2425002', status: 'terverifikasi' },
        created_at: `${getTodayWIB()}T12:05:00+07:00`,
      },
    ]);
  }

  private logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.setItem(STORAGE_KEY_LOGS, logs.slice(0, 100));
  }

  public resetToDefault(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(STORAGE_KEY_PROFILES);
    localStorage.removeItem(STORAGE_KEY_PRESENSI);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_CHECKS);
    localStorage.removeItem(STORAGE_KEY_LOGS);
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }
}

export const dataService = new DataService();
