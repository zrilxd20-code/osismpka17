# Panduan Lengkap Backend: Pencatatan Ibadah OSIS & MPK

Aplikasi Backend lengkap untuk **"Pencatatan Ibadah OSIS & MPK"** berbasis **Next.js (App Router, Route Handlers)** + **Supabase (PostgreSQL, Auth, Row Level Security)**. Seluruh logika server, validasi waktu zona Asia/Jakarta (WIB), keamanan RLS, impor file Excel/CSV, dan ekspor laporan telah siap produksi.

---

## 1. Struktur Folder Backend

```
├── supabase/
│   ├── migrations/
│   │   └── 20261003_init_backend.sql  # Skema lengkap, index, trigger audit, RLS policies, seed jenis ibadah
│   ├── schema.sql                     # Skema tersinkronisasi untuk SQL Editor
│   └── seed.sql                       # Data awal pengguna OSIS/MPK dan riwayat presensi
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── checkin/
│   │   │   │   ├── route.ts                         # POST /api/checkin (server-side time, agama, duplikat)
│   │   │   │   └── [id]/verifikasi/route.ts         # PATCH /api/checkin/[id]/verifikasi (pengurus)
│   │   │   ├── pengurus/
│   │   │   │   └── input-manual/route.ts            # POST /api/pengurus/input-manual
│   │   │   ├── dashboard/
│   │   │   │   └── belum-checkin/route.ts           # GET /api/dashboard/belum-checkin
│   │   │   ├── cek-acak/
│   │   │   │   ├── route.ts                         # POST /api/cek-acak (acak N anggota hadir)
│   │   │   │   └── [id]/route.ts                    # PATCH /api/cek-acak/[id] (catat hasil cek lapangan)
│   │   │   ├── pelanggaran/
│   │   │   │   └── route.ts                         # POST /api/pelanggaran
│   │   │   ├── rekap/
│   │   │   │   └── route.ts                         # GET /api/rekap (harian, mingguan, bulanan)
│   │   │   ├── export/
│   │   │   │   └── route.ts                         # GET /api/export (format=xlsx via exceljs, pdf via pdf-lib)
│   │   │   ├── pengaturan/
│   │   │   │   └── jenis-ibadah/route.ts            # GET/PATCH /api/pengaturan/jenis-ibadah
│   │   │   ├── impor/
│   │   │   │   ├── template/route.ts                # GET /api/impor/template (download Excel template)
│   │   │   │   ├── preview/route.ts                 # POST /api/impor/preview (tolak PDF/Word, validasi)
│   │   │   │   ├── konfirmasi/route.ts              # POST /api/impor/konfirmasi (batch auth + profile + kredensial)
│   │   │   │   └── batch/[id]/laporan-gagal/route.ts # GET /api/impor/batch/[id]/laporan-gagal (download CSV error)
│   │   │   └── anggota/
│   │   │       ├── route.ts                         # POST /api/anggota (tambah anggota satuan)
│   │   │       └── [id]/
│   │   │           ├── route.ts                     # PATCH /api/anggota/[id] (edit anggota)
│   │   │           ├── status/route.ts              # PATCH /api/anggota/[id]/status (aktif/nonaktif)
│   │   │           └── reset-password/route.ts      # POST /api/anggota/[id]/reset-password
├── src/lib/
│   ├── server-time.ts                 # Perhitungan waktu server WIB (Asia/Jakarta)
│   ├── rate-limiter.ts                # In-memory rate limiting endpoint checkin
│   ├── impor-parser.ts                # Parser SheetJS, PapaParse, ExcelJS, penolak PDF/Word
│   ├── validations/
│   │   └── api-schemas.ts             # Skema validasi Zod dengan pesan error Bahasa Indonesia
│   └── supabase/
│       ├── client.ts                  # Browser SSR client
│       └── server.ts                  # Server client + Admin Service Role client (auth admin)
├── contoh_impor_siswa.csv             # Contoh file CSV impor 10 siswa dummy
├── .env.example                       # Template environment variable
└── scripts/test-endpoints.mjs         # Skrip otomatis pengujian seluruh alur backend
```

---

## 2. Skema Database & Row Level Security (RLS)

### Tabel yang Tersedia
1. **`profiles`**: `id` (FK `auth.users`), `nis` (unique), `nama`, `kelas`, `jabatan`, `agama`, `role` (`anggota`, `pengurus`, `pembina`), `aktif`, `must_change_password`, `created_at`.
2. **`jenis_ibadah`**: `id`, `nama` (`sholat_dzuhur`, `pendalaman_iman`), `label`, `agama_wajib`, `jam_mulai`, `jam_selesai`, `hari_aktif`.
3. **`checkin`**: `id`, `profile_id`, `jenis_ibadah_id`, `tanggal` (WIB), `status` (`hadir`, `tidak_hadir`, `izin`), `keterangan`, `saksi`, `diverifikasi_oleh`, `status_verifikasi` (`menunggu`, `valid`, `tidak_valid`), `catatan_verifikasi`, `dibuat_pada`.
   - Konstrain: `UNIQUE(profile_id, jenis_ibadah_id, tanggal)`.
4. **`cek_acak`**: `id`, `tanggal`, `checkin_id`, `dicek_oleh`, `hasil` (`sesuai`, `tidak_sesuai`, `belum_dicek`), `catatan`.
5. **`pelanggaran`**: `id`, `profile_id`, `checkin_id`, `keterangan`, `dicatat_oleh`, `tanggal`.
6. **`import_batch`**: `id`, `nama_file`, `diunggah_oleh`, `total_baris`, `berhasil`, `gagal`, `laporan_error` (JSONB).
7. **`audit_log`**: `id`, `aktor_id`, `aksi`, `tabel`, `record_id`, `data_lama`, `data_baru`, `waktu`.
   - Dilengkapi Trigger PostgreSQL otomatis `fn_audit_log_trigger()` pada `checkin`, `pelanggaran`, dan `profiles`.

### Ringkasan RLS Policies
- **Anggota**: Hanya `SELECT` dan `INSERT` checkin miliknya sendiri (`profile_id = auth.uid()`). **Dilarang keras `UPDATE` atau `DELETE`** setelah checkin dibuat.
- **Pengurus**: Akses penuh (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) ke `profiles`, `checkin`, `cek_acak`, `pelanggaran`, `import_batch`, dan `audit_log`.
- **Pembina**: `SELECT` saja ke semua tabel data rekapitulasi, **tidak memiliki akses ke `audit_log`**.

---

## 3. Langkah Setup Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com).
2. Buka menu **SQL Editor**, buka file `supabase/migrations/20261003_init_backend.sql`, lalu klik **Run**.
3. Buka **Project Settings** -> **API**:
   - Salin **Project URL**
   - Salin **Project API Keys** -> `anon` `public`
   - Salin **Project API Keys** -> `service_role` `secret` (Hanya untuk server).
4. Buat file `.env.local` pada folder root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUz...
   NEXT_PUBLIC_DEMO_MODE=false
   ```

---

## 4. Panduan Deploy ke Vercel

1. Push repository ke GitHub:
   ```bash
   git add .
   git commit -m "feat: backend lengkap presensi ibadah OSIS & MPK"
   git push origin main
   ```
2. Di Vercel Dashboard, klik **Add New** -> **Project** -> Pilih repository.
3. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_DEMO_MODE` = `false`
4. Klik **Deploy**.

---

## 5. Menjalankan & Menguji Alur Backend Lengkap

Jalankan test suite otomatis yang telah disediakan:
```bash
node scripts/test-endpoints.mjs
```

### Alur Kerja yang Diuji:
1. **Download Template Excel**: `GET /api/impor/template` menghasilkan template resmi dengan 2 sheet (Data Siswa & Petunjuk Pengisian).
2. **Preview Impor Siswa**: `POST /api/impor/preview` mem-parsing file `contoh_impor_siswa.csv`, memvalidasi kolom wajib, dan jika file PDF/Word diunggah otomatis ditolak dengan pesan: *"Ubah dulu ke Excel/CSV memakai template"*.
3. **Konfirmasi Impor & Pembuatan Akun**: `POST /api/impor/konfirmasi` membuat akun auth Supabase dengan password acak unik, menghasilkan file Excel `kredensial-awal.xlsx` untuk pengurus, dan mencatat batch ke `import_batch`.
4. **Check-In Mandiri**: `POST /api/checkin` memvalidasi kesesuaian agama siswa, jendela waktu server WIB, rate limiting, dan menolak check-in ganda di hari yang sama (HTTP 409).
5. **Verifikasi Pengurus**: `PATCH /api/checkin/[id]/verifikasi` menandai status presensi menjadi `valid` atau `tidak_valid`.
6. **Input Manual**: `POST /api/pengurus/input-manual` mencatat kehadiran siswa yang terkendala perangkat.
7. **Monitoring Dashboard**: `GET /api/dashboard/belum-checkin` mendata seluruh anggota aktif yang belum melakukan ibadah hari ini.
8. **Pengecekan Acak (Sidak)**: `POST /api/cek-acak` mengacak nama siswa yang hadir, dan `PATCH /api/cek-acak/[id]` mencatat kesesuaian fisik di lokasi ibadah.
9. **Catatan Pelanggaran**: `POST /api/pelanggaran` mencatat bukti ketidakjujuran check-in siswa.
10. **Rekapitulasi**: `GET /api/rekap` menghitung persentase kehadiran per anggota per periode.
11. **Ekspor Rekap**: `GET /api/export?format=xlsx` (menggunakan ExcelJS) dan `GET /api/export?format=pdf` (menggunakan pdf-lib) menghasilkan berkas resmi bertanda tangan.
