-- =====================================================================
-- SEED DATA RESMI: 39 ANGGOTA OSIS & MPK + PEMBINA
-- =====================================================================

-- 1. SEED PENGATURAN JENIS IBADAH
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

-- 2. SEED PROFILES (39 ANGGOTA OSIS & MPK + 1 PEMBINA)
INSERT INTO public.profiles (id, nis, nama, kelas, jabatan, agama, role, aktif, must_change_password)
VALUES
    ('00000000-0000-0000-0000-000000000001', '2425001', 'Adelia Nur Zahra', 'XI MP', 'Anggota MPK', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000002', '2425002', 'A Isy Mifta Nazhilfa', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000003', '2425003', 'Al Qoirul Lathif Nazzril Putra', 'X RPL', 'Divisi Keagamaan OSIS', 'islam', 'pengurus', true, true),
    ('00000000-0000-0000-0000-000000000004', '2425004', 'Amelia Putri', 'XI AK 1', 'Anggota MPK', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000005', '2425005', 'Amyra Nur Azalia', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000006', '2425006', 'Annisa Maulida Putri Hardiansyah', 'XI AK 2', 'Anggota MPK', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000007', '2425007', 'Aulia Fitri', 'X BR 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000008', '2425008', 'Bintang Very Purwanto', 'X RPL', 'Anggota OSIS', 'kristen', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000009', '2425009', 'Dimas Putra Satria', 'XI AK 2', 'Anggota MPK', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000010', '2425010', 'Fadhyl Alhafizd', 'X RPL', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000011', '2425011', 'Hanivia Putria Idris', 'X BR 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000012', '2425012', 'Isya Al Faqih Hasan', 'X BR 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000013', '2425013', 'Jihada Amalia', 'XI AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000014', '2425014', 'Jordhan Khadhil Setiawan', 'XI RPL 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000015', '2425015', 'Kartika Luna Amallya', 'XI RPL 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000016', '2425016', 'Keyla Ayu Fitriandini', 'X MP', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000017', '2425017', 'Keysha Aurelia', 'X AK 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000018', '2425018', 'Maria Jame', 'XI RPL 1', 'Divisi Keagamaan OSIS (Kristen)', 'kristen', 'pengurus', true, true),
    ('00000000-0000-0000-0000-000000000019', '2425019', 'Muhamad Faiq Adnan', 'XI RPL 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000020', '2425020', 'Muhamad Zidan Pirgyawan', 'XI RPL', 'Anggota MPK', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000021', '2425021', 'Muhammad Dafa', 'XI BR', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000022', '2425022', 'Muhammad Faris', 'XI BR', 'Divisi Keagamaan OSIS', 'islam', 'pengurus', true, true),
    ('00000000-0000-0000-0000-000000000023', '2425023', 'Muhammad Hafid Addison', 'X AK 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000024', '2425024', 'Muhammad Irvan Hakim', 'XI RPL 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000025', '2425025', 'Nabila Firanisa Ramadhani', 'XI RPL 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000026', '2425026', 'Nisfa Alvia Rahmadany', 'X BR 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000027', '2425027', 'Novita Gendhis Pramesththi', 'X MP', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000028', '2425028', 'Nur Efendy', 'X BR 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000029', '2425029', 'Oneal Pratama', 'XI AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000030', '2425030', 'Polbe Seriota Sihite', 'XI AK 1', 'Anggota OSIS', 'kristen', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000031', '2425031', 'Rafifah Salsabila Zahra', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000032', '2425032', 'Rifky Aditya Hadi', 'XI AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000033', '2425033', 'Sahal Kholidil Azam', 'XI RPL 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000034', '2425034', 'Selli Edelweiss Salsabila', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000035', '2425035', 'Shania Aurelia Syarief', 'X AK 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000036', '2425036', 'Sisca Aulia Rahmadani', 'X BR 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000037', '2425037', 'Syafira Aulia', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000038', '2425038', 'Zakiya Innayati', 'X BR 2', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('00000000-0000-0000-0000-000000000039', '2425039', 'Zhiva Iqnantia Nandini', 'X AK 1', 'Anggota OSIS', 'islam', 'anggota', true, true),
    ('99999999-9999-9999-9999-999999999998', '19800101', 'Nurkholis Aiman', 'Guru Pembina', 'Pembina OSIS', 'islam', 'pembina', true, false),
    ('99999999-9999-9999-9999-999999999999', '19850202', 'Maria Ulfa', 'Guru Pembina', 'Pembina MPK', 'islam', 'pembina', true, false)
ON CONFLICT (nis) DO UPDATE SET
    nama = EXCLUDED.nama,
    kelas = EXCLUDED.kelas,
    jabatan = EXCLUDED.jabatan,
    agama = EXCLUDED.agama,
    role = EXCLUDED.role;
