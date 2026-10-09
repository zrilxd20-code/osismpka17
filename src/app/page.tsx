'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { dataService, DEFAULT_PROFILES } from '@/lib/data-service';
import Navbar from '@/components/Navbar';
import AnggotaView from '@/components/AnggotaView';
import PengurusView from '@/components/PengurusView';
import PembinaView from '@/components/PembinaView';
import Image from 'next/image';
import { LogIn, RefreshCw, BookOpenCheck, Clock3, MapPin } from 'lucide-react';

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
      handleLogout();
    } else {
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
      setLoginError('Isi dulu nama panjangnya sesuai daftar anggota.');
      return;
    }

    if (!trimmedPass) {
      setLoginError('Isi kata sandi. Kalau belum pernah ganti, pakai: osismpka17');
      return;
    }

    const found = dataService.getProfileByName(trimmedName);
    if (!found) {
      setLoginError('Nama tidak ketemu di daftar OSIS & MPK. Cek lagi ejaannya, misalnya huruf kapital atau spasi ganda.');
      return;
    }

    const isMatch = dataService.verifyPassword(found, trimmedPass);
    if (!isMatch) {
      setLoginError('Kata sandinya keliru. Kata sandi awal adalah: osismpka17');
      return;
    }

    handleSelectUser(found);
    setNameInput('');
    setPasswordInput('');
  };

  const handleResetData = () => {
    if (confirm('Kembalikan data ke awal (seed data 39 anggota asli)?')) {
      dataService.resetToDefault();
      const def = DEFAULT_PROFILES[2];
      dataService.setCurrentUser(def);
      setCurrentUser(def);
      setRefreshKey((prev) => prev + 1);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-[3px] border-[#175e3c] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-stone-500">Membuka buku presensi…</p>
        </div>
      </div>
    );
  }

  // --- HALAMAN LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-[#e3ddd0] bg-[#fffdf8] shadow-[0_1px_0_#e3ddd0] grid md:grid-cols-[1.02fr_1fr]">
          {/* Panel kiri: identitas sekolah, solid — bukan gradien */}
          <div className="bg-[#0f3d28] text-[#f4f1ea] p-7 sm:p-9 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-white">
                <Image
                  src="/logo-a17.jpg"
                  alt="Logo A17 Divisi Agama SMKN 17"
                  width={56}
                  height={56}
                  priority
                  className="size-full object-cover"
                />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d9c9a3]">
                  SMKN 17 Jakarta
                </p>
                <p className="text-sm font-bold leading-tight">
                  Divisi 1 Keagamaan (A17)
                  <span className="block text-xs font-medium text-white/70">
                    OSIS &amp; MPK
                  </span>
                </p>
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-[28px] font-extrabold leading-[1.15]">
                Buku presensi ibadah harian.
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Catat kehadiran Sholat Dzuhur dan Pendalaman Iman tiap hari.
                Batas kirim normal pukul 18.00 WIB, paling maksimal ditunggu hingga pukul 21.00 WIB.
              </p>
            </div>

            <dl className="rounded-lg border border-white/15 bg-white/[0.04] divide-y divide-white/10 text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="flex items-center gap-2 font-semibold">
                  <Clock3 className="size-4 text-[#d9c9a3]" />
                  Sholat Dzuhur
                </dt>
                <dd className="font-mono text-xs tabular-nums text-white/85 text-right">
                  11.30–18.00 <span className="text-[11px] text-[#f6ecd8]">(Maks 21.00 WIB)</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="flex items-center gap-2 font-semibold">
                  <BookOpenCheck className="size-4 text-[#d9c9a3]" />
                  Pendalaman Iman
                </dt>
                <dd className="font-mono text-xs tabular-nums text-white/85 text-right">
                  11.45–18.00 <span className="text-[11px] text-[#f6ecd8]">(Maks 21.00 WIB)</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="flex items-center gap-2 font-semibold">
                  <MapPin className="size-4 text-[#d9c9a3]" />
                  Tempat
                </dt>
                <dd className="text-xs text-white/85 text-right">Musholla utama / Ruang kerohanian</dd>
              </div>
            </dl>

            <p className="mt-auto border-t border-white/15 pt-4 text-xs leading-relaxed text-white/60">
              “Yang dicatat hari ini jadi laporan pembina tiap pekannya.
              Kalau izin, tulis keterangannya yang jelas.”
              <span className="mt-1 block font-semibold text-white/80">— Pengurus A17</span>
            </p>
          </div>

          {/* Panel kanan: formulir */}
          <div className="p-7 sm:p-9">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">
              Masuk anggota
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-stone-900">
              Pakai nama panjang + kata sandi
            </h2>
            <p className="mt-1 text-[13px] text-stone-500">
              Sesuai daftar 39 anggota. Kata sandi awal:{' '}
              <code className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-xs">
                osismpka17
              </code>
            </p>

            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <label htmlFor="nama" className="mb-1.5 block text-[13px] font-bold text-stone-700">
                  Nama panjang
                </label>
                <input
                  id="nama"
                  type="text"
                  autoComplete="name"
                  placeholder="mis. Muhammad Faris"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="h-11 w-full rounded-[10px] border border-stone-300 bg-white px-3.5 text-sm font-medium placeholder:text-stone-400"
                  required
                />

                {nameInput.trim().length >= 2 && showSuggestions && (() => {
                  const results = dataService.searchProfilesByName(nameInput, 5);
                  if (results.length === 0) return null;
                  return (
                    <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                      <div className="bg-stone-100 px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                        {results.length} nama cocok — pilih satu
                      </div>
                      <ul className="max-h-56 divide-y divide-stone-100 overflow-y-auto">
                        {results.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setNameInput(p.full_name || p.nama);
                                setShowSuggestions(false);
                              }}
                              className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-stone-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-bold text-stone-800">
                                  {p.full_name || p.nama}
                                </span>
                                <span className="block truncate font-mono text-[11px] tabular-nums text-stone-500">
                                  {p.organisasi} · {p.kelas}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-md border border-[#175e3c]/30 bg-[#e9efe7] px-2 py-1 text-[11px] font-bold text-[#175e3c]">
                                Pilih
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label htmlFor="sandi" className="mb-1.5 block text-[13px] font-bold text-stone-700">
                  Kata sandi
                </label>
                <input
                  id="sandi"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Kata sandi akun"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-stone-300 bg-white px-3.5 font-mono text-sm placeholder:font-sans placeholder:text-stone-400"
                  required
                />
              </div>

              {loginError && (
                <div role="alert" className="rounded-[10px] border border-[#9f1239]/25 border-l-4 border-l-[#9f1239] bg-[#f9e8ec] px-3.5 py-3 text-[13px] font-medium leading-relaxed text-[#7a0e2c]">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#175e3c] text-sm font-bold text-white transition-colors hover:bg-[#0f3d28]"
              >
                <LogIn className="size-4" />
                <span>Masuk ke buku presensi</span>
              </button>
            </form>

            <p className="mt-6 border-t-2 border-double border-stone-300 pt-3 font-mono text-[11px] tabular-nums text-stone-400">
              TA 2025/2026 · Divisi 1 Keagamaan · OSIS &amp; MPK SMKN 17
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- HALAMAN UTAMA SETELAH LOGIN ---
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
        isDemoMode={isDemoMode}
      />

      {isDemoMode && (
        <div className="border-b border-stone-800 bg-stone-900 px-4 py-2 text-stone-200">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
              <span className="size-2 rounded-full bg-amber-400" />
              Mode demo — ganti peran
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[2])}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === 'usr-03'
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Pengurus (Al Qoirul)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[17])}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === 'usr-18'
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Pengurus (Maria Jame)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[1])}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === 'usr-02'
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Anggota (Islam)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[7])}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === 'usr-08'
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Anggota (Kristen)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[39])}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === DEFAULT_PROFILES[39]?.id
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Pembina (Nurkholis)
              </button>
              <button
                onClick={() => handleSelectUser(DEFAULT_PROFILES[40])}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                  currentUser.id === DEFAULT_PROFILES[40]?.id
                    ? 'border-amber-300 bg-amber-300 text-stone-900'
                    : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                }`}
              >
                Pembina (Maria Ulfa)
              </button>
              <button
                onClick={handleResetData}
                title="Reset data demo ke awal"
                aria-label="Reset data demo"
                className="rounded-md p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                onClick={() => handleToggleDemoMode(false)}
                title="Keluar dari mode demo"
                className="ml-1 rounded-md border border-red-900 bg-red-950 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900"
              >
                Keluar demo
              </button>
            </div>
          </div>
        </div>
      )}

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

      <footer className="border-t border-[#e3ddd0] bg-[#fffdf8] px-4 py-5">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[13px] font-semibold text-stone-700">
            Masuk sebagai {currentUser.full_name} ·{' '}
            <button onClick={handleLogout} className="font-bold text-[#9f1239] underline underline-offset-2 hover:no-underline">
              Keluar akun
            </button>
          </p>
          <p className="mt-1 border-t-2 border-double border-stone-300 pt-2 font-mono text-[11px] tabular-nums text-stone-400">
            Buku Presensi A17 · Divisi 1 Keagamaan · OSIS &amp; MPK SMKN 17 Jakarta · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
