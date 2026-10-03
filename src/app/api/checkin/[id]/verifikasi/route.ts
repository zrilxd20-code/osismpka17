import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { VerifikasiSchema, formatZodError } from '@/lib/validations/api-schemas';
import { dataService } from '@/lib/data-service';

export async function PATCH(
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
    const currentUser = authResult.user;

    if (currentUser.role !== 'pengurus') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus divisi keagamaan yang dapat memverifikasi presensi.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = VerifikasiSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { status_verifikasi, catatan_verifikasi } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      const { data: updated, error } = await supabase
        .from('checkin')
        .update({
          status_verifikasi,
          catatan_verifikasi: catatan_verifikasi || null,
          diverifikasi_oleh: currentUser.id,
        })
        .eq('id', id)
        .select('*, profile:profiles(*)')
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, error: `Gagal memperbarui verifikasi: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        data: updated,
        message: `Presensi berhasil ditandai sebagai ${status_verifikasi}.`,
      });
    } else {
      const mappedStatus = status_verifikasi === 'valid' ? 'terverifikasi' : 'ditolak';
      const res = dataService.updateVerifikasi(id, mappedStatus, catatan_verifikasi || undefined);
      if (!res.success) {
        return NextResponse.json({ ok: false, error: res.message }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        data: { id, status_verifikasi, catatan_verifikasi, diverifikasi_oleh: currentUser.id },
        message: res.message,
      });
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
