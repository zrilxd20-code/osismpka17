-- =====================================================================
-- MIGRASI POSTGRESQL & RLS: BACKEND PENCATATAN IBADAH OSIS & MPK
-- Zona Waktu: Asia/Jakarta (WIB)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nis VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(150) NOT NULL,
    kelas VARCHAR(30) NOT NULL,
    jabatan VARCHAR(80) NOT NULL, -- OSIS / MPK / Sekbid
    agama VARCHAR(30) NOT NULL,   -- islam, kristen, katolik, hindu, buddha, konghucu
    role VARCHAR(20) NOT NULL DEFAULT 'anggota' CHECK (role IN ('anggota', 'pengurus', 'pembina')),
    aktif BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 2. TABEL JENIS IBADAH
CREATE TABLE IF NOT EXISTS public.jenis_ibadah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(60) NOT NULL UNIQUE, -- 'sholat_dzuhur', 'pendalaman_iman'
    label VARCHAR(100) NOT NULL,
    agama_wajib TEXT[] NOT NULL,       -- ['islam'] atau ['kristen', 'katolik']
    jam_mulai TIME NOT NULL DEFAULT '11:30:00',
    jam_selesai TIME NOT NULL DEFAULT '14:00:00',
    hari_aktif INTEGER[] NOT NULL DEFAULT '{1, 2, 3, 4, 5}', -- 1=Senin s/d 5=Jumat
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 3. TABEL CHECKIN
CREATE TABLE IF NOT EXISTS public.checkin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    jenis_ibadah_id UUID NOT NULL REFERENCES public.jenis_ibadah(id) ON DELETE RESTRICT,
    tanggal DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'),
    status VARCHAR(30) NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'tidak_hadir', 'izin')),
    keterangan TEXT,
    saksi VARCHAR(150),
    diverifikasi_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'menunggu' CHECK (status_verifikasi IN ('menunggu', 'valid', 'tidak_valid')),
    catatan_verifikasi TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),

    -- Mencegah check-in ganda di hari dan jenis ibadah yang sama
    CONSTRAINT unique_profile_ibadah_tanggal UNIQUE (profile_id, jenis_ibadah_id, tanggal)
);

-- 4. TABEL CEK ACAK (SIDAK LAPANGAN)
CREATE TABLE IF NOT EXISTS public.cek_acak (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'),
    checkin_id UUID NOT NULL REFERENCES public.checkin(id) ON DELETE CASCADE,
    dicek_oleh UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    hasil VARCHAR(30) NOT NULL DEFAULT 'belum_dicek' CHECK (hasil IN ('sesuai', 'tidak_sesuai', 'belum_dicek')),
    catatan TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 5. TABEL PELANGGARAN
CREATE TABLE IF NOT EXISTS public.pelanggaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    checkin_id UUID REFERENCES public.checkin(id) ON DELETE SET NULL,
    keterangan TEXT NOT NULL,
    dicatat_oleh UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    tanggal DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 6. TABEL IMPORT BATCH
CREATE TABLE IF NOT EXISTS public.import_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_file TEXT NOT NULL,
    diunggah_oleh UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    total_baris INTEGER NOT NULL DEFAULT 0,
    berhasil INTEGER NOT NULL DEFAULT 0,
    gagal INTEGER NOT NULL DEFAULT 0,
    laporan_error JSONB NOT NULL DEFAULT '[]'::jsonb,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 7. TABEL AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aktor_id UUID,
    aksi VARCHAR(60) NOT NULL, -- INSERT, UPDATE, DELETE, VERIFIKASI, IMPORT, RESET_PASSWORD
    tabel VARCHAR(60) NOT NULL,
    record_id UUID,
    data_lama JSONB,
    data_baru JSONB,
    waktu TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- =====================================================================
-- INDEX OPTIMASI QUERY
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_checkin_tanggal ON public.checkin(tanggal);
CREATE INDEX IF NOT EXISTS idx_checkin_profile_id ON public.checkin(profile_id);
CREATE INDEX IF NOT EXISTS idx_checkin_status ON public.checkin(status);
CREATE INDEX IF NOT EXISTS idx_checkin_verifikasi ON public.checkin(status_verifikasi);
CREATE INDEX IF NOT EXISTS idx_profiles_nis ON public.profiles(nis);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON public.profiles(aktif);
CREATE INDEX IF NOT EXISTS idx_profiles_agama ON public.profiles(agama);
CREATE INDEX IF NOT EXISTS idx_cek_acak_tanggal ON public.cek_acak(tanggal);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_profile ON public.pelanggaran(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON public.audit_log(waktu DESC);

-- =====================================================================
-- HELPER FUNCTIONS & TRIGGER AUDIT
-- =====================================================================

-- Fungsi mendapatkan role user yang sedang terotentikasi (Security Definer)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger Function untuk Audit Log Otomatis
CREATE OR REPLACE FUNCTION public.fn_audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id;
        v_old_data := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id;
        v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO public.audit_log (aktor_id, aksi, tabel, record_id, data_lama, data_baru, waktu)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old_data,
        v_new_data,
        (now() AT TIME ZONE 'Asia/Jakarta')
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger Audit di tabel-tabel utama
DROP TRIGGER IF EXISTS trg_audit_checkin ON public.checkin;
CREATE TRIGGER trg_audit_checkin
AFTER INSERT OR UPDATE OR DELETE ON public.checkin
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_pelanggaran ON public.pelanggaran;
CREATE TRIGGER trg_audit_pelanggaran
AFTER INSERT OR UPDATE OR DELETE ON public.pelanggaran
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenis_ibadah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cek_acak ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 1. POLICIES PROFILES
-- Anggota baca miliknya sendiri; Pengurus & Pembina baca semua
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.get_auth_role() IN ('pengurus', 'pembina')
);

-- Hanya pengurus yang bisa INSERT/UPDATE/DELETE profile
CREATE POLICY "profiles_pengurus_manage"
ON public.profiles FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- 2. POLICIES JENIS_IBADAH
-- Semua user terautentikasi bisa membaca pengaturan ibadah
CREATE POLICY "jenis_ibadah_select_all"
ON public.jenis_ibadah FOR SELECT
TO authenticated
USING (true);

-- Hanya pengurus yang bisa update jam mulai/selesai/hari aktif
CREATE POLICY "jenis_ibadah_pengurus_manage"
ON public.jenis_ibadah FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- 3. POLICIES CHECKIN
-- SELECT: Anggota hanya miliknya sendiri; Pengurus & Pembina melihat semua
CREATE POLICY "checkin_select_policy"
ON public.checkin FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR public.get_auth_role() IN ('pengurus', 'pembina')
);

-- INSERT: Anggota hanya bisa check-in miliknya sendiri; Pengurus bisa input atas nama anggota lain
CREATE POLICY "checkin_insert_policy"
ON public.checkin FOR INSERT
TO authenticated
WITH CHECK (
    profile_id = auth.uid()
    OR public.get_auth_role() = 'pengurus'
);

-- UPDATE: HANYA Pengurus (untuk verifikasi status / catatan). Anggota DILARANG update setelah dibuat!
CREATE POLICY "checkin_update_pengurus_only"
ON public.checkin FOR UPDATE
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- DELETE: HANYA Pengurus
CREATE POLICY "checkin_delete_pengurus_only"
ON public.checkin FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'pengurus');

-- 4. POLICIES CEK_ACAK
CREATE POLICY "cek_acak_select_policy"
ON public.cek_acak FOR SELECT
TO authenticated
USING (public.get_auth_role() IN ('pengurus', 'pembina'));

CREATE POLICY "cek_acak_manage_pengurus"
ON public.cek_acak FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- 5. POLICIES PELANGGARAN
CREATE POLICY "pelanggaran_select_policy"
ON public.pelanggaran FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR public.get_auth_role() IN ('pengurus', 'pembina')
);

CREATE POLICY "pelanggaran_manage_pengurus"
ON public.pelanggaran FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- 6. POLICIES IMPORT_BATCH
CREATE POLICY "import_batch_select_policy"
ON public.import_batch FOR SELECT
TO authenticated
USING (public.get_auth_role() IN ('pengurus', 'pembina'));

CREATE POLICY "import_batch_manage_pengurus"
ON public.import_batch FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- 7. POLICIES AUDIT_LOG
-- Pengurus HANYA yang bisa SELECT; Pembina TIDAK memiliki akses audit_log (sesuai spesifikasi)
CREATE POLICY "audit_log_pengurus_select"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.get_auth_role() = 'pengurus');

-- =====================================================================
-- SEED DATA AWAL: JENIS IBADAH
-- =====================================================================
INSERT INTO public.jenis_ibadah (nama, label, agama_wajib, jam_mulai, jam_selesai, hari_aktif)
VALUES
    ('sholat_dzuhur', 'Sholat Dzuhur Berjamaah', ARRAY['islam'], '11:30:00', '14:00:00', '{1,2,3,4,5}'),
    ('pendalaman_iman', 'Pendalaman Iman Kristen/Katolik', ARRAY['kristen', 'katolik'], '11:45:00', '13:45:00', '{1,2,3,4,5}')
ON CONFLICT (nama) DO UPDATE SET
    label = EXCLUDED.label,
    agama_wajib = EXCLUDED.agama_wajib,
    jam_mulai = EXCLUDED.jam_mulai,
    jam_selesai = EXCLUDED.jam_selesai,
    hari_aktif = EXCLUDED.hari_aktif;
