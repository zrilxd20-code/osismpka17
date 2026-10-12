-- =====================================================================
-- KUNCI KEAMANAN DATABASE DARURAT (ANTI-BOCOR & ANTI-SCRAPING)
-- Jalankan skrip ini langsung di Supabase SQL Editor untuk mengunci
-- semua tabel agar TIDAK BISA di-curl atau di-scrape oleh anon/publik!
-- =====================================================================

-- 1. AKTIFKAN ROW LEVEL SECURITY (RLS) DI SEMUA TABEL
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checkin ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jenis_ibadah ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cek_acak ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.import_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- 2. CABUT SEMUA HAK AKSES DARI PERAN ANON & PUBLIC (KUNCI TOTAL DARI LUAR)
REVOKE ALL ON public.profiles FROM anon, public;
REVOKE ALL ON public.checkin FROM anon, public;
REVOKE ALL ON public.cek_acak FROM anon, public;
REVOKE ALL ON public.pelanggaran FROM anon, public;
REVOKE ALL ON public.import_batch FROM anon, public;
REVOKE ALL ON public.audit_log FROM anon, public;

-- HANYA BERIKAN AKSES BACA DAFTAR JENIS IBADAH KE ANON (UNTUK JADWAL)
GRANT SELECT ON public.jenis_ibadah TO anon;

-- BERIKAN AKSES TABEL HANYA UNTUK USER YANG SUDAH LOGIN (AUTHENTICATED) DAN SERVICE_ROLE (SERVER)
GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT ALL ON public.checkin TO authenticated, service_role;
GRANT ALL ON public.jenis_ibadah TO authenticated, service_role;
GRANT ALL ON public.cek_acak TO authenticated, service_role;
GRANT ALL ON public.pelanggaran TO authenticated, service_role;
GRANT ALL ON public.import_batch TO authenticated, service_role;
GRANT ALL ON public.audit_log TO authenticated, service_role;

-- 3. BERSIHKAN SEMUA KEBIJAKAN (POLICIES) LAMA YANG MUNGKIN BOCOR ATAU PERMISIF
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 4. BUAT HELPER FUNGSI CEK ROLE (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. TERAPKAN KEBIJAKAN RLS KETAT (ZERO TRUST)

-- TABEL: PROFILES
-- User hanya bisa melihat profilnya sendiri; Pengurus & Pembina bisa melihat semua
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.get_auth_role() IN ('pengurus', 'pembina')
);

-- Hanya pengurus yang bisa memodifikasi profil anggota
CREATE POLICY "profiles_manage_pengurus"
ON public.profiles FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- TABEL: CHECKIN
-- Siswa hanya bisa melihat presensi miliknya sendiri; Pengurus & Pembina bisa melihat semua
CREATE POLICY "checkin_select_authenticated"
ON public.checkin FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    OR public.get_auth_role() IN ('pengurus', 'pembina')
);

-- Siswa hanya bisa mengirim presensi atas namanya sendiri
CREATE POLICY "checkin_insert_authenticated"
ON public.checkin FOR INSERT
TO authenticated
WITH CHECK (
    profile_id = auth.uid()
    OR public.get_auth_role() = 'pengurus'
);

-- Hanya pengurus yang boleh memperbarui status verifikasi checkin
CREATE POLICY "checkin_update_pengurus"
ON public.checkin FOR UPDATE
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- Hanya pengurus yang boleh menghapus data presensi
CREATE POLICY "checkin_delete_pengurus"
ON public.checkin FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'pengurus');

-- TABEL: JENIS_IBADAH
-- Semua user terautentikasi dan anon boleh membaca jam ibadah
CREATE POLICY "jenis_ibadah_read_all"
ON public.jenis_ibadah FOR SELECT
TO public
USING (true);

-- Hanya pengurus yang boleh mengubah jam/pengaturan ibadah
CREATE POLICY "jenis_ibadah_manage_pengurus"
ON public.jenis_ibadah FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- TABEL: CEK_ACAK
CREATE POLICY "cek_acak_select_pengurus_pembina"
ON public.cek_acak FOR SELECT
TO authenticated
USING (public.get_auth_role() IN ('pengurus', 'pembina'));

CREATE POLICY "cek_acak_manage_pengurus"
ON public.cek_acak FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- TABEL: PELANGGARAN
CREATE POLICY "pelanggaran_select_authenticated"
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

-- TABEL: IMPORT_BATCH
CREATE POLICY "import_batch_select_pengurus_pembina"
ON public.import_batch FOR SELECT
TO authenticated
USING (public.get_auth_role() IN ('pengurus', 'pembina'));

CREATE POLICY "import_batch_manage_pengurus"
ON public.import_batch FOR ALL
TO authenticated
USING (public.get_auth_role() = 'pengurus')
WITH CHECK (public.get_auth_role() = 'pengurus');

-- TABEL: AUDIT_LOG
CREATE POLICY "audit_log_pengurus_only"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.get_auth_role() = 'pengurus');
