import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const url = 'https://walilvzlcomrhbeyfbfy.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbGlsdnpsY29tcmhiZXlmYmZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTMzMDkwNiwiZXhwIjoyMTA2OTA2OTA2fQ.WkbMnyG1Bu_4nZeh3xHCaoQBBguBLtXY5JmWOVfvnvY';

async function seed() {
  const supabase = createClient(url, serviceRoleKey);
  const csvPath = path.resolve('data_39_anggota_osis_mpk.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });
  const records = parsed.data;

  console.log(`Menemukan ${records.length} baris di CSV.`);

  const profilesToInsert = records.map((r, idx) => {
    const nis = r.NIS;
    const nama = r.Nama;
    const kelas = r.Kelas;
    const jabatan = r['Jabatan (OSIS/MPK)'];
    const agama = (r.Agama || 'Islam').toLowerCase();

    // Tentukan role
    let role = 'anggota';
    if (jabatan.toLowerCase().includes('divisi keagamaan')) {
      role = 'pengurus';
    }

    return {
      nis,
      nama,
      kelas,
      jabatan,
      agama,
      role,
      aktif: true,
      must_change_password: true,
    };
  });

  // Tambah 2 pembina
  profilesToInsert.push({
    nis: '19800101',
    nama: 'Nurkholis Aiman',
    kelas: 'Guru Pembina',
    jabatan: 'Pembina OSIS',
    agama: 'islam',
    role: 'pembina',
    aktif: true,
    must_change_password: false,
  });

  profilesToInsert.push({
    nis: '19850202',
    nama: 'Maria Ulfa',
    kelas: 'Guru Pembina',
    jabatan: 'Pembina MPK',
    agama: 'islam',
    role: 'pembina',
    aktif: true,
    must_change_password: false,
  });

  console.log(`Mengunggah total ${profilesToInsert.length} data profil ke Supabase...`);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profilesToInsert, { onConflict: 'nis' })
    .select();

  if (error) {
    console.error('Gagal memasukkan profil:', error);
  } else {
    console.log(`Berhasil mengunggah ${data.length} profil ke Supabase!`);
  }
}

seed();
