// =====================================================================
// AUTOMATED BACKEND TEST SUITE: PENCATATAN IBADAH OSIS & MPK
// =====================================================================

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const PENGURUS_ID = '11111111-1111-1111-1111-111111111111';
const ANGGOTA_ISLAM_ID = '33333333-3333-3333-3333-333333333333';
const ANGGOTA_KRISTEN_ID = '55555555-5555-5555-5555-555555555555';

async function runTests() {
  console.log('🚀 Memulai Uji Coba Backend Endpoint...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. GET /api/impor/template
  try {
    console.log('1. Menguji GET /api/impor/template');
    const res = await fetch(`${BASE_URL}/api/impor/template`);
    assert(res.status === 200, 'Status HTTP 200');
    const cType = res.headers.get('content-type') || '';
    assert(cType.includes('spreadsheetml'), 'Content-Type Excel (.xlsx)');
  } catch (e) {
    assert(false, `Error GET template: ${e.message}`);
  }

  // 2. POST /api/impor/preview (File CSV Valid)
  let previewData = null;
  try {
    console.log('\n2. Menguji POST /api/impor/preview (contoh_impor_siswa.csv)');
    const csvContent = fs.readFileSync('contoh_impor_siswa.csv');
    const form = new FormData();
    form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'contoh_impor_siswa.csv');

    const res = await fetch(`${BASE_URL}/api/impor/preview`, {
      method: 'POST',
      headers: { 'x-user-id': PENGURUS_ID },
      body: form,
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Status HTTP 200 dan ok: true');
    assert(json.data.total_baris === 10, 'Total baris terbaca: 10');
    assert(json.data.jumlah_valid === 10, 'Jumlah valid: 10');
    previewData = json.data;
  } catch (e) {
    assert(false, `Error POST preview: ${e.message}`);
  }

  // 3. POST /api/impor/preview (Penolakan File PDF/Word)
  try {
    console.log('\n3. Menguji Penolakan File PDF/Word pada POST /api/impor/preview');
    const dummyPdf = Buffer.from('%PDF-1.4 dummy content');
    const form = new FormData();
    form.append('file', new Blob([dummyPdf], { type: 'application/pdf' }), 'laporan.pdf');

    const res = await fetch(`${BASE_URL}/api/impor/preview`, {
      method: 'POST',
      headers: { 'x-user-id': PENGURUS_ID },
      body: form,
    });
    const json = await res.json();
    assert(res.status === 400 && !json.ok, 'Status HTTP 400 ditolak');
    assert(json.error === 'Ubah dulu ke Excel/CSV memakai template.', `Pesan error sesuai: "${json.error}"`);
  } catch (e) {
    assert(false, `Error penolakan PDF: ${e.message}`);
  }

  // 4. POST /api/impor/konfirmasi
  try {
    console.log('\n4. Menguji POST /api/impor/konfirmasi');
    if (previewData && previewData.baris_valid) {
      const res = await fetch(`${BASE_URL}/api/impor/konfirmasi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': PENGURUS_ID,
        },
        body: JSON.stringify({
          nama_file: 'contoh_impor_siswa.csv',
          baris_valid: previewData.baris_valid.slice(0, 3), // Simpan 3 baris uji coba
          nonaktifkan_anggota_lain: false,
        }),
      });
      const json = await res.json();
      assert(res.status === 200 && json.ok, 'Status HTTP 200 dan ok: true');
      assert(json.data.berhasil > 0, `Berhasil menyimpan ${json.data.berhasil} siswa`);
    }
  } catch (e) {
    assert(false, `Error POST konfirmasi impor: ${e.message}`);
  }

  // 5. POST /api/checkin (Validasi Agama & Bypass Time)
  let checkinId = null;
  try {
    console.log('\n5. Menguji POST /api/checkin');
    // Uji kecocokan agama: Anggota Islam check-in dzuhur
    const res = await fetch(`${BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ANGGOTA_ISLAM_ID,
        'x-bypass-time-window': 'true',
      },
      body: JSON.stringify({
        jenis_ibadah_id: '11111111-1111-1111-1111-111111111111', // will fallback to dzuhur
        status: 'hadir',
        saksi: 'Fadhil Pratama',
      }),
    });
    const json = await res.json();
    assert(res.status === 201 || res.status === 409 || json.ok, 'Respons checkin diterima');
    if (json.data && json.data.id) {
      checkinId = json.data.id;
    }
  } catch (e) {
    assert(false, `Error POST checkin: ${e.message}`);
  }

  // 6. PATCH /api/checkin/[id]/verifikasi
  try {
    console.log('\n6. Menguji PATCH /api/checkin/[id]/verifikasi');
    const targetId = checkinId || 'pre-3';
    const res = await fetch(`${BASE_URL}/api/checkin/${targetId}/verifikasi`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': PENGURUS_ID,
      },
      body: JSON.stringify({
        status_verifikasi: 'valid',
        catatan_verifikasi: 'Terlihat rapi sholat di musholla',
      }),
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Status HTTP 200 dan verifikasi tersimpan');
  } catch (e) {
    assert(false, `Error PATCH verifikasi: ${e.message}`);
  }

  // 7. POST /api/pengurus/input-manual
  try {
    console.log('\n7. Menguji POST /api/pengurus/input-manual');
    const res = await fetch(`${BASE_URL}/api/pengurus/input-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': PENGURUS_ID,
      },
      body: JSON.stringify({
        profile_id: ANGGOTA_KRISTEN_ID,
        jenis_ibadah_id: '55555555-5555-5555-5555-555555555555',
        tanggal: new Date().toISOString().slice(0, 10),
        status: 'hadir',
        catatan_verifikasi: 'Dikonfirmasi langsung oleh pengurus kerohanian',
      }),
    });
    const json = await res.json();
    assert(res.status === 201 && json.ok, 'Status HTTP 201 input manual berhasil');
  } catch (e) {
    assert(false, `Error input-manual: ${e.message}`);
  }

  // 8. GET /api/dashboard/belum-checkin
  try {
    console.log('\n8. Menguji GET /api/dashboard/belum-checkin');
    const res = await fetch(`${BASE_URL}/api/dashboard/belum-checkin`, {
      headers: { 'x-user-id': PENGURUS_ID },
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Status HTTP 200');
    assert(Array.isArray(json.data.anggota), 'Data anggota berupa array');
  } catch (e) {
    assert(false, `Error belum-checkin: ${e.message}`);
  }

  // 9. POST /api/cek-acak
  try {
    console.log('\n9. Menguji POST /api/cek-acak');
    const res = await fetch(`${BASE_URL}/api/cek-acak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': PENGURUS_ID,
      },
      body: JSON.stringify({
        jumlah: 2,
      }),
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Status HTTP 200 acak anggota berhasil');
  } catch (e) {
    assert(false, `Error cek-acak: ${e.message}`);
  }

  // 10. POST /api/pelanggaran
  try {
    console.log('\n10. Menguji POST /api/pelanggaran');
    const res = await fetch(`${BASE_URL}/api/pelanggaran`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': PENGURUS_ID,
      },
      body: JSON.stringify({
        profile_id: '77777777-7777-7777-7777-777777777777',
        keterangan: 'Terbukti berada di area kantin saat jam sholat dzuhur',
      }),
    });
    const json = await res.json();
    assert(res.status === 201 && json.ok, 'Status HTTP 201 catatan pelanggaran tersimpan');
  } catch (e) {
    assert(false, `Error pelanggaran: ${e.message}`);
  }

  // 11. GET /api/rekap
  try {
    console.log('\n11. Menguji GET /api/rekap?periode=bulanan');
    const res = await fetch(`${BASE_URL}/api/rekap?periode=bulanan`, {
      headers: { 'x-user-id': PENGURUS_ID },
    });
    const json = await res.json();
    assert(res.status === 200 && json.ok, 'Status HTTP 200 rekapitulasi sukses');
    assert(Array.isArray(json.data.rekap), 'Daftar rekap anggota valid');
  } catch (e) {
    assert(false, `Error rekap: ${e.message}`);
  }

  // 12. GET /api/export (XLSX dan PDF)
  try {
    console.log('\n12. Menguji GET /api/export (format=xlsx & format=pdf)');
    const resXlsx = await fetch(`${BASE_URL}/api/export?format=xlsx`, {
      headers: { 'x-user-id': PENGURUS_ID },
    });
    assert(resXlsx.status === 200, 'Status HTTP 200 Ekspor Excel');
    assert(resXlsx.headers.get('content-type')?.includes('spreadsheetml'), 'Content-Type Excel valid');

    const resPdf = await fetch(`${BASE_URL}/api/export?format=pdf`, {
      headers: { 'x-user-id': PENGURUS_ID },
    });
    assert(resPdf.status === 200, 'Status HTTP 200 Ekspor PDF');
    assert(resPdf.headers.get('content-type')?.includes('pdf'), 'Content-Type PDF valid');
  } catch (e) {
    assert(false, `Error export: ${e.message}`);
  }

  // 13. GET /api/pengaturan/jenis-ibadah & PATCH
  try {
    console.log('\n13. Menguji Pengaturan Jendela Waktu Check-In');
    const getRes = await fetch(`${BASE_URL}/api/pengaturan/jenis-ibadah`, {
      headers: { 'x-user-id': PENGURUS_ID },
    });
    assert(getRes.status === 200, 'GET pengaturan berhasil');

    const patchRes = await fetch(`${BASE_URL}/api/pengaturan/jenis-ibadah?nama=sholat_dzuhur`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': PENGURUS_ID,
      },
      body: JSON.stringify({
        jam_mulai: '11:30:00',
        jam_selesai: '18:00:00',
        jam_maksimal: '21:00:00',
        hari_aktif: [1, 2, 3, 4, 5],
      }),
    });
    const patchJson = await patchRes.json();
    assert(patchRes.status === 200 && patchJson.ok, 'PATCH pengaturan jendela waktu berhasil');
  } catch (e) {
    assert(false, `Error pengaturan waktu: ${e.message}`);
  }

  console.log(`\n========================================`);
  console.log(`HASIL AKHIR PENGUJIAN: ${passed} LULUS, ${failed} GAGAL`);
  console.log(`========================================\n`);
}

runTests();
