'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Profile, PresensiIbadah, SettingsTimeWindow, IbadahType, PresensiStatus } from '@/types/database';
import { dataService } from '@/lib/data-service';
import { getTodayWIB, formatTanggalIndonesia, formatJamWIB, isWithinTimeWindow } from '@/lib/time-utils';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Send,
  Calendar,
  Info,
  History,
  ShieldCheck,
  XCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface AnggotaViewProps {
  currentUser: Profile;
  onRefreshData?: () => void;
}

export default function AnggotaView({ currentUser, onRefreshData }: AnggotaViewProps) {
  const [settings, setSettings] = useState<SettingsTimeWindow[]>([]);
  const [historyList, setHistoryList] = useState<PresensiIbadah[]>([]);
  const [todayPresensi, setTodayPresensi] = useState<PresensiIbadah | null>(null);

  // Form State
  const [status, setStatus] = useState<PresensiStatus>('hadir');
  const [keteranganHalangan, setKeteranganHalangan] = useState<string>('');
  const [saksi, setSaksi] = useState<string>('');
  const [bypassTime, setBypassTime] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Jenis ibadah ditentukan dari agama profil
  const ibadahType: IbadahType = useMemo(() => {
    return currentUser.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman';
  }, [currentUser.agama]);

  const ibadahLabel = ibadahType === 'sholat_dzuhur' ? 'Sholat Dzuhur Berjamaah' : 'Pendalaman Iman Kristen/Katolik';
  const lokasiLabel = ibadahType === 'sholat_dzuhur' ? 'Musholla Utama SMAN' : 'Ruang Kerohanian Kristen/Katolik';

  const currentSetting = useMemo(() => {
    return settings.find((s) => s.ibadah === ibadahType);
  }, [settings, ibadahType]);

  // Cek apakah jendela waktu sedang buka
  const windowStatus = useMemo(() => {
    if (!currentSetting) return { isOpen: true };
    return isWithinTimeWindow(
      currentSetting.start_time,
      currentSetting.end_time,
      currentSetting.days_active,
      bypassTime
    );
  }, [currentSetting, bypassTime]);

  // Muat data saat currentUser berubah
  const loadData = () => {
    const today = getTodayWIB();
    const allSettings = dataService.getSettings();
    setSettings(allSettings);

    const userHistory = dataService.getPresensiByUser(currentUser.id);
    setHistoryList(userHistory);

    const todayCheck = userHistory.find((p) => p.tanggal === today && p.ibadah === ibadahType);
    setTodayPresensi(todayCheck || null);
  };

  useEffect(() => {
    loadData();
    setFeedback(null);
  }, [currentUser, ibadahType]);

  const handleSubmitCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (status === 'izin_halangan' && !keteranganHalangan.trim()) {
      setFeedback({
        type: 'error',
        message: 'Mohon cantumkan keterangan alasan izin / halangan Anda.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = dataService.checkInMandiri({
        userId: currentUser.id,
        ibadah: ibadahType,
        status,
        keteranganHalangan: status === 'izin_halangan' ? keteranganHalangan : undefined,
        saksi: saksi.trim() ? saksi.trim() : undefined,
        bypassTimeCheck: bypassTime,
      });

      if (res.success && res.data) {
        setTodayPresensi(res.data);
        loadData();
        if (onRefreshData) onRefreshData();

        // Trigger confetti bila Hadir
        if (status === 'hadir') {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7 },
          });
        }

        setFeedback({
          type: 'success',
          message: res.message,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Terjadi kendala saat check-in.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Sambutan & Info Anggota */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              {currentUser.organisasi} • {currentUser.kelas}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Halo, {currentUser.full_name} 👋
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {currentUser.jabatan} • Agama: <span className="font-semibold capitalize text-slate-700">{currentUser.agama}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg border border-emerald-100 shrink-0">
            {currentUser.full_name.charAt(0)}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatTanggalIndonesia(getTodayWIB())}
          </span>
          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px]">
            NIS: {currentUser.nis}
          </span>
        </div>
      </div>

      {/* FEEDBACK TOAST / ALERT */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* JIKA SUDAH CHECK-IN HARI INI */}
      {todayPresensi ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />

          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2">
              Sudah Check-In Hari Ini
            </span>

            <h3 className="text-xl font-bold text-slate-900">{ibadahLabel}</h3>
            <p className="text-xs text-slate-500 mt-1">{lokasiLabel}</p>

            {/* Status Verifikasi Badge */}
            <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border">
              {todayPresensi.status_verifikasi === 'terverifikasi' ? (
                <span className="text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Presensi Terverifikasi Pengurus
                </span>
              ) : todayPresensi.status_verifikasi === 'pelanggaran' ? (
                <span className="text-rose-700 bg-rose-50 border-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  CATATAN PELANGGARAN
                </span>
              ) : todayPresensi.status_verifikasi === 'ditolak' ? (
                <span className="text-amber-700 bg-amber-50 border-amber-200 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  Ditolak Pengurus
                </span>
              ) : (
                <span className="text-sky-700 bg-sky-50 border-sky-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-600" />
                  Menunggu Verifikasi Pengurus
                </span>
              )}
            </div>

            {/* Detail Presensi Hari Ini */}
            <div className="mt-6 bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Status Kehadiran</span>
                <span className="font-bold text-slate-900 capitalize">
                  {todayPresensi.status === 'izin_halangan'
                    ? `Izin / Halangan`
                    : todayPresensi.status === 'hadir'
                    ? 'Hadir'
                    : 'Tidak Hadir'}
                </span>
              </div>

              {todayPresensi.keterangan_halangan && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Keterangan Izin</span>
                  <span className="font-medium text-slate-800 text-right">
                    {todayPresensi.keterangan_halangan}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Waktu Check-In</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatJamWIB(todayPresensi.waktu_checkin)}
                </span>
              </div>

              {todayPresensi.saksi && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Rekan / Saksi Ibadah</span>
                  <span className="font-semibold text-slate-800">{todayPresensi.saksi}</span>
                </div>
              )}

              {todayPresensi.catatan_pengurus && (
                <div className="pt-1.5">
                  <div className="text-[11px] font-bold text-slate-500 mb-0.5">Catatan Pengurus:</div>
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      todayPresensi.status_verifikasi === 'pelanggaran'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100/60 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    {todayPresensi.catatan_pengurus}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* FORM CHECK-IN MANDIRI SATU TOMBOL */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Check-In Mandiri
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                {ibadahLabel}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{lokasiLabel}</p>
            </div>

            {/* Live Status Jendela Waktu */}
            <div className="text-right">
              {windowStatus.isOpen ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Jendela Dibuka
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  <Clock className="w-3.5 h-3.5" />
                  Ditutup
                </span>
              )}
              {currentSetting && (
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  {currentSetting.start_time.slice(0, 5)} - {currentSetting.end_time.slice(0, 5)} WIB
                </div>
              )}
            </div>
          </div>

          {/* Banner jika jendela ditutup */}
          {!windowStatus.isOpen && (
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Check-in sedang nonaktif</div>
                <div>{windowStatus.reason}</div>
              </div>
            </div>
          )}

          {/* Switch Simulasi Jendela Buka untuk Uji Coba */}
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Mode Demo: Buka Jendela Check-in
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bypassTime}
                onChange={(e) => setBypassTime(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <form onSubmit={handleSubmitCheckin} className="mt-5 space-y-4">
            {/* Pilihan Status: Hadir vs Izin/Halangan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Pilih Status Kehadiran
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('hadir')}
                  className={`p-3.5 rounded-xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1.5 ${
                    status === 'hadir'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2
                    className={`w-5 h-5 ${status === 'hadir' ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                  <span>Hadir Ibadah</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('izin_halangan')}
                  className={`p-3.5 rounded-xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1.5 ${
                    status === 'izin_halangan'
                      ? 'border-amber-600 bg-amber-50 text-amber-800 ring-2 ring-amber-500/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 ${status === 'izin_halangan' ? 'text-amber-600' : 'text-slate-400'}`}
                  />
                  <span>Izin / Berhalangan</span>
                </button>
              </div>
            </div>

            {/* Jika Izin: Wajib Keterangan Alasan */}
            {status === 'izin_halangan' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Keterangan Izin / Halangan <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {currentUser.agama === 'islam' && (
                    <button
                      type="button"
                      onClick={() => setKeteranganHalangan("Halangan syar'i (haid)")}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                    >
                      Haid / Syar&apos;i
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setKeteranganHalangan('Sakit dengan surat')}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    Sakit
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeteranganHalangan('Dispensasi tugas sekolah / rapat')}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    Dispensasi Sekolah
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={keteranganHalangan}
                  onChange={(e) => setKeteranganHalangan(e.target.value)}
                  placeholder="Contoh: Halangan syar'i (haid) / Sakit flu / Mengikuti pembinaan lomba..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                  required
                />
              </div>
            )}

            {/* Kolom Saksi (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nama Teman / Saksi <span className="text-slate-400 font-normal lowercase">(opsional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={saksi}
                  onChange={(e) => setSaksi(e.target.value)}
                  placeholder="Nama rekan yang beribadah bersama Anda"
                  className="w-full text-xs pl-9 pr-3 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Membantu pengurus keagamaan dalam memverifikasi kehadiran.
              </p>
            </div>

            {/* TOMBOL BESAR SATU KETUKAN (Sesuai Syarat Utama) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!windowStatus.isOpen || isSubmitting}
                className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
                  !windowStatus.isOpen
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : status === 'hadir'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 animate-pulse-subtle'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-amber-500/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Presensi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>KIRIM CHECK-IN SEKARANG</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RIWAYAT CHECK-IN SAYA */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Riwayat Check-In Saya</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {historyList.length} Catatan
          </span>
        </div>

        {historyList.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Belum ada riwayat check-in yang tercatat.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {historyList.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {formatTanggalIndonesia(item.tanggal)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        item.status === 'hadir'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'izin_halangan'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status === 'izin_halangan' ? 'Izin' : item.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Jam: {formatJamWIB(item.waktu_checkin)}</span>
                    {item.saksi && <span>• Saksi: {item.saksi}</span>}
                    {item.keterangan_halangan && (
                      <span>• Alasan: {item.keterangan_halangan}</span>
                    )}
                  </div>

                  {item.catatan_pengurus && (
                    <div className="text-[10px] text-slate-600 mt-1 bg-white p-1.5 rounded border border-slate-200">
                      💬 <span className="font-semibold">Catatan:</span> {item.catatan_pengurus}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      item.status_verifikasi === 'terverifikasi'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.status_verifikasi === 'pelanggaran'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-extrabold'
                        : item.status_verifikasi === 'ditolak'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}
                  >
                    {item.status_verifikasi}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
