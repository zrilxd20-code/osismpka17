import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }

    if (!['pengurus', 'pembina'].includes(authResult.user.role)) {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak.' },
        { status: 403 }
      );
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    let errorReports: Array<{
      rowNumber?: number;
      baris?: number;
      nis?: string;
      nama?: string;
      alasan: string;
    }> = [];

    if (!isDemo) {
      const supabase = await createClient();
      const { data: batch, error } = await supabase
        .from('import_batch')
        .select('laporan_error, nama_file')
        .eq('id', id)
        .single();

      if (error || !batch) {
        return NextResponse.json({ ok: false, error: 'Batch impor tidak ditemukan.' }, { status: 404 });
      }
      errorReports = batch.laporan_error || [];
    } else {
      // Mock dummy error row
      errorReports = [
        {
          baris: 5,
          nis: 'ABC123',
          nama: 'Siswa Contoh Salah',
          alasan: 'NIS harus berupa deret angka numerik',
        },
      ];
    }

    // Format ke CSV
    const csvRows = errorReports.map((r, idx) => ({
      'No Baris': r.rowNumber || r.baris || idx + 1,
      NIS: r.nis || '-',
      Nama: r.nama || '-',
      'Alasan Kegagalan': r.alasan || '-',
    }));

    const csvString = Papa.unparse(csvRows);

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Laporan_Gagal_Impor_${id.slice(0, 8)}.csv"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Gagal mengunduh laporan error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
