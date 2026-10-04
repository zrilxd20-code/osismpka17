'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { dataService, DEFAULT_PROFILES } from '@/lib/data-service';
import Navbar from '@/components/Navbar';
import AnggotaView from '@/components/AnggotaView';
import PengurusView from '@/components/PengurusView';
import PembinaView from '@/components/PembinaView';
import { LogIn, KeyRound, Sparkles, User, RefreshCw, Lock, ShieldCheck, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Login form state
  const [nisInput, setNisInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Cek preferensi mode demo
    const savedDemo = localStorage.getItem('osis_mpk_demo_mode');
    const demoActive = savedDemo !== null ? savedDemo === 'true' : process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
    setIsDemoMode(demoActive);

    const user = dataService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    } else if (demoActive) {
      // Default ke Al Qoirul Lathif (Pengurus / Kamu Sendiri) jika pertama kali buka demo
      const def = DEFAULT_PROFILES[2];
      dataService.setCurrentUser(def);
      setCurrentUser(def);
    }
  }, []);

  const handleSelectUser = (user: Profile) => {
    dataService.setCurrentUser(user);
    setCurrentUser(user);
    setRefreshKey((prev) => prev + 1);
  };

  const handleLogout = () => {
    dataService.logout();
    setCurrentUser(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleToggleDemoMode = (val: boolean) => {
    setIsDemoMode(val);
    localStorage.setItem('osis_mpk_demo_mode', String(val));
    if (!val) {
      // Keluar dari mode demo: logout agar masuk melalui form login mandiri
      handleLogout();
    } else {
      // Masuk kembali ke mode demo: langsung arahkan ke Al Qoirul (Pengurus)
      const def = DEFAULT_PROFILES[2];
      handleSelectUser(def);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const trimmedNis = nisInput.trim();
    if (!trimmedNis) {
      setLoginError('Nomor Induk Siswa (NIS) wajib diisi.');
      return;
    }

    const found = dataService.getProfileByNis(trimmedNis);
    if (found) {
      handleSelectUser(found);
      setNisInput('');
      setPasswordInput('');
    } else {
      setLoginError('NIS tidak ditemukan dalam daftar anggota OSIS & MPK.');
    }
  };

  const handleResetData = () => {
    if (confirm('Kembalikan data ke awal (seed data 39 anggota asli)?')) {
      dataService.resetToDefault();
      const def = DEFAULT_PROFILES[2]; // Al Qoirul Lathif Nazzril Putra
      dataService.setCurrentUser(def);
      setCurrentUser(def);
      setRefreshKey((prev) => prev + 1);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Memuat Sistem Presensi Ibadah...</p>
        </div>
      </div>
    );
  }

  // --- HALAMAN LOGIN RESMI JIKA BELUM ADA PENGGUNA AKTIF ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-100 space-y-6 animate-in fade-in duration-300">
          {/* Header & Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 items-center justify-center text-white shadow-lg shadow-emerald-500/25">
              <span className="font-black text-xl tracking-wider">OM17</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Presensi Ibadah OSIS & MPK
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Sholat Dzuhur Berjamaah & Pendalaman Iman Kristen
            </p>
          </div>

          {/* Mode Demo Banner Toggle */}
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
            isDemoMode ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${isDemoMode ? 'text-amber-600' : 'text-emerald-600'}`} />
              <span className="font-semibold">
                Status: {isDemoMode ? 'Mode Demo Pengujian' : 'Mode Produksi Resmi'}
              </span>
            </div>
            <button
              onClick={() => handleToggleDemoMode(!isDemoMode)}
              className="text-[11px] font-bold underline hover:opacity-80"
            >
              {isDemoMode ? 'Matikan' : 'Aktifkan'}
            </button>
          </div>

          {/* Form Login Mandiri */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor Induk Siswa (NIS)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik NIS Anda (contoh: 2425003)"
                  value={nisInput}
                  onChange={(e) => setNisInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Kata Sandi</span>
                <span className="text-[10px] text-slate-400 font-normal">Default: Sesuai NIS</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk ke Akun</span>
            </button>
          </form>

          {/* Shortcut Masuk Cepat jika Mode Demo Aktif */}
          {isDemoMode && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Atau Masuk Cepat Sebagai Akun Uji:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleSelectUser(DEFAULT_PROFILES[2])}
                  className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-left transition-all"
                >
                  <div className="text-[10px] text-emerald-600 uppercase">Pengurus (Kamu)</div>
                  <div className="truncate">Al Qoirul Lathif</div>
                </button>

                <button
                  onClick={() => handleSelectUser(DEFAULT_PROFILES[17])}
                  className="p-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-left transition-all"
                >
                  <div className="text-[10px] text-teal-600 uppercase">Pengurus Kristen</div>
                  <div className="truncate">Maria Jame</div>
                </button>

                <button
                  onClick={() => handleSelectUser(DEFAULT_PROFILES[1])}
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-left transition-all"
                >
                  <div className="text-[10px] text-blue-600 uppercase">Anggota (Islam)</div>
                  <div className="truncate">A Isy Mifta</div>
                </button>

                <button
                  onClick={() => handleSelectUser(DEFAULT_PROFILES[7])}
                  className="p-2.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-left transition-all"
                >
                  <div className="text-[10px] text-sky-600 uppercase">Anggota (Kristen)</div>
                  <div className="truncate">Bintang Very</div>
                </button>
              </div>

              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[39] || DEFAULT_PROFILES[DEFAULT_PROFILES.length - 1])}
                className="w-full p-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-center transition-all text-xs"
              >
                Masuk sebagai Pembina: Drs. H. Mulyadi, M.Pd.
              </button>
            </div>
          )}

          <div className="text-center text-[11px] text-slate-400">
            Divisi Keagamaan OSIS & MPK SMAN 17 • Waktu Server: WIB (UTC+7)
          </div>
        </div>
      </div>
    );
  }

  // --- HALAMAN UTAMA DASHBOARD SETELAH PENGGUNA LOGIN ---
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
        isDemoMode={isDemoMode}
      />

      {/* QUICK ROLE SWITCHER RIBBON (Hanya Tampil Jika Mode Demo Aktif) */}
      {isDemoMode && (
        <div className="bg-emerald-950 text-emerald-100 px-4 py-2 border-b border-emerald-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-white">Mode Demo:</span>
              <span className="text-emerald-300 hidden sm:inline">Uji coba peran:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Pengurus (Kamu) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[2])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === 'usr-03'
                    ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                    : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100'
                }`}
              >
                Pengurus (Al Qoirul)
              </button>

              {/* Pengurus Kristen (Maria Jame) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[17])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === 'usr-18'
                    ? 'bg-teal-300 text-teal-950 shadow-xs'
                    : 'bg-teal-900/80 hover:bg-teal-800 text-teal-100'
                }`}
              >
                Pengurus (Maria Jame)
              </button>

              {/* Anggota Islam (A Isy) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[1])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === 'usr-02'
                    ? 'bg-blue-300 text-blue-950 shadow-xs'
                    : 'bg-blue-900/70 hover:bg-blue-800 text-blue-100'
                }`}
              >
                Anggota (Islam)
              </button>

              {/* Anggota Kristen (Bintang Very) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[7])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === 'usr-08'
                    ? 'bg-sky-300 text-sky-950 shadow-xs'
                    : 'bg-sky-900/70 hover:bg-sky-800 text-sky-100'
                }`}
              >
                Anggota (Kristen)
              </button>

              {/* Tombol Pembina (Drs. H. Mulyadi) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[39] || DEFAULT_PROFILES[DEFAULT_PROFILES.length - 1])}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.role === 'pembina'
                    ? 'bg-purple-300 text-purple-950 shadow-xs'
                    : 'bg-purple-900/70 hover:bg-purple-800 text-purple-100'
                }`}
              >
                Pembina
              </button>

              {/* Reset data seed */}
              <button
                onClick={handleResetData}
                title="Reset data demo ke awal"
                className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900 transition-colors ml-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Tombol Matikan Mode Demo */}
              <button
                onClick={() => handleToggleDemoMode(false)}
                title="Keluar dari mode demo dan kunci ke mode login resmi"
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors ml-1"
              >
                Keluar Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 pb-16">
        {currentUser.role === 'pengurus' ? (
          <PengurusView
            key={`pengurus-${refreshKey}`}
            currentUser={currentUser}
            onRefreshData={() => setRefreshKey((k) => k + 1)}
          />
        ) : currentUser.role === 'pembina' ? (
          <PembinaView
            key={`pembina-${refreshKey}`}
            currentUser={currentUser}
          />
        ) : (
          <AnggotaView
            key={`anggota-${currentUser.id}-${refreshKey}`}
            currentUser={currentUser}
            onRefreshData={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold text-slate-700">Login sebagai: {currentUser.full_name}</span>
            <span className="text-slate-400">•</span>
            <button
              onClick={handleLogout}
              className="text-rose-600 hover:underline font-bold"
            >
              Keluar Akun
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Pencatatan Ibadah OSIS & MPK • Sholat Dzuhur & Pendalaman Iman • Waktu Server WIB
          </div>

          {!isDemoMode && (
            <button
              onClick={() => handleToggleDemoMode(true)}
              className="text-[10px] text-slate-400 hover:text-emerald-600 underline"
            >
              Aktifkan kembali Mode Demo Pengujian
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
