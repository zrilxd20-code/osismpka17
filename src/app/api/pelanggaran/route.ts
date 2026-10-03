import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { PelanggaranSchema, formatZodError } from '@/lib/validations/api-schemas';
import { getServerDateWIB, getServerTimestampWIB } from '@/lib/server-time';
import { dataService } from '@/lib/data-service';

export async function POST(req: NextRequest) {
  try {
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mencatat pelanggaran.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = PelanggaranSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { profile_id, checkin_id, keterangan, tanggal = getServerDateWIB() } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      const newRecord = {
        profile_id,
        checkin_id: checkin_id || null,
        keterangan,
        dicatat_oleh: currentUser.id,
        tanggal,
        dibuat_pada: getServerTimestampWIB(),
      };

      const { data: inserted, error } = await supabase
        .from('pelanggaran')
        .insert(newRecord)
        .select('*, profile:profiles(*)')
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      if (checkin_id) {
        await supabase
          .from('checkin')
          .update({
            status_verifikasi: 'tidak_valid',
            catatan_verifikasi: `PELANGGARAN: ${keterangan}`,
          })
          .eq('id', checkin_id);
      }

      return NextResponse.json(
        {
          ok: true,
          data: inserted,
          message: 'Catatan pelanggaran berhasil disimpan.',
        },
        { status: 201 }
      );
    } else {
      if (checkin_id) {
        dataService.updateVerifikasi(checkin_id, 'pelanggaran', keterangan);
      }

      return NextResponse.json(
        {
          ok: true,
          data: {
            id: 'pel-' + Date.now(),
            profile_id,
            checkin_id,
            keterangan,
            dicatat_oleh: currentUser.id,
            tanggal,
          },
          message: 'Catatan pelanggaran berhasil disimpan.',
        },
        { status: 201 }
      );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan server: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
