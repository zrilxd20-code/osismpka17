# Presensi Ibadah A17 — OSIS & MPK SMKN 17

Sistem presensi ibadah mandiri (sholat dzuhur & pendalaman iman) untuk pengurus OSIS & MPK SMKN 17 — Divisi Keagamaan A17.

### Ketentuan Waktu Pengiriman Laporan (WIB):
* **Dibuka**: Mulai pukul **11:30 WIB** (Sholat Dzuhur) / **11:45 WIB** (Pendalaman Iman).
* **Batas Normal (Tepat Waktu)**: Pukul **18:00 WIB**.
* **Masa Toleransi (Terlambat)**: Pukul **18:00 – 21:00 WIB** (Laporan tetap diterima dan otomatis dicatat terlambat).
* **Batas Maksimal (Ditutup)**: Pukul **21:00 WIB** (Pengiriman laporan hari tersebut ditutup penuh).

Stack: **Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS) + Tailwind CSS 4**

## Jalankan lokal

```bash
npm install
cp .env.example .env.local  # isi kredensial Supabase
npm run dev
```

Buka http://localhost:3000

| Env | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **server only, jangan expose** |
| `NEXT_PUBLIC_DEMO_MODE` | `true` = data mock lokal, `false` = live Supabase |

## Setup database

1. Buat project di Supabase Dashboard
2. SQL Editor → jalankan `supabase/migrations/20261003_init_backend.sql`
3. (Opsional) jalankan `supabase/seed.sql` untuk data awal

## Test backend

```bash
node scripts/test-endpoints.mjs
```

## Deploy ke Vercel

1. Push ke GitHub (`master` → `origin`)
2. Vercel → Add New → Project → pilih repo `osismpka17`
3. Tambahkan Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_DEMO_MODE=false`
4. Deploy. Domain sementara: `https://osismpka17.vercel.app`
5. Custom domain (nanti): Vercel → Settings → Domains → Add → ikuti instruksi DNS.

Panduan lengkap: lihat `SETUP_DEPLOY_GUIDE.md`.

## Keamanan

- `.env.local` tidak pernah di-commit (sudah di `.gitignore`)
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di Route Handler server (`src/lib/supabase/server.ts`)
- RLS: anggota hanya insert milik sendiri, pengurus full akses, pembina read-only
