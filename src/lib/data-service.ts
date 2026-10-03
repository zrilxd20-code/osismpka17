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

const STORAGE_KEY_PROFILES = 'osis_mpk_ibadah_profiles_v1';
const STORAGE_KEY_PRESENSI = 'osis_mpk_ibadah_presensi_v1';
const STORAGE_KEY_SETTINGS = 'osis_mpk_ibadah_settings_v1';
const STORAGE_KEY_CHECKS = 'osis_mpk_ibadah_checks_v1';
const STORAGE_KEY_LOGS = 'osis_mpk_ibadah_logs_v1';
const STORAGE_KEY_CURRENT_USER = 'osis_mpk_ibadah_current_user_v1';

// Seed Awal Default
export const DEFAULT_PROFILES: Profile[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    nis: '2425001',
    nama: 'Fadhil Pratama',
    full_name: 'Fadhil Pratama',
    role: 'pengurus',
    agama: 'islam',
    organisasi: 'OSIS',
    jabatan: 'Koordinator Divisi Keagamaan',
    kelas: 'XI IPA 1',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    nis: '2425002',
    nama: 'Nadhira Aulia',
    full_name: 'Nadhira Aulia',
    role: 'pengurus',
    agama: 'islam',
    organisasi: 'MPK',
    jabatan: 'Komisi Kerohanian & Akhlak',
    kelas: 'XI IPS 2',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    nis: '2425003',
    nama: 'Ahmad Rizky',
    full_name: 'Ahmad Rizky',
    role: 'anggota',
    agama: 'islam',
    organisasi: 'OSIS',
    jabatan: 'Anggota Sekbid 1 (Bintal)',
    kelas: 'X-1',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    nis: '2425004',
    nama: 'Siti Sarah',
    full_name: 'Siti Sarah',
    role: 'anggota',
    agama: 'islam',
    organisasi: 'OSIS',
    jabatan: 'Anggota Sekbid Humas',
    kelas: 'X-3',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    nis: '2425005',
    nama: 'Daniel Christian',
    full_name: 'Daniel Christian',
    role: 'anggota',
    agama: 'kristen',
    organisasi: 'MPK',
    jabatan: 'Anggota Komisi Pengawasan',
    kelas: 'XI IPA 3',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    nis: '2425006',
    nama: 'Grace Gabriella',
    full_name: 'Grace Gabriella',
    role: 'anggota',
    agama: 'kristen',
    organisasi: 'OSIS',
    jabatan: 'Anggota Sekbid Seni & Budaya',
    kelas: 'X-2',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    nis: '2425007',
    nama: 'Muhammad Iqbal',
    full_name: 'Muhammad Iqbal',
    role: 'anggota',
    agama: 'islam',
    organisasi: 'MPK',
    jabatan: 'Anggota Komisi Kebijakan',
    kelas: 'XI IPS 1',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    nis: '2425008',
    nama: 'Maria Yosephin',
    full_name: 'Maria Yosephin',
    role: 'anggota',
    agama: 'katolik',
    organisasi: 'OSIS',
    jabatan: 'Anggota Sekbid IT & Publikasi',
    kelas: 'X-4',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    nis: '19850101',
    nama: 'Drs. H. Mulyadi, M.Pd.',
    full_name: 'Drs. H. Mulyadi, M.Pd.',
    role: 'pembina',
    agama: 'islam',
    organisasi: 'OSIS',
    jabatan: 'Pembina OSIS & Kesiswaan',
    kelas: 'Guru Pembina',
    aktif: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
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
      profile_id: '33333333-3333-3333-3333-333333333333',
      user_id: '33333333-3333-3333-3333-333333333333',
      tanggal: today,
      ibadah: 'sholat_dzuhur',
      status: 'hadir',
      saksi: 'Fadhil Pratama',
      waktu_checkin: `${today}T11:45:00+07:00`,
      dibuat_pada: `${today}T11:45:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'terverifikasi',
      catatan_pengurus: 'Tercatat di shaf kedua musholla',
      catatan_verifikasi: 'Tercatat di shaf kedua musholla',
      diverifikasi_oleh: '11111111-1111-1111-1111-111111111111',
      verified_by: '11111111-1111-1111-1111-111111111111',
      verified_at: `${today}T12:05:00+07:00`,
      created_at: `${today}T11:45:00+07:00`,
      updated_at: `${today}T12:05:00+07:00`,
    },
    {
      id: 'pre-2',
      profile_id: '44444444-4444-4444-4444-444444444444',
      user_id: '44444444-4444-4444-4444-444444444444',
      tanggal: today,
      ibadah: 'sholat_dzuhur',
      status: 'izin_halangan',
      keterangan: 'Halangan syar\'i (haid)',
      keterangan_halangan: 'Halangan syar\'i (haid)',
      waktu_checkin: `${today}T11:35:00+07:00`,
      dibuat_pada: `${today}T11:35:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'terverifikasi',
      catatan_pengurus: 'Dikonfirmasi izin',
      catatan_verifikasi: 'Dikonfirmasi izin',
      diverifikasi_oleh: '11111111-1111-1111-1111-111111111111',
      verified_by: '11111111-1111-1111-1111-111111111111',
      verified_at: `${today}T12:10:00+07:00`,
      created_at: `${today}T11:35:00+07:00`,
      updated_at: `${today}T12:10:00+07:00`,
    },
    {
      id: 'pre-3',
      profile_id: '55555555-5555-5555-5555-555555555555',
      user_id: '55555555-5555-5555-5555-555555555555',
      tanggal: today,
      ibadah: 'pendalaman_iman',
      status: 'hadir',
      saksi: 'Grace Gabriella',
      waktu_checkin: `${today}T12:00:00+07:00`,
      dibuat_pada: `${today}T12:00:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'menunggu',
      created_at: `${today}T12:00:00+07:00`,
      updated_at: `${today}T12:00:00+07:00`,
    },
    {
      id: 'pre-4',
      profile_id: '77777777-7777-7777-7777-777777777777',
      user_id: '77777777-7777-7777-7777-777777777777',
      tanggal: today,
      ibadah: 'sholat_dzuhur',
      status: 'hadir',
      saksi: 'Ahmad Rizky',
      waktu_checkin: `${today}T12:15:00+07:00`,
      dibuat_pada: `${today}T12:15:00+07:00`,
      input_mode: 'mandiri',
      status_verifikasi: 'menunggu',
      created_at: `${today}T12:15:00+07:00`,
      updated_at: `${today}T12:15:00+07:00`,
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

  public getCurrentUser(): Profile {
    const saved = this.getItem<Profile | null>(STORAGE_KEY_CURRENT_USER, null);
    if (saved) return saved;
    const def = DEFAULT_PROFILES[0];
    this.setCurrentUser(def);
    return def;
  }

  public setCurrentUser(user: Profile): void {
    this.setItem(STORAGE_KEY_CURRENT_USER, user);
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
      actor_name: this.getCurrentUser().full_name,
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
      actor_name: this.getCurrentUser().full_name,
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
    const pengurus = this.getCurrentUser();
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
    const pengurus = this.getCurrentUser();
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
    const pengurus = this.getCurrentUser();
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
        actor_name: 'Fadhil Pratama',
        action: 'VERIFIKASI',
        table_name: 'presensi_ibadah',
        details: { nis: '2425003', status: 'terverifikasi' },
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
