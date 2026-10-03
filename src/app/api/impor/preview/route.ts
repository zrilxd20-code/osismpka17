import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { parseUploadedFileBuffer, validateImportRows } from '@/lib/impor-parser';
import { dataService } from '@/lib/data-service';

export async function POST(req: NextRequest) {
  try {
    // 1. Cek Role Pengurus
    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    if (currentUser.role !== 'pengurus') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mengimpor data siswa.' },
        { status: 403 }
      );
    }

    // 2. Baca FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Tidak ada file yang diunggah. Pilih file .xlsx, .xls, atau .csv.' },
        { status: 400 }
      );
    }

    // 3. Batasi Ukuran File (Maksimal 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'Ukuran file melebihi batas maksimal 5 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Parsing File (Jika PDF/Word, tolak dengan pesan khusus)
    const parsed = parseUploadedFileBuffer(buffer, file.name, file.type);
    if (parsed.error) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'File tidak memuat baris data yang dapat diproses.' },
        { status: 400 }
      );
    }

    // 5. Ambil Daftar NIS yang Sudah Ada di Database
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    const existingNisSet = new Set<string>();

    if (!isDemo) {
      const supabase = await createClient();
      const { data: existingProfiles } = await supabase.from('profiles').select('nis');
      (existingProfiles || []).forEach((p) => {
        if (p.nis) existingNisSet.add(p.nis.trim());
      });
    } else {
      const profiles = dataService.getProfiles();
      profiles.forEach((p) => existingNisSet.add(p.nis.trim()));
    }

    // 6. Validasi Tiap Baris
    const previewResult = validateImportRows(parsed.rows, existingNisSet);

    return NextResponse.json({
      ok: true,
      data: {
        nama_file: file.name,
        total_baris: previewResult.totalBaris,
        jumlah_valid: previewResult.barisValid.length,
        jumlah_error: previewResult.barisError.length,
        jumlah_akun_baru: previewResult.jumlahAkunBaru,
        jumlah_akun_diperbarui: previewResult.jumlahAkunDiperbarui,
        baris_valid: previewResult.barisValid,
        baris_error: previewResult.barisError,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan saat memproses pratinjau impor: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
