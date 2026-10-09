'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Profile, PresensiIbadah, AuditLog } from '@/types/database';
import { dataService } from '@/lib/data-service';
import { exportToExcel, exportToPDF } from '@/lib/export-utils';
import { formatTanggalIndonesia, formatJamWIB } from '@/lib/time-utils';
import {
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  History,
  Award,
} from 'lucide-react';

interface PembinaViewProps {
  currentUser: Profile;
}

export default function PembinaView({ currentUser }: PembinaViewProps) {
  const [presensiList, setPresensiList] = useState<PresensiIbadah[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filterOrg, setFilterOrg] = useState<string>('semua');

  useEffect(() => {
    setPresensiList(dataService.getPresensiList());
    setProfiles(dataService.getProfiles());
    setAuditLogs(dataService.getAuditLogs());
  }, []);

  const activeMembers = useMemo(() => {
    return profiles.filter((p) => p.is_active && p.role !== 'pembina');
  }, [profiles]);

  const filteredPresensi = useMemo(() => {
    if (filterOrg === 'semua') return presensiList;
    return presensiList.filter((p) => p.profile?.organisasi === filterOrg);
  }, [presensiList, filterOrg]);

  const stats = useMemo(() => {
    const totalMembers = activeMembers.length;
    const hadir = presensiList.filter((p) => p.status === 'hadir').length;
    const izin = presensiList.filter((p) => p.status === 'izin_halangan').length;
    const pelanggaran = presensiList.filter((p) => p.status_verifikasi === 'pelanggaran').length;
    const terverifikasi = presensiList.filter((p) => p.status_verifikasi === 'terverifikasi').length;

    return { totalMembers, hadir, izin, pelanggaran, terverifikasi };
  }, [activeMembers, presensiList]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Pembina */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Akses Pembina Kesiswaan (Read-Only)
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Laporan & Rekapitulasi Ibadah OSIS / MPK
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Selamat datang, <span className="font-semibold text-slate-800">{currentUser.full_name}</span> ({currentUser.jabatan}).
          </p>
        </div>

        {/* Tombol Ekspor Cepat */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToExcel(presensiList, 'Laporan_Pembina_OSIS_MPK')}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            onClick={() =>
              exportToPDF(
                presensiList,
                'Laporan Semester',
                'Fadhil Pratama',
                currentUser.full_name
              )
            }
            className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Cetak PDF Resmi</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS RINGKASAN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Anggota Terdaftar
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.totalMembers}</div>
          <div className="text-[11px] text-slate-500 mt-1">OSIS & MPK Aktif</div>
        </div>

        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Presensi Terverifikasi
          </div>
          <div className="text-3xl font-black text-emerald-800 mt-2">{stats.terverifikasi}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Divalidasi Pengurus</div>
        </div>

        <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Izin / Halangan Syar&apos;i
          </div>
          <div className="text-3xl font-black text-amber-800 mt-2">{stats.izin}</div>
          <div className="text-[11px] text-amber-600 mt-1">Dengan Keterangan</div>
        </div>

        <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">
            Pelanggaran Tercatat
          </div>
          <div className="text-3xl font-black text-rose-800 mt-2 flex items-center gap-2">
            {stats.pelanggaran}
            {stats.pelanggaran > 0 && <AlertTriangle className="w-5 h-5 text-rose-500" />}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">Check-in Tidak Jujur</div>
        </div>
      </div>

      {/* TABEL REKAPITULASI DETAIL READ-ONLY */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">
              Daftar Rekapitulasi Presensi Ibadah
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Filter:</span>
            <select
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
            >
              <option value="semua">Semua Organisasi</option>
              <option value="OSIS">OSIS</option>
              <option value="MPK">MPK</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Nama Anggota</th>
                <th className="py-2.5 px-3">Organisasi</th>
                <th className="py-2.5 px-3">Ibadah</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Status Verifikasi</th>
                <th className="py-2.5 px-3">Catatan Pengurus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPresensi.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono">{formatTanggalIndonesia(item.tanggal)}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{item.profile?.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {item.profile?.nis}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    {item.profile?.organisasi} ({item.profile?.kelas})
                  </td>
                  <td className="py-3 px-3">
                    {item.ibadah === 'sholat_dzuhur' ? 'Dzuhur' : 'Pend. Iman'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
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
                  <td className="py-3 px-3 font-mono">{formatJamWIB(item.waktu_checkin)}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
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
                  <td className="py-3 px-3 text-slate-600">
                    {item.catatan_pengurus || item.keterangan_halangan || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIWAYAT AUDIT READ-ONLY */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" />
          <h3 className="font-bold text-sm text-slate-900">Audit Trail Aktivitas Sistem</h3>
        </div>
        <div className="space-y-2">
          {auditLogs.slice(0, 10).map((l) => (
            <div
              key={l.id}
              className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
            >
              <span className="font-medium text-slate-700">
                <span className="font-bold text-slate-900">{l.actor_name}</span>: {l.action} ({l.table_name})
              </span>
              <span className="font-mono text-[11px] text-slate-400">{formatJamWIB(l.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
