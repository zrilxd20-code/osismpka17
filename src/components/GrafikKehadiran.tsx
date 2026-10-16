'use client';

import React, { useMemo, useState } from 'react';
import { PresensiIbadah, Profile } from '@/types/database';
import { DEFAULT_PROFILES } from '@/lib/data-service';
import { formatTanggalIndonesia } from '@/lib/time-utils';
import { BarChart3, PieChart, TrendingUp, Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface GrafikKehadiranProps {
  data: PresensiIbadah[];
  periodLabel?: string;
  totalMembersCount?: number;
  members?: Profile[];
}

export default function GrafikKehadiran({
  data,
  periodLabel,
  totalMembersCount,
  members,
}: GrafikKehadiranProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Ambil daftar seluruh anggota aktif OSIS & MPK (Standar: 39 Siswa)
  const activeMembers = useMemo(() => {
    if (members && members.length > 0) return members;
    return DEFAULT_PROFILES.filter((p) => p.is_active && p.role !== 'pembina');
  }, [members]);

  const targetMembersPerDay = totalMembersCount || activeMembers.length || 39;

  // 1. Agregasi data per tanggal dengan memperhitungkan siswa yang BELUM CHECK-IN sebagai ALPHA
  const dailyStats = useMemo(() => {
    // Ambil tanggal unik dari data yang ada
    const dates = Array.from(new Set(data.map((d) => d.tanggal).filter(Boolean))) as string[];
    dates.sort();
    if (dates.length === 0) return [];

    return dates.map((tgl) => {
      const itemsOnDate = data.filter((d) => d.tanggal === tgl);
      const hadir = itemsOnDate.filter((i) => i.status === 'hadir').length;
      const izin = itemsOnDate.filter((i) => i.status === 'izin' || i.status === 'izin_halangan').length;
      const explicitAlpha = itemsOnDate.filter((i) => i.status === 'tidak_hadir').length;

      // KUNCI: Siswa dari 39 anak yang belum check-in pada hari aktif otomatis dihitung ALPHA (Tidak Hadir)
      const uncheckinCount = Math.max(0, targetMembersPerDay - (hadir + izin + explicitAlpha));
      const tidakHadir = explicitAlpha + uncheckinCount;
      const total = targetMembersPerDay;

      const persenHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;
      const persenIzin = total > 0 ? Math.round((izin / total) * 100) : 0;
      const persenTidakHadir = total > 0 ? Math.round((tidakHadir / total) * 100) : 0;

      return {
        tanggal: tgl,
        hadir,
        izin,
        tidakHadir,
        uncheckinCount,
        total,
        persenHadir,
        persenIzin,
        persenTidakHadir,
      };
    });
  }, [data, targetMembersPerDay]);

  // 2. Statistik Total Keseluruhan Berdasarkan Target Lengkap 39 Anggota
  const totals = useMemo(() => {
    if (dailyStats.length === 0) {
      return {
        total: 0,
        hadir: 0,
        izin: 0,
        tidakHadir: 0,
        persenHadir: 0,
        persenIzin: 0,
        persenTidakHadir: 0,
        bestDay: '-',
        maxRate: 0,
        activeDaysCount: 0,
      };
    }

    let hadir = 0;
    let izin = 0;
    let tidakHadir = 0;
    let total = 0;

    dailyStats.forEach((d) => {
      hadir += d.hadir;
      izin += d.izin;
      tidakHadir += d.tidakHadir;
      total += d.total;
    });

    const persenHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const persenIzin = total > 0 ? Math.round((izin / total) * 100) : 0;
    const persenTidakHadir = total > 0 ? Math.round((tidakHadir / total) * 100) : 0;

    // Cari hari terbaik
    let bestDay = '-';
    let maxRate = -1;
    dailyStats.forEach((d) => {
      if (d.persenHadir > maxRate) {
        maxRate = d.persenHadir;
        bestDay = d.tanggal;
      }
    });

    return {
      total,
      hadir,
      izin,
      tidakHadir,
      persenHadir,
      persenIzin,
      persenTidakHadir,
      bestDay,
      maxRate: maxRate >= 0 ? maxRate : 0,
      activeDaysCount: dailyStats.length,
    };
  }, [dailyStats]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-400">
        <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-semibold">Belum ada data presensi untuk menampilkan grafik pada periode ini.</p>
      </div>
    );
  }

  const activeDaily = dailyStats.find((d) => d.tanggal === hoveredDate) || dailyStats[dailyStats.length - 1];

  return (
    <div className="space-y-6">
      {/* 1. KARTU STATISTIK RINGKASAN DENGAN BASIS 39 ANGGOTA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Persentase Kehadiran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tingkat Hadir</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{totals.persenHadir}%</span>
            <span className="text-xs text-emerald-600 font-bold">Rata-rata</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${totals.persenHadir}%` }}
            />
          </div>
        </div>

        {/* Total Hadir */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Hadir</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{totals.hadir}</span>
            <span className="text-xs text-slate-400">/ {totals.total} slot</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-2">
            Basis {targetMembersPerDay} anggota × {totals.activeDaysCount} hari
          </span>
        </div>

        {/* Total Izin / Sakit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Izin / Halangan</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-500">{totals.izin}</span>
            <span className="text-xs text-slate-400">({totals.persenIzin}%)</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-2">
            Sakit, uzur syari, atau dispensasi
          </span>
        </div>

        {/* Total Tidak Hadir / Alpha (Termasuk Belum Check-in) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Alpha (Tidak Hadir)</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-500">{totals.tidakHadir}</span>
            <span className="text-xs text-slate-400">({totals.persenTidakHadir}%)</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-2">
            Belum check-in dari {targetMembersPerDay} anggota
          </span>
        </div>
      </div>

      {/* 2. DIAGRAM UTAMA: GRAFIK BATANG TREN KEHADIRAN & PROPORSI STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1-2: Grafik Batang Tren Harian */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Grafik Tren Kehadiran (Kapasitas {targetMembersPerDay} Anggota)
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {periodLabel || 'Pergerakan kehadiran presensi per tanggal'} (Siswa yang belum check-in terhitung sebagai Alpha merah)
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                Hadir
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                Izin
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />
                Alpha ({targetMembersPerDay} - Hadir)
              </span>
            </div>
          </div>

          {/* Area Render Batang Grafik */}
          <div className="relative pt-4 pb-2">
            {/* Grid Lines Horizontal */}
            <div className="absolute inset-x-0 top-4 bottom-10 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-slate-300 w-full" />
              <div className="border-b border-slate-300 w-full" />
              <div className="border-b border-slate-300 w-full" />
              <div className="border-b border-slate-300 w-full" />
            </div>

            {/* Batang-batang tanggal */}
            <div className="flex items-end justify-between gap-2 sm:gap-4 h-56 px-2 overflow-x-auto">
              {dailyStats.map((d) => {
                const heightPercentHadir = Math.round((d.hadir / targetMembersPerDay) * 100);
                const heightPercentIzin = Math.round((d.izin / targetMembersPerDay) * 100);
                const heightPercentTidak = Math.round((d.tidakHadir / targetMembersPerDay) * 100);
                const isHovered = hoveredDate === d.tanggal;

                const dayDate = new Date(d.tanggal);
                const dayName = !isNaN(dayDate.getTime())
                  ? dayDate.toLocaleDateString('id-ID', { weekday: 'short' })
                  : '';
                const shortDate = d.tanggal.slice(8, 10);

                return (
                  <div
                    key={d.tanggal}
                    onMouseEnter={() => setHoveredDate(d.tanggal)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className="flex-1 min-w-[38px] max-w-[64px] flex flex-col items-center cursor-pointer group"
                  >
                    {/* Nilai kehadiran saat hover */}
                    <div
                      className={`text-[10px] font-bold text-slate-600 mb-1 transition-all ${
                        isHovered ? 'opacity-100 scale-110 text-emerald-600' : 'opacity-80'
                      }`}
                    >
                      {d.hadir}/{targetMembersPerDay}
                    </div>

                    {/* Kontainer Bar Stacked (Tinggi penuh mencerminkan target 39 anggota) */}
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg overflow-hidden flex flex-col-reverse transition-all duration-300 ${
                        isHovered ? 'ring-2 ring-emerald-500 ring-offset-2' : 'group-hover:opacity-90'
                      }`}
                      style={{ height: '170px' }}
                    >
                      {/* Hadir (Hijau) */}
                      <div
                        className="bg-emerald-500 hover:bg-emerald-400 transition-all"
                        style={{ height: `${heightPercentHadir}%` }}
                        title={`Hadir: ${d.hadir} siswa`}
                      />
                      {/* Izin (Kuning) */}
                      {d.izin > 0 && (
                        <div
                          className="bg-amber-400 hover:bg-amber-300 transition-all"
                          style={{ height: `${heightPercentIzin}%` }}
                          title={`Izin: ${d.izin} siswa`}
                        />
                      )}
                      {/* Tidak Hadir / Belum Check-in (Merah) */}
                      {d.tidakHadir > 0 && (
                        <div
                          className="bg-rose-500 hover:bg-rose-400 transition-all"
                          style={{ height: `${heightPercentTidak}%` }}
                          title={`Alpha / Belum Check-in: ${d.tidakHadir} siswa`}
                        />
                      )}
                    </div>

                    {/* Label Sumbu X */}
                    <div className="mt-2 text-center">
                      <span className="block text-[11px] font-bold text-slate-800 leading-tight">
                        {shortDate}
                      </span>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                        {dayName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rincian tooltip interaktif di bawah grafik */}
          {activeDaily && (
            <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800">
                  {formatTanggalIndonesia(activeDaily.tanggal)}
                </span>
                <span className="text-slate-400">• Basis {targetMembersPerDay} Anggota</span>
              </div>
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-700">✅ Hadir: {activeDaily.hadir}</span>
                <span className="text-amber-700">⏳ Izin: {activeDaily.izin}</span>
                <span className="text-rose-700">❌ Alpha: {activeDaily.tidakHadir}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {activeDaily.persenHadir}% Kehadiran
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Kolom 3: Diagram Proporsi & Wawasan Berbasis 39 Anggota */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Komposisi Kehadiran
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                Basis {targetMembersPerDay} Siswa
              </span>
            </div>

            {/* Visualisasi Bar Proporsi Keseluruhan */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-emerald-700">Hadir Berjamaah / Ibadah</span>
                  <span>{totals.hadir} siswa ({totals.persenHadir}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totals.persenHadir}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-amber-700">Izin / Halangan Resmi</span>
                  <span>{totals.izin} siswa ({totals.persenIzin}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totals.persenIzin}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-rose-700">Alpha / Belum Check-in</span>
                  <span>{totals.tidakHadir} siswa ({totals.persenTidakHadir}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totals.persenTidakHadir}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kotak Info Insight */}
          <div className="mt-6 p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs">
            <span className="font-bold text-indigo-900 block mb-1">
              💡 Penjelasan Akurasi Data:
            </span>
            <p className="text-indigo-700 leading-relaxed">
              Kalkulasi kehadiran dihitung dari total <strong>{targetMembersPerDay} anggota OSIS & MPK</strong>. Anggota yang tidak melakukan check-in pada hari aktif otomatis dihitung sebagai <strong>Alpha</strong> untuk menjaga integritas rekapitulasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
