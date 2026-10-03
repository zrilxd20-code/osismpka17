-- =====================================================================
-- SEED DATA: PENCATATAN IBADAH OSIS & MPK
-- =====================================================================

-- 1. SEED PENGATURAN JENDELA WAKTU
INSERT INTO public.settings_time_windows (ibadah, label, start_time, end_time, is_active, days_active, keterangan)
VALUES 
    ('sholat_dzuhur', 'Sholat Dzuhur Berjamaah', '11:30:00', '14:00:00', true, '{1,2,3,4,5}', 'Waktu Dzuhur di Musholla SMA'),
    ('pendalaman_iman', 'Pendalaman Iman Kristen/Katolik', '11:45:00', '13:45:00', true, '{1,2,3,4,5}', 'Ruang Kebaktian / Agama Kristen')
ON CONFLICT (ibadah) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_active = EXCLUDED.is_active;

-- 2. CATATAN CONTOH PENGGUNA (PROFILES)
-- ID berikut mengacu ke UUID contoh (dalam produksi terhubung ke auth.users)
INSERT INTO public.profiles (id, nis, full_name, role, agama, organisasi, jabatan, kelas, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', '2425001', 'Fadhil Pratama', 'pengurus', 'islam', 'OSIS', 'Koordinator Divisi Keagamaan', 'XI IPA 1', true),
    ('22222222-2222-2222-2222-222222222222', '2425002', 'Nadhira Aulia', 'pengurus', 'islam', 'MPK', 'Komisi Kerohanian & Akhlak', 'XI IPS 2', true),
    ('33333333-3333-3333-3333-333333333333', '2425003', 'Ahmad Rizky', 'anggota', 'islam', 'OSIS', 'Anggota Sekbid 1 (Bintal)', 'X-1', true),
    ('44444444-4444-4444-4444-444444444444', '2425004', 'Siti Sarah', 'anggota', 'islam', 'OSIS', 'Anggota Sekbid Humas', 'X-3', true),
    ('55555555-5555-5555-5555-555555555555', '2425005', 'Daniel Christian', 'anggota', 'kristen', 'MPK', 'Anggota Komisi Pengawasan', 'XI IPA 3', true),
    ('66666666-6666-6666-6666-666666666666', '2425006', 'Grace Gabriella', 'anggota', 'kristen', 'OSIS', 'Anggota Sekbid Seni & Budaya', 'X-2', true),
    ('77777777-7777-7777-7777-777777777777', '2425007', 'Muhammad Iqbal', 'anggota', 'islam', 'MPK', 'Anggota Komisi Kebijakan', 'XI IPS 1', true),
    ('88888888-8888-8888-8888-888888888888', '2425008', 'Maria Yosephin', 'anggota', 'katolik', 'OSIS', 'Anggota Sekbid IT', 'X-4', true),
    ('99999999-9999-9999-9999-999999999999', '19850101', 'Drs. H. Mulyadi, M.Pd.', 'pembina', 'islam', 'OSIS', 'Pembina OSIS & Kesiswaan', 'Guru Pembina', true)
ON CONFLICT (nis) DO NOTHING;

-- 3. SEED PRESENSI CONTOH
INSERT INTO public.presensi_ibadah 
    (user_id, tanggal, ibadah, status, keterangan_halangan, saksi, waktu_checkin, input_mode, status_verifikasi, catatan_pengurus)
VALUES
    -- Hari ini
    ('33333333-3333-3333-3333-333333333333', CURRENT_DATE, 'sholat_dzuhur', 'hadir', NULL, 'Fadhil Pratama', (now() - interval '30 minutes'), 'mandiri', 'terverifikasi', 'Tercatat di shaf kedua'),
    ('44444444-4444-4444-4444-444444444444', CURRENT_DATE, 'sholat_dzuhur', 'izin_halangan', 'Halangan syar''i (haid)', NULL, (now() - interval '45 minutes'), 'mandiri', 'terverifikasi', 'Dikonfirmasi'),
    ('55555555-5555-5555-5555-555555555555', CURRENT_DATE, 'pendalaman_iman', 'hadir', NULL, 'Grace Gabriella', (now() - interval '20 minutes'), 'mandiri', 'menunggu', NULL),
    ('77777777-7777-7777-7777-777777777777', CURRENT_DATE, 'sholat_dzuhur', 'hadir', NULL, 'Ahmad Rizky', (now() - interval '10 minutes'), 'mandiri', 'menunggu', NULL),
    
    -- Kemarin
    ('33333333-3333-3333-3333-333333333333', (CURRENT_DATE - 1), 'sholat_dzuhur', 'hadir', NULL, 'Raka', (now() - interval '1 day'), 'mandiri', 'terverifikasi', NULL),
    ('44444444-4444-4444-4444-444444444444', (CURRENT_DATE - 1), 'sholat_dzuhur', 'hadir', NULL, 'Aisyah', (now() - interval '1 day'), 'mandiri', 'terverifikasi', NULL),
    ('55555555-5555-5555-5555-555555555555', (CURRENT_DATE - 1), 'pendalaman_iman', 'hadir', NULL, 'Grace', (now() - interval '1 day'), 'mandiri', 'terverifikasi', NULL),
    ('66666666-6666-6666-6666-666666666666', (CURRENT_DATE - 1), 'pendalaman_iman', 'tidak_hadir', NULL, NULL, (now() - interval '1 day'), 'manual_pengurus', 'terverifikasi', 'Tanpa keterangan'),
    ('77777777-7777-7777-7777-777777777777', (CURRENT_DATE - 1), 'sholat_dzuhur', 'hadir', NULL, 'Fadhil', (now() - interval '1 day'), 'mandiri', 'pelanggaran', 'Terbukti berada di kantin saat jam dzuhur')
ON CONFLICT (user_id, tanggal, ibadah) DO NOTHING;

-- 4. SEED AUDIT LOGS
INSERT INTO public.audit_logs (user_id, actor_name, action, table_name, details)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Fadhil Pratama', 'VERIFIKASI', 'presensi_ibadah', '{"status": "terverifikasi", "target_nis": "2425003"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111', 'Fadhil Pratama', 'FLAG_PELANGGARAN', 'presensi_ibadah', '{"nis": "2425007", "catatan": "Terbukti berada di kantin saat jam dzuhur"}'::jsonb);
