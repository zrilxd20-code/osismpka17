'use client';

import React, { useMemo, useState } from 'react';
import { PresensiIbadah } from '@/types/database';
import { formatTanggalIndonesia } from '@/lib/time-utils';
import { BarChart3, PieChart, TrendingUp, Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface GrafikKehadiranProps {
  data: PresensiIbadah[];
  periodLabel?: string;
}

export default function GrafikKehadiran({ data, periodLabel }: GrafikKehadiranProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // 1. Agregasi data per tanggal
  const dailyStats = useMemo(() => {
    const map = new Map<string, { tanggal: string; hadir: number; izin: number; tidakHadir: number; total: number }>();

    data.forEach((item) => {
      const tgl = item.tanggal || 'Lainnya';
      if (!map.has(tgl)) {
        map.set(tgl, { tanggal: tgl, hadir: 0, izin: 0, tidakHadir: 0, total: 0 });
      }
      const entry = map.get(tgl)!;
      entry.total++;
      if (item.status === 'hadir') {
        entry.hadir++;
      } else if (item.status === 'izin' || item.status === 'izin_halangan') {
        entry.izin++;
      } else {
        entry.tidakHadir++;
      }
    });

    // Urutkan tanggal secara kronologis menaik
    const list = Array.from(map.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return list;
  }, [data]);

  // 2. Statistik Total Keseluruhan
  const totals = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let tidakHadir = 0;

    data.forEach((item) => {
      if (item.status === 'hadir') hadir++;
      else if (item.status === 'izin' || item.status === 'izin_halangan') izin++;
      else tidakHadir++;
    });

    const total = hadir + izin + tidakHadir;
    const persenHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const persenIzin = total > 0 ? Math.round((izin / total) * 100) : 0;
    const persenTidakHadir = total > 0 ? Math.round((tidakHadir / total) * 100) : 0;

    // Cari hari terbaik
    let bestDay = '-';
    let maxRate = -1;
    dailyStats.forEach((d) => {
      const rate = d.total > 0 ? (d.hadir / d.total) * 100 : 0;
      if (rate > maxRate) {
        maxRate = rate;
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
      maxRate: maxRate >= 0 ? Math.round(maxRate) : 0,
    };
  }, [data, dailyStats]);

  // Maksimum data untuk skala grafik batang
  const maxDailyCount = useMemo(() => {
    const max = Math.max(...dailyStats.map((d) => d.total), 1);
    return Math.max(max, 10);
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
      {/* 1. KARTU STATISTIK RINGKASAN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Persentase Kehadiran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tingkat Kehadiran</span>
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
            <span className="text-xs text-slate-400">/ {totals.total} check-in</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-2">
            Siswa melaksanakan ibadah
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

        {/* Total Tidak Hadir */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tidak Hadir / Alpha</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-500">{totals.tidakHadir}</span>
            <span className="text-xs text-slate-400">({totals.persenTidakHadir}%)</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-2">
            Tanpa keterangan presensi
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
                  Grafik Tren Kehadiran Harian
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {periodLabel || 'Pergerakan kehadiran presensi per tanggal'} (Arahkan kursor pada batang untuk melihat rincian)
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
                Alpha
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
                const heightPercentHadir = Math.round((d.hadir / maxDailyCount) * 100);
                const heightPercentIzin = Math.round((d.izin / maxDailyCount) * 100);
                const heightPercentTidak = Math.round((d.tidakHadir / maxDailyCount) * 100);
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
                    {/* Nilai persentase mini saat hover */}
                    <div
                      className={`text-[10px] font-bold text-slate-600 mb-1 transition-all ${
                        isHovered ? 'opacity-100 scale-110 text-emerald-600' : 'opacity-80'
                      }`}
                    >
                      {d.hadir}
                    </div>

                    {/* Kontainer Bar Stacked */}
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
                        title={`Hadir: ${d.hadir}`}
                      />
                      {/* Izin (Kuning) */}
                      {d.izin > 0 && (
                        <div
                          className="bg-amber-400 hover:bg-amber-300 transition-all"
                          style={{ height: `${heightPercentIzin}%` }}
                          title={`Izin: ${d.izin}`}
                        />
                      )}
                      {/* Tidak Hadir (Merah) */}
                      {d.tidakHadir > 0 && (
                        <div
                          className="bg-rose-500 hover:bg-rose-400 transition-all"
                          style={{ height: `${heightPercentTidak}%` }}
                          title={`Tidak Hadir: ${d.tidakHadir}`}
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
                <span className="text-slate-400">• Total {activeDaily.total} siswa terdata</span>
              </div>
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-700">✅ Hadir: {activeDaily.hadir}</span>
                <span className="text-amber-700">⏳ Izin: {activeDaily.izin}</span>
                <span className="text-rose-700">❌ Alpha: {activeDaily.tidakHadir}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {activeDaily.total > 0 ? Math.round((activeDaily.hadir / activeDaily.total) * 100) : 0}% Kehadiran
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Kolom 3: Diagram Proporsi & Wawasan */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-indigo-600" />
              <h4 className="font-bold text-base text-slate-900">
                Komposisi Kehadiran
              </h4>
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
                  <span className="text-rose-700">Tidak Hadir / Alpha</span>
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
              💡 Catatan Rekapitulasi:
            </span>
            <p className="text-indigo-700 leading-relaxed">
              Tingkat kepatuhan presensi mencapai <strong>{totals.persenHadir}%</strong>. Hari dengan rasio kehadiran tertinggi tercatat pada{' '}
              <strong>{totals.bestDay !== '-' ? formatTanggalIndonesia(totals.bestDay) : '-'}</strong> ({totals.maxRate}% hadir).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
