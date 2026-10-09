'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { dataService, DEFAULT_PROFILES } from '@/lib/data-service';
import Navbar from '@/components/Navbar';
import AnggotaView from '@/components/AnggotaView';
import PengurusView from '@/components/PengurusView';
import PembinaView from '@/components/PembinaView';
import Image from 'next/image';
import { Sparkles, LogIn, RefreshCw } from 'lucide-react';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Login form state (Hanya Nama Panjang & Password)
  const [nameInput, setNameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);

  useEffect(() => {
    setIsClient(true);
    const savedDemo = localStorage.getItem('osis_mpk_demo_mode');
    const demoActive = savedDemo === 'true';
    setIsDemoMode(demoActive);

    const user = dataService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
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
    const trimmedName = nameInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedName) {
      setLoginError('Nama panjang wajib diisi.');
      return;
    }

    if (!trimmedPass) {
      setLoginError('Kata sandi wajib diisi (Default: osismpka17).');
      return;
    }

    const found = dataService.getProfileByName(trimmedName);
    if (!found) {
      setLoginError('Nama tidak ditemukan dalam daftar anggota OSIS & MPK. Silakan periksa ejaan nama.');
      return;
    }

    const isMatch = dataService.verifyPassword(found, trimmedPass);
    if (!isMatch) {
      setLoginError('Kata sandi salah. Kata sandi default adalah: osismpka17');
      return;
    }

    handleSelectUser(found);
    setNameInput('');
    setPasswordInput('');
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
            <div className="flex justify-center mb-2">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden shadow-xl shadow-emerald-950/20 ring-4 ring-emerald-500/20 bg-slate-900 flex items-center justify-center transition-transform hover:scale-105" title="A17: Divisi Agama SMKN 17">
                <Image
                  src="/logo-a17.jpg"
                  alt="Logo A17 Divisi Agama SMKN 17"
                  width={96}
                  height={96}
                  priority
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Presensi Ibadah OSIS & MPK SMKN 17
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Sistem Informasi Presensi Ibadah Mandiri (Sholat Dzuhur & Pendalaman Iman)
            </p>
          </div>

          {/* Form Login Mandiri (Nama Panjang & Password) */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Nama Panjang</span>
                <span className="text-[10px] text-emerald-600 font-medium">Ketik nama lengkap</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik Nama Panjang (contoh: Muhammad Faris)"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium"
                  required
                />
              </div>

              {/* Rekomendasi Nama Siswa Otomatis saat mengetik */}
              {nameInput.trim().length >= 2 && showSuggestions && (() => {
                const results = dataService.searchProfilesByName(nameInput, 5);
                if (results.length === 0) return null;
                return (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Pilih Nama Anggota:
                    </div>
                    {results.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setNameInput(p.full_name || p.nama);
                          setShowSuggestions(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-800 truncate group-hover:text-emerald-700">
                            {p.full_name || p.nama}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {p.organisasi} • {p.kelas}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 group-hover:bg-emerald-200 px-2.5 py-1 rounded-lg">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Kata Sandi</span>
                <span className="text-[10px] text-emerald-600 font-medium">Default: osismpka17</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Ketik kata sandi (default: osismpka17)"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  required
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

          <div className="text-center pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            © 2026 Divisi 1 Keagamaan • OSIS & MPK SMKN 17 Jakarta
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

              {/* Tombol Pembina (Nurkholis Aiman & Maria Ulfa) */}
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[39])}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === DEFAULT_PROFILES[39]?.id
                    ? 'bg-purple-300 text-purple-950 shadow-xs'
                    : 'bg-purple-900/70 hover:bg-purple-800 text-purple-100'
                }`}
              >
                Pembina (Nurkholis)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[40])}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  currentUser.id === DEFAULT_PROFILES[40]?.id
                    ? 'bg-purple-300 text-purple-950 shadow-xs'
                    : 'bg-purple-900/70 hover:bg-purple-800 text-purple-100'
                }`}
              >
                Pembina (Maria Ulfa)
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
            © 2026 Divisi 1 Keagamaan • OSIS & MPK SMKN 17 Jakarta
          </div>
        </div>
      </footer>
    </div>
  );
}
