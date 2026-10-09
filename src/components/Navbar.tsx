'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Profile } from '@/types/database';
import { getCurrentTimeWIB } from '@/lib/time-utils';
import { DEFAULT_PROFILES, dataService } from '@/lib/data-service';
import { Clock, ShieldCheck, UserCheck, Users, ChevronDown, Check, Sparkles, LogOut, KeyRound, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentUser: Profile;
  onSelectUser: (user: Profile) => void;
  onLogout?: () => void;
  isDemoMode?: boolean;
}

export default function Navbar({ currentUser, onSelectUser, onLogout, isDemoMode = true }: NavbarProps) {
  const [timeWIB, setTimeWIB] = useState<string>('');
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  
  // State Ganti Kata Sandi Mandiri
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword.trim()) {
      setPasswordError('Kata sandi saat ini wajib diisi.');
      return;
    }

    if (!dataService.verifyPassword(currentUser, oldPassword)) {
      setPasswordError('Kata sandi saat ini salah. (Default: osismpka17)');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Kata sandi baru minimal 4 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    dataService.setPassword(currentUser.id, newPassword);
    setPasswordSuccess('Kata sandi Anda berhasil diperbarui!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setPasswordSuccess(null);
      setShowPasswordModal(false);
    }, 1500);
  };

  useEffect(() => {
    setTimeWIB(getCurrentTimeWIB());
    const interval = setInterval(() => {
      setTimeWIB(getCurrentTimeWIB());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRoleBadge = (role: Profile['role']) => {
    switch (role) {
      case 'pengurus':
        return {
          label: 'Pengurus Keagamaan',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: ShieldCheck,
        };
      case 'pembina':
        return {
          label: 'Pembina OSIS/MPK',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: UserCheck,
        };
      default:
        return {
          label: 'Anggota',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Users,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);
  const Icon = badge.icon;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & App Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/30 shrink-0 bg-slate-900 flex items-center justify-center" title="A17: Divisi Agama SMKN 17">
                <Image
                  src="/logo-a17.jpg"
                  alt="Logo A17"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Presensi Ibadah A17
                </h1>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                  Divisi Agama • OSIS & MPK SMKN 17
                </p>
              </div>
            </div>

            {/* Right Items: WIB Clock + User + Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* WIB Clock Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>{timeWIB || '12:00:00'} <span className="text-[10px] text-slate-500">WIB</span></span>
              </div>

              {/* Active User Button */}
              {isDemoMode ? (
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left group"
                  title="Ganti Akun Demo (Klik untuk beralih)"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {currentUser.full_name.charAt(0)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      {currentUser.full_name}
                      <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {currentUser.organisasi} • {currentUser.kelas}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {currentUser.full_name.charAt(0)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-800">
                      {currentUser.full_name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {currentUser.organisasi} • {currentUser.kelas}
                    </div>
                  </div>
                </div>
              )}

              {/* Ganti Kata Sandi Button */}
              <button
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setShowPasswordModal(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-all text-xs font-bold"
                title="Ganti Kata Sandi Akun"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                <span className="hidden sm:inline">Ganti Sandi</span>
              </button>

              {/* Logout Button */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-all text-xs font-bold"
                  title="Keluar dari akun (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sub-header Banner showing role */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.color}`}>
              <Icon className="w-3 h-3" />
              {badge.label}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-600 font-medium">
              Agama: <span className="font-semibold text-slate-800 capitalize">{currentUser.agama}</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-600 font-medium">
              Kelas: <span className="font-semibold text-slate-800">{currentUser.kelas}</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-600 font-medium">
              Organisasi: <span className="font-semibold text-slate-800">{currentUser.organisasi}</span>
            </span>
          </div>

          {isDemoMode && (
            <button
              onClick={() => setShowUserModal(true)}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 shrink-0 ml-2"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Ganti Peran /</span> Switch Demo
            </button>
          )}
        </div>
      </header>

      {/* Role Switcher Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Pilih Profil Pengguna</h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Uji alur aplikasi untuk masing-masing peran
                </p>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                Akun Demo Siap Pakai
              </div>

              {DEFAULT_PROFILES.map((p) => {
                const isSelected = p.id === currentUser.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectUser(p);
                      setShowUserModal(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                          p.role === 'pengurus'
                            ? 'bg-emerald-600 text-white'
                            : p.role === 'pembina'
                            ? 'bg-purple-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {p.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {p.full_name}
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                              p.role === 'pengurus'
                                ? 'bg-emerald-100 text-emerald-700'
                                : p.role === 'pembina'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {p.role}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.organisasi} • {p.kelas} • Agama: <span className="capitalize">{p.agama}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Ganti Kata Sandi Mandiri */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Ubah Kata Sandi</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{currentUser.full_name || currentUser.nama}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Saat Ini
                </label>
                <input
                  type="password"
                  placeholder="Ketik sandi saat ini (default: osismpka17)"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Baru
                </label>
                <input
                  type="password"
                  placeholder="Minimal 4 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type="password"
                  placeholder="Ketik ulang sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  required
                />
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                >
                  Simpan Sandi Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
