'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Profile,
  PresensiIbadah,
  SettingsTimeWindow,
  IbadahType,
  PresensiStatus,
  VerifikasiStatus,
  RandomCheckRecord,
  AuditLog,
} from '@/types/database';
import { dataService } from '@/lib/data-service';
import {
  getTodayWIB,
  formatTanggalIndonesia,
  formatJamWIB,
  getDetailHariWIB,
  isHariJumat,
} from '@/lib/time-utils';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import {
  CheckCircle,
  AlertTriangle,
  UserX,
  PlusCircle,
  Dices,
  FileSpreadsheet,
  FileText,
  Clock,
  Search,
  SlidersHorizontal,
  History,
  UserPlus,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Database,
  Calendar,
} from 'lucide-react';

interface PengurusViewProps {
  currentUser: Profile;
  onRefreshData?: () => void;
}

export default function PengurusView({ currentUser, onRefreshData }: PengurusViewProps) {
  const [activeTab, setActiveTab] = useState<
    'monitoring' | 'manual' | 'random' | 'rekap' | 'settings' | 'audit'
  >('monitoring');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presensiList, setPresensiList] = useState<PresensiIbadah[]>([]);
  const [_settings, setSettings] = useState<SettingsTimeWindow[]>([]);
  const [_randomChecks, setRandomChecks] = useState<RandomCheckRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filters for Monitoring
  const [selectedDate, setSelectedDate] = useState<string>(getTodayWIB());
  const [filterOrg, setFilterOrg] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pelanggaran Modal State
  const [flagModalOpen, setFlagModalOpen] = useState<boolean>(false);
  const [selectedPresensiForFlag, setSelectedPresensiForFlag] = useState<PresensiIbadah | null>(null);
  const [pelanggaranNote, setPelanggaranNote] = useState<string>('');

  // Manual Input State
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(getTodayWIB());
  const [manualIbadah, setManualIbadah] = useState<IbadahType>('sholat_dzuhur');
  const [manualStatus, setManualStatus] = useState<PresensiStatus>('hadir');
  const [manualKeterangan, setManualKeterangan] = useState<string>('');
  const [manualCatatan, setManualCatatan] = useState<string>('Diverifikasi langsung oleh pengurus');

  // Random Check State
  const [randomIbadah, setRandomIbadah] = useState<IbadahType>('sholat_dzuhur');
  const [randomCount, setRandomCount] = useState<number>(3);
  const [activeRandomCheck, setActiveRandomCheck] = useState<RandomCheckRecord | null>(null);

  // Settings State
  const [editDzuhurStart, setEditDzuhurStart] = useState<string>('11:30');
  const [editDzuhurEnd, setEditDzuhurEnd] = useState<string>('18:00');
  const [editDzuhurMax, setEditDzuhurMax] = useState<string>('21:00');
  const [editImanStart, setEditImanStart] = useState<string>('11:45');
  const [editImanEnd, setEditImanEnd] = useState<string>('18:00');
  const [editImanMax, setEditImanMax] = useState<string>('21:00');

  // Add Member State
  const [newNis, setNewNis] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<Profile['role']>('anggota');
  const [newAgama, setNewAgama] = useState<Profile['agama']>('islam');
  const [newOrg, setNewOrg] = useState<Profile['organisasi']>('OSIS');
  const [newJabatan, setNewJabatan] = useState<string>('Anggota Sekbid');
  const [newKelas, setNewKelas] = useState<string>('X-1');

  // Alert Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Rekap Export Filter State (Per Hari / Per Minggu / Per Bulan / Semua)
  const [rekapPeriod, setRekapPeriod] = useState<'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'>('bulan_ini');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAllData = () => {
    const prfs = dataService.getProfiles();
    const pres = dataService.getPresensiList();
    const stt = dataService.getSettings();
    const chk = dataService.getRandomChecks();
    const lgs = dataService.getAuditLogs();

    setProfiles(prfs);
    setPresensiList(pres);
    setSettings(stt);
    setRandomChecks(chk);
    setAuditLogs(lgs);

    if (chk.length > 0) {
      setActiveRandomCheck(chk[0]);
    }

    // Set settings initial inputs
    const dz = stt.find((s) => s.ibadah === 'sholat_dzuhur');
    if (dz) {
      setEditDzuhurStart(dz.start_time.slice(0, 5));
      setEditDzuhurEnd((dz.end_time || '18:00').slice(0, 5));
      setEditDzuhurMax((dz.max_end_time || dz.jam_maksimal || '21:00').slice(0, 5));
    }
    const im = stt.find((s) => s.ibadah === 'pendalaman_iman');
    if (im) {
      setEditImanStart(im.start_time.slice(0, 5));
      setEditImanEnd((im.end_time || '18:00').slice(0, 5));
      setEditImanMax((im.max_end_time || im.jam_maksimal || '21:00').slice(0, 5));
    }
  };

  const triggerCloudSync = async (silent = false) => {
    if (!silent) setIsCloudSyncing(true);
    try {
      const res = await dataService.syncFromCloud();
      setLastSyncTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      loadAllData();
      if (!silent) {
        showToast(
          res.success
            ? `Berhasil disinkronkan (${res.count} presensi live di cloud).`
            : 'Sinkronisasi cloud selesai.'
        );
      }
    } catch (e) {
      console.warn('Sync failed:', e);
      if (!silent) showToast('Kendala jaringan saat sinkronisasi cloud.');
    } finally {
      if (!silent) setIsCloudSyncing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    triggerCloudSync(true);

    // Langganan update jika background sync selesai
    const unsubscribe = dataService.subscribeSync(() => {
      loadAllData();
      setLastSyncTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    });

    // Polling background setiap 10 detik agar checkin dari smartphone anggota langsung muncul
    const interval = setInterval(() => {
      dataService.syncFromCloud();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Filtered members list
  const activeMembers = useMemo(() => {
    return profiles.filter((p) => p.is_active && p.role !== 'pembina');
  }, [profiles]);

  // Attendance for selected date
  const selectedDatePresensi = useMemo(() => {
    return presensiList.filter((p) => p.tanggal === selectedDate);
  }, [presensiList, selectedDate]);

  // Info kalender & sistem hari Jumat untuk tanggal terpilih
  const hariInfoSelected = useMemo(() => {
    return getDetailHariWIB(selectedDate);
  }, [selectedDate]);

  // Identifikasi Anggota yang BELUM Check-in pada tanggal terpilih
  const uncheckinMembers = useMemo(() => {
    return activeMembers.filter((member) => {
      const targetIbadah: IbadahType = member.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman';
      const hasPresensi = selectedDatePresensi.some(
        (p) => p.user_id === member.id && p.ibadah === targetIbadah
      );
      return !hasPresensi;
    });
  }, [activeMembers, selectedDatePresensi]);

  // Filtered Presensi for Table
  const filteredPresensi = useMemo(() => {
    return selectedDatePresensi.filter((item) => {
      const matchOrg = filterOrg === 'semua' || item.profile?.organisasi === filterOrg;
      const matchSearch =
        !searchQuery.trim() ||
        (item.profile?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.profile?.nis.includes(searchQuery) ?? false);
      return matchOrg && matchSearch;
    });
  }, [selectedDatePresensi, filterOrg, searchQuery]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = activeMembers.length;
    const hadir = selectedDatePresensi.filter((p) => p.status === 'hadir').length;
    const izin = selectedDatePresensi.filter((p) => p.status === 'izin_halangan').length;
    const tidakHadir = selectedDatePresensi.filter((p) => p.status === 'tidak_hadir').length;
    const pendingVerif = selectedDatePresensi.filter((p) => p.status_verifikasi === 'menunggu').length;
    const belum = uncheckinMembers.length;
    const percentHadir = total > 0 ? Math.round(((hadir + izin) / total) * 100) : 0;

    return { total, hadir, izin, tidakHadir, pendingVerif, belum, percentHadir };
  }, [activeMembers, selectedDatePresensi, uncheckinMembers]);

  // Data Rekapitulasi Berdasarkan Periode Terpilih (Per Hari / Minggu / Bulan / Semua)
  const rekapData = useMemo(() => {
    const today = getTodayWIB();
    if (rekapPeriod === 'hari_ini') {
      const list = presensiList.filter((p) => p.tanggal === today);
      return {
        list,
        label: `Per Hari (${formatTanggalIndonesia(today)})`,
        fileSuffix: `Harian_${today}`,
      };
    }
    if (rekapPeriod === 'minggu_ini') {
      const todayDate = new Date(today);
      const sevenDaysAgo = new Date(todayDate);
      sevenDaysAgo.setDate(todayDate.getDate() - 7);
      const minDateStr = sevenDaysAgo.toISOString().slice(0, 10);
      const list = presensiList.filter((p) => p.tanggal >= minDateStr && p.tanggal <= today);
      return {
        list,
        label: `Per Minggu (7 Hari: ${minDateStr} s/d ${today})`,
        fileSuffix: `Mingguan_${minDateStr}_sd_${today}`,
      };
    }
    if (rekapPeriod === 'bulan_ini') {
      const yearMonth = today.slice(0, 7);
      const list = presensiList.filter((p) => p.tanggal.startsWith(yearMonth));
      return {
        list,
        label: `Per Bulan (${yearMonth})`,
        fileSuffix: `Bulanan_${yearMonth}`,
      };
    }
    return {
      list: presensiList,
      label: 'Semua Riwayat (Kumulatif)',
      fileSuffix: 'Semua_Riwayat',
    };
  }, [presensiList, rekapPeriod]);

  // Aksi Verifikasi
  const handleVerify = (id: string, statusVerifikasi: VerifikasiStatus, note?: string) => {
    const res = dataService.updateVerifikasi(id, statusVerifikasi, note);
    showToast(res.message);
    loadAllData();
    if (onRefreshData) onRefreshData();
  };

  // Tandai Cepat "Tidak Hadir" untuk anggota yang belum check-in
  const handleMarkAbsent = (member: Profile) => {
    const ibadah: IbadahType = member.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman';
    dataService.inputManualPengurus({
      targetUserId: member.id,
      tanggal: selectedDate,
      ibadah,
      status: 'tidak_hadir',
      catatanPengurus: 'Ditandai Tidak Hadir oleh pengurus (tidak check-in hingga batas waktu)',
    });
    showToast(`${member.full_name} ditandai Tidak Hadir.`);
    loadAllData();
    if (onRefreshData) onRefreshData();
  };

  // Konfirmasi Pelanggaran
  const handleConfirmFlagPelanggaran = () => {
    if (!selectedPresensiForFlag) return;
    if (!pelanggaranNote.trim()) {
      alert('Mohon tulis catatan bukti/alasan pelanggaran.');
      return;
    }
    handleVerify(selectedPresensiForFlag.id, 'pelanggaran', pelanggaranNote);
    setFlagModalOpen(false);
    setSelectedPresensiForFlag(null);
    setPelanggaranNote('');
  };

  // Submit Manual Input
  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId) {
      alert('Pilih anggota terlebih dahulu.');
      return;
    }

    const res = dataService.inputManualPengurus({
      targetUserId: manualUserId,
      tanggal: manualDate,
      ibadah: manualIbadah,
      status: manualStatus,
      keteranganHalangan: manualStatus === 'izin_halangan' ? manualKeterangan : undefined,
      catatanPengurus: manualCatatan,
    });

    showToast(res.message);
    loadAllData();
    setManualUserId('');
    setManualKeterangan('');
    setActiveTab('monitoring');
  };

  // Generate Pengecekan Acak
  const handleGenerateRandom = () => {
    const rec = dataService.generateRandomCheck(randomIbadah, randomCount);
    setActiveRandomCheck(rec);
    showToast(`Berhasil mengacak ${rec.selected_users.length} anggota untuk dicek.`);
    loadAllData();
  };

  // Simpan Pengaturan Jendela Waktu
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.updateSetting('sholat_dzuhur', {
      start_time: `${editDzuhurStart}:00`,
      end_time: `${editDzuhurEnd}:00`,
      max_end_time: `${editDzuhurMax}:00`,
      jam_mulai: `${editDzuhurStart}:00`,
      jam_selesai: `${editDzuhurEnd}:00`,
      jam_maksimal: `${editDzuhurMax}:00`,
    });
    dataService.updateSetting('pendalaman_iman', {
      start_time: `${editImanStart}:00`,
      end_time: `${editImanEnd}:00`,
      max_end_time: `${editImanMax}:00`,
      jam_mulai: `${editImanStart}:00`,
      jam_selesai: `${editImanEnd}:00`,
      jam_maksimal: `${editImanMax}:00`,
    });
    showToast('Jendela waktu check-in berhasil diperbarui (Batas Normal & Batas Maksimal).');
    loadAllData();
  };

  // Tambah Anggota Baru
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNis.trim() || !newName.trim()) {
      alert('ID dan Nama anggota wajib diisi.');
      return;
    }

    dataService.addProfile({
      nis: newNis.trim(),
      full_name: newName.trim(),
      role: newRole,
      agama: newAgama,
      organisasi: newOrg,
      jabatan: newJabatan.trim(),
      kelas: newKelas.trim(),
      is_active: true,
    });

    showToast(`Anggota ${newName} berhasil didaftarkan.`);
    setNewNis('');
    setNewName('');
    loadAllData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-4 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CLOUD DATABASE LIVE STATUS BAR */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-3.5 sm:p-4 border border-emerald-800/40 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-500/30 shrink-0">
            <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Database Cloud Live Terhubung</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Supabase Live
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Input check-in dari HP anggota langsung masuk secara realtime ke dashboard pengurus.
              {lastSyncTime && (
                <span className="ml-1 text-emerald-300 font-medium">
                  • Terakhir sinkron: {lastSyncTime} WIB
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => triggerCloudSync(false)}
          disabled={isCloudSyncing}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
          <span>{isCloudSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
        </button>
      </div>

      {/* METRIC CARDS HEADER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Anggota
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">OSIS & MPK Aktif</div>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Hadir Hari Ini
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{stats.hadir}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Tepat waktu</div>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Izin / Halangan
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1">{stats.izin}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Haid, sakit, dinas</div>
        </div>

        {/* ANGGOTA BELUM CHECK-IN */}
        <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-xs relative overflow-hidden">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
            Belum Check-In
          </div>
          <div className="text-2xl font-black text-rose-800 mt-1 flex items-baseline gap-2">
            {stats.belum}
            {stats.belum > 0 && (
              <span className="text-xs font-bold text-rose-600 animate-pulse">Perlu Dicek</span>
            )}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">Bisa input manual</div>
        </div>

        <div className="bg-sky-50/80 p-4 rounded-2xl border border-sky-200 shadow-xs">
          <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">
            Menunggu Verif
          </div>
          <div className="text-2xl font-black text-sky-800 mt-1">{stats.pendingVerif}</div>
          <div className="text-[10px] text-sky-600 mt-0.5">Butuh persetujuan</div>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Partisipasi
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.percentHadir}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tingkat kehadiran</div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'monitoring'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Monitoring & Verifikasi</span>
          {stats.pendingVerif > 0 && (
            <span className="px-1.5 py-0.2 bg-white text-emerald-700 rounded-full text-[10px] font-extrabold">
              {stats.pendingVerif}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'manual'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Input Manual</span>
        </button>

        <button
          onClick={() => setActiveTab('random')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'random'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <Dices className="w-4 h-4" />
          <span>Pengecekan Acak</span>
        </button>

        <button
          onClick={() => setActiveTab('rekap')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'rekap'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rekap & Ekspor</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Jendela Waktu & Anggota</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MONITORING & VERIFIKASI HARI INI */}
      {/* ============================================================== */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* FILTER BAR & INFORMASI HARI */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800 bg-slate-50"
              />
              <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{hariInfoSelected.namaHari}</span>
              </span>
              {hariInfoSelected.isJumat && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                  🕌 Hari Jumat (Sholat Jumat / Keputihan)
                </span>
              )}
              {hariInfoSelected.isWeekend && (
                <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                  🌴 Libur Akhir Pekan ({hariInfoSelected.namaHari})
                </span>
              )}
              {hariInfoSelected.isLiburNasional && (
                <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                  🏖️ Libur Nasional ({hariInfoSelected.namaLiburNasional})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
              >
                <option value="semua">Semua Organisasi</option>
                <option value="OSIS">Hanya OSIS</option>
                <option value="MPK">Hanya MPK</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama anggota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs w-44 sm:w-56"
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: DAFTAR ANGGOTA YANG BELUM CHECK-IN (FITUR UTAMA PROMPT) */}
          <div className="bg-white rounded-3xl p-5 border border-rose-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="font-bold text-sm text-slate-900">
                  Anggota yang BELUM Check-In Hari Ini ({uncheckinMembers.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Tandai tidak hadir atau inputkan langsung
              </span>
            </div>

            {uncheckinMembers.length === 0 ? (
              <div className="p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-emerald-800">
                  Luar biasa! Seluruh anggota sudah melakukan check-in hari ini.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uncheckinMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-rose-50/30 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{member.full_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {member.organisasi} • {member.kelas} • Agama: <span className="capitalize">{member.agama}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMarkAbsent(member)}
                        className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors"
                        title="Tandai Tidak Hadir"
                      >
                        Tidak Hadir
                      </button>
                      <button
                        onClick={() => {
                          setManualUserId(member.id);
                          setManualIbadah(member.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman');
                          setActiveTab('manual');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold transition-colors"
                        title="Inputkan Kehadiran"
                      >
                        Input
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: DAFTAR PRESENSI & VERIFIKASI */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                Presensi Terkirim & Antrean Verifikasi ({filteredPresensi.length})
              </h3>
            </div>

            {filteredPresensi.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <UserX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Belum ada data presensi yang sesuai filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                      <th className="py-2.5 px-3">Anggota</th>
                      <th className="py-2.5 px-3">Organisasi</th>
                      <th className="py-2.5 px-3">Ibadah</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Waktu WIB</th>
                      <th className="py-2.5 px-3">Alasan / Catatan</th>
                      <th className="py-2.5 px-3">Status Verifikasi</th>
                      <th className="py-2.5 px-3 text-right">Aksi Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPresensi.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.profile?.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {item.profile?.nis}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-700">{item.profile?.organisasi}</span>
                          <div className="text-[10px] text-slate-400">{item.profile?.kelas}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800">
                            {item.ibadah === 'sholat_dzuhur'
                              ? hariInfoSelected.isJumat
                                ? item.profile?.jenis_kelamin === 'laki-laki'
                                  ? 'Sholat Jumat'
                                  : 'Dzuhur / Keputihan'
                                : 'Sholat Dzuhur'
                              : 'Pend. Iman'}
                          </span>
                          {hariInfoSelected.isJumat && item.ibadah === 'sholat_dzuhur' && (
                            <span className="block text-[9px] font-bold text-amber-700">🕌 Jumat</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                              item.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'izin_halangan'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status === 'izin_halangan' ? 'Izin' : item.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600">
                          <div>{formatJamWIB(item.waktu_checkin)}</div>
                          {(item.is_late || item.terlambat) && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Terlambat
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {item.keterangan_halangan && (
                            <div className="text-amber-800 italic">
                              &ldquo;{item.keterangan_halangan}&rdquo;
                            </div>
                          )}
                          {item.catatan_pengurus && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Catatan: {item.catatan_pengurus}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              item.status_verifikasi === 'terverifikasi'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.status_verifikasi === 'pelanggaran'
                                ? 'bg-rose-100 text-rose-700 font-black'
                                : item.status_verifikasi === 'ditolak'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {item.status_verifikasi}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Setujui */}
                            {item.status_verifikasi !== 'terverifikasi' && (
                              <button
                                onClick={() => handleVerify(item.id, 'terverifikasi')}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center gap-1 border border-emerald-200"
                                title="Setujui Verifikasi"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Setujui</span>
                              </button>
                            )}

                            {/* Tombol Flag Pelanggaran (Jika Terbukti Bohong) */}
                            {item.status_verifikasi !== 'pelanggaran' && (
                              <button
                                onClick={() => {
                                  setSelectedPresensiForFlag(item);
                                  setFlagModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 border border-rose-200"
                                title="Tandai Pelanggaran (Bohong)"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Pelanggaran</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: INPUT MANUAL PENGURUS */}
      {/* ============================================================== */}
      {activeTab === 'manual' && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">Input Manual Presensi</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Gunakan fitur ini bila anggota terkendala perangkat (HP mati/ketinggalan) atau verifikasi langsung di lokasi ibadah.
          </p>

          <form onSubmit={handleSubmitManual} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pilih Anggota OSIS / MPK <span className="text-rose-500">*</span>
              </label>
              <select
                value={manualUserId}
                onChange={(e) => {
                  setManualUserId(e.target.value);
                  const selected = profiles.find((p) => p.id === e.target.value);
                  if (selected) {
                    setManualIbadah(selected.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman');
                  }
                }}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white font-medium"
                required
              >
                <option value="">-- Pilih Nama Anggota --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.organisasi} • {m.kelas} • {m.agama.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Jenis Ibadah
                </label>
                <select
                  value={manualIbadah}
                  onChange={(e) => setManualIbadah(e.target.value as IbadahType)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="sholat_dzuhur">
                    {isHariJumat(manualDate)
                      ? 'Sholat Jumat (Putra) / Dzuhur & Keputihan (Putri)'
                      : 'Sholat Dzuhur'}
                  </option>
                  <option value="pendalaman_iman">
                    {isHariJumat(manualDate)
                      ? 'Pendalaman Iman & Ibadah Jumat'
                      : 'Pendalaman Iman'}
                  </option>
                </select>
                {isHariJumat(manualDate) && (
                  <p className="text-[11px] text-amber-700 mt-1 font-medium">
                    🕌 Tanggal yang dipilih jatuh pada hari Jumat (Wajib Sholat Jumat untuk putra).
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status Kehadiran
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['hadir', 'izin_halangan', 'tidak_hadir'] as PresensiStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setManualStatus(st)}
                    className={`py-2 px-3 rounded-xl border font-bold capitalize transition-all ${
                      manualStatus === st
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {st === 'izin_halangan' ? 'Izin' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {manualStatus === 'izin_halangan' && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Keterangan Izin / Halangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Halangan syar'i / sakit flu..."
                  value={manualKeterangan}
                  onChange={(e) => setManualKeterangan(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  required
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Catatan Pengurus
              </label>
              <textarea
                rows={2}
                value={manualCatatan}
                onChange={(e) => setManualCatatan(e.target.value)}
                placeholder="Misal: Dilihat langsung di musholla, HP baterai habis..."
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              Simpan Presensi Manual
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: FITUR PENGECEKAN ACAK (RANDOM AUDIT) */}
      {/* ============================================================== */}
      {activeTab === 'random' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 mb-2">
                  <Dices className="w-3.5 h-3.5" />
                  Fitur Pengecekan Acak Lapangan
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Uji Petik / Sidak Kejujuran Check-In
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Sistem memilih nama anggota secara acak hari ini. Pengurus keagamaan mengecek langsung apakah yang bersangkutan benar-benar ada di musholla / ruang kebaktian.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={randomIbadah}
                  onChange={(e) => setRandomIbadah(e.target.value as IbadahType)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
                >
                  <option value="sholat_dzuhur">Sholat Dzuhur (Islam)</option>
                  <option value="pendalaman_iman">Pendalaman Iman (Kristen)</option>
                </select>

                <select
                  value={randomCount}
                  onChange={(e) => setRandomCount(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
                >
                  <option value={3}>3 Anggota</option>
                  <option value={5}>5 Anggota</option>
                  <option value={10}>10 Anggota</option>
                </select>

                <button
                  onClick={handleGenerateRandom}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2"
                >
                  <Dices className="w-4 h-4" />
                  <span>Acak {randomCount} Anggota</span>
                </button>
              </div>
            </div>

            {/* HASIL ACAKAN SAAT INI */}
            {activeRandomCheck && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-700">
                    Hasil Acakan Terakhir ({formatTanggalIndonesia(activeRandomCheck.tanggal)} -{' '}
                    {activeRandomCheck.ibadah === 'sholat_dzuhur' ? 'Dzuhur' : 'Pendalaman Iman'})
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeRandomCheck.selected_users.map((u) => (
                    <div
                      key={u.user_id}
                      className="p-4 rounded-2xl border border-purple-200 bg-purple-50/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">ID: {u.nis}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.status_cek === 'sesuai'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.status_cek === 'tidak_ada'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {u.status_cek === 'sesuai'
                              ? 'Terbukti Ada'
                              : u.status_cek === 'tidak_ada'
                              ? 'Tidak Ada (Bohong)'
                              : 'Belum Dicek'}
                          </span>
                        </div>

                        <div className="font-bold text-slate-900 text-sm mt-1">{u.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {u.organisasi} • {u.kelas}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-purple-100 flex items-center gap-2">
                        <button
                          onClick={() => {
                            dataService.updateRandomCheckItem(
                              activeRandomCheck.id,
                              u.user_id,
                              'sesuai',
                              'Terlihat sholat di musholla'
                            );
                            loadAllData();
                            showToast(`${u.full_name} dikonfirmasi SESUAI.`);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Ada (Sesuai)</span>
                        </button>

                        <button
                          onClick={() => {
                            dataService.updateRandomCheckItem(
                              activeRandomCheck.id,
                              u.user_id,
                              'tidak_ada',
                              'Tidak ditemukan di lokasi ibadah'
                            );
                            loadAllData();
                            showToast(`${u.full_name} ditandai TIDAK ADA.`);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          <span>Tidak Ada</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: REKAPITULASI & EKSPOR (EXCEL & PDF) */}
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* TAB 4: REKAPITULASI & EKSPOR (EXCEL & PDF) */}
      {/* ============================================================== */}
      {activeTab === 'rekap' && (
        <div className="space-y-6">
          {/* PILIHAN PERIODE REKAP (HARIAN, MINGGUAN, BULANAN, SEMUA) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Pilih Rentang Periode Laporan
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Data yang diekspor ke Excel maupun PDF akan disesuaikan dengan periode yang Anda pilih di bawah:
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setRekapPeriod('hari_ini')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rekapPeriod === 'hari_ini'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📅 Per Hari (Hari Ini)
              </button>

              <button
                type="button"
                onClick={() => setRekapPeriod('minggu_ini')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rekapPeriod === 'minggu_ini'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                🗓️ Per Minggu (7 Hari)
              </button>

              <button
                type="button"
                onClick={() => setRekapPeriod('bulan_ini')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rekapPeriod === 'bulan_ini'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📊 Per Bulan (Bulan Ini)
              </button>

              <button
                type="button"
                onClick={() => setRekapPeriod('semua')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rekapPeriod === 'semua'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📁 Semua Riwayat
              </button>
            </div>
          </div>

          {/* KARTU UNDUH BERKAS RESMI */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {rekapData.label}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  • {rekapData.list.length} baris data ditemukan
                </span>
              </div>
              <h4 className="text-lg font-black text-white mt-1.5">
                Unduh Rekapitulasi Presensi
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Format Excel (.xlsx) cocok untuk olah data lanjut, dan format PDF resmi sudah dilengkapi kop surat dan kolom tanda tangan.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => exportToExcel(rekapData.list, `Rekap_Ibadah_OSIS_MPK_${rekapData.fileSuffix}`)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Unduh Excel (.xlsx)</span>
              </button>

              <button
                onClick={() =>
                  exportToPDF(
                    rekapData.list,
                    rekapData.label,
                    currentUser.full_name,
                    'Nurkholis Aiman / Maria Ulfa'
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Cetak / Ekspor PDF</span>
              </button>
            </div>
          </div>

          {/* TABEL REKAP RINGKASAN */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900">
                Pratinjau Data Presensi ({rekapData.label}) - {rekapData.list.length} Catatan
              </h4>
              <span className="text-[11px] text-slate-400">
                Menampilkan data sesuai rentang periode aktif
              </span>
            </div>

            {rekapData.list.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                Tidak ada catatan presensi pada rentang {rekapData.label}.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold z-10">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3">ID Anggota</th>
                      <th className="py-2 px-3">Nama Lengkap</th>
                      <th className="py-2 px-3">Organisasi</th>
                      <th className="py-2 px-3">Kelas</th>
                      <th className="py-2 px-3">Ibadah</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rekapData.list.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono">{item.tanggal}</td>
                        <td className="py-2.5 px-3 font-mono">{item.profile?.nis}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.profile?.full_name}</td>
                        <td className="py-2.5 px-3">{item.profile?.organisasi}</td>
                        <td className="py-2.5 px-3">{item.profile?.kelas}</td>
                        <td className="py-2.5 px-3">
                          {item.ibadah === 'sholat_dzuhur' ? 'Dzuhur' : 'Pend. Iman'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              item.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'izin_halangan'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status === 'izin_halangan' ? 'Izin' : item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status_verifikasi === 'pelanggaran'
                                ? 'bg-rose-100 text-rose-800 font-black'
                                : item.status_verifikasi === 'terverifikasi'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {item.status_verifikasi}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: PENGATURAN JENDELA WAKTU & MANAJEMEN ANGGOTA */}
      {/* ============================================================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PENGATURAN JENDELA WAKTU */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-base text-slate-900">Atur Jendela Waktu Check-In</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Tombol check-in anggota hanya aktif pada rentang jam berikut (WIB).
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-900 text-sm">
                  1. Sholat Dzuhur Berjamaah (Islam)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Mulai Buka</label>
                    <input
                      type="time"
                      value={editDzuhurStart}
                      onChange={(e) => setEditDzuhurStart(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Batas Normal (18:00)</label>
                    <input
                      type="time"
                      value={editDzuhurEnd}
                      onChange={(e) => setEditDzuhurEnd(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Batas Maksimal (21:00)</label>
                    <input
                      type="time"
                      value={editDzuhurMax}
                      onChange={(e) => setEditDzuhurMax(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-3">
                <div className="font-bold text-sky-900 text-sm">
                  2. Pendalaman Iman (Kristen/Katolik)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Mulai Buka</label>
                    <input
                      type="time"
                      value={editImanStart}
                      onChange={(e) => setEditImanStart(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Batas Normal (18:00)</label>
                    <input
                      type="time"
                      value={editImanEnd}
                      onChange={(e) => setEditImanEnd(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Batas Maksimal (21:00)</label>
                    <input
                      type="time"
                      value={editImanMax}
                      onChange={(e) => setEditImanMax(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
              >
                Simpan Jadwal Waktu WIB (Normal 18:00 & Maksimal 21:00)
              </button>
            </form>
          </div>

          {/* MANAJEMEN ANGGOTA BARU */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-base text-slate-900">Tambah Anggota OSIS / MPK</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Daftarkan anggota baru agar dapat melakukan check-in ibadah mandiri.
            </p>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID / Nomor Anggota</label>
                  <input
                    type="text"
                    value={newNis}
                    onChange={(e) => setNewNis(e.target.value)}
                    placeholder="Contoh: 2425010"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama lengkap siswa"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agama</label>
                  <select
                    value={newAgama}
                    onChange={(e) => setNewAgama(e.target.value as Profile['agama'])}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="islam">Islam</option>
                    <option value="kristen">Kristen</option>
                    <option value="katolik">Katolik</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Organisasi</label>
                  <select
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value as Profile['organisasi'])}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="OSIS">OSIS</option>
                    <option value="MPK">MPK</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peran Akun</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Profile['role'])}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="anggota">Anggota</option>
                    <option value="pengurus">Pengurus</option>
                    <option value="pembina">Pembina</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas</label>
                  <input
                    type="text"
                    value={newKelas}
                    onChange={(e) => setNewKelas(e.target.value)}
                    placeholder="XI IPA 2"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    placeholder="Anggota Sekbid Humas"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-colors mt-2"
              >
                Daftarkan Anggota Baru
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: AUDIT LOG (CATATAN SIAPA MENGUBAH DATA) */}
      {/* ============================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">Audit Log & Catatan Keamanan</h3>
          </div>
          <p className="text-xs text-slate-500">
            Merekam riwayat seluruh aksi presensi, verifikasi pengurus, penandaan pelanggaran, dan input manual demi transparansi.
          </p>

          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                      log.action === 'FLAG_PELANGGARAN'
                        ? 'bg-rose-100 text-rose-700'
                        : log.action === 'VERIFIKASI'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {log.action === 'FLAG_PELANGGARAN' ? '⚠️' : '✓'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">
                      {log.actor_name}{' '}
                      <span className="font-normal text-slate-500">
                        melakukan <span className="font-mono font-semibold">{log.action}</span> pada {log.table_name}
                      </span>
                    </div>
                    {log.details && (
                      <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                  {formatJamWIB(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL TANDAI PELANGGARAN JIKA CHECK-IN TERBUKTI BOHONG */}
      {/* ============================================================== */}
      {flagModalOpen && selectedPresensiForFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center font-bold text-lg">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Tandai Pelanggaran</h3>
                <p className="text-xs text-rose-600 font-medium">
                  Check-in terbukti tidak sesuai fakta
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">
                {selectedPresensiForFlag.profile?.full_name} ({selectedPresensiForFlag.profile?.organisasi})
              </div>
              <div className="text-slate-500">
                Waktu Check-In: {formatJamWIB(selectedPresensiForFlag.waktu_checkin || selectedPresensiForFlag.dibuat_pada)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Catatan Alasan Pelanggaran <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={pelanggaranNote}
                onChange={(e) => setPelanggaranNote(e.target.value)}
                placeholder="Contoh: Berdasarkan pengecekan acak / saksi pengurus, yang bersangkutan berada di kantin saat jam sholat dzuhur..."
                className="w-full text-xs p-3 rounded-xl border border-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFlagModalOpen(false);
                  setSelectedPresensiForFlag(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmFlagPelanggaran}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                Konfirmasi Pelanggaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
