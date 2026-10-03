'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { dataService, DEFAULT_PROFILES } from '@/lib/data-service';
import Navbar from '@/components/Navbar';
import AnggotaView from '@/components/AnggotaView';
import PengurusView from '@/components/PengurusView';
import PembinaView from '@/components/PembinaView';
import { LogIn, KeyRound, Sparkles, User, RefreshCw } from 'lucide-react';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Login form state
  const [nisInput, setNisInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const user = dataService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  const handleSelectUser = (user: Profile) => {
    dataService.setCurrentUser(user);
    setCurrentUser(user);
    setRefreshKey((prev) => prev + 1);
  };

  const handleNisLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!nisInput.trim()) return;

    const found = dataService.getProfileByNis(nisInput.trim());
    if (found) {
      handleSelectUser(found);
      setNisInput('');
    } else {
      setLoginError('NIS tidak terdaftar dalam data anggota OSIS / MPK.');
    }
  };

  const handleResetData = () => {
    if (confirm('Kembalikan data ke awal (seed contoh)?')) {
      dataService.resetToDefault();
      const def = DEFAULT_PROFILES[0];
      dataService.setCurrentUser(def);
      setCurrentUser(def);
      setRefreshKey((prev) => prev + 1);
    }
  };

  if (!isClient || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Memuat Sistem Presensi Ibadah...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* QUICK ROLE SWITCHER RIBBON (Mobile & Desktop Tester Bar) */}
      <div className="bg-emerald-950 text-emerald-100 px-4 py-2 border-b border-emerald-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-white">Mode Demo Interaktif:</span>
            <span className="text-emerald-300 hidden sm:inline">Uji coba peran dengan 1 klik:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {DEFAULT_PROFILES.slice(0, 4).map((p) => {
              const active = p.id === currentUser.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    active
                      ? 'bg-emerald-400 text-emerald-950 shadow-xs scale-102'
                      : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100'
                  }`}
                >
                  {p.role === 'pengurus'
                    ? 'Pengurus'
                    : p.agama === 'kristen'
                    ? 'Anggota (Kristen)'
                    : p.full_name.split(' ')[0]}
                </button>
              );
            })}

            {/* Tombol Pembina */}
            <button
              onClick={() => handleSelectUser(DEFAULT_PROFILES[8])}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentUser.role === 'pembina'
                  ? 'bg-purple-300 text-purple-950 shadow-xs'
                  : 'bg-purple-900/70 hover:bg-purple-800 text-purple-100'
              }`}
            >
              Pembina (Read-Only)
            </button>

            {/* Reset data seed */}
            <button
              onClick={handleResetData}
              title="Reset data demo"
              className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900 transition-colors ml-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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

      {/* QUICK NIS LOGIN DRAWER / FOOTER MODAL */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>Login dengan Nomor Induk Siswa (NIS)</span>
          </div>

          <form onSubmit={handleNisLogin} className="flex gap-2">
            <input
              type="text"
              placeholder="Ketik NIS (contoh: 2425003)"
              value={nisInput}
              onChange={(e) => setNisInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shrink-0"
            >
              Masuk
            </button>
          </form>

          {loginError && (
            <p className="text-[11px] text-rose-600 font-medium">{loginError}</p>
          )}

          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Pencatatan Ibadah OSIS & MPK • Sholat Dzuhur & Pendalaman Iman
          </div>
        </div>
      </footer>
    </div>
  );
}
