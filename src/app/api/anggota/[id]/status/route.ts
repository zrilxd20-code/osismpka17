import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { getServerTimestampWIB } from '@/lib/server-time';

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

    if (authResult.user.role !== 'pengurus') {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mengubah status aktif anggota.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { aktif } = body;

    if (typeof aktif !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'Parameter "aktif" (boolean: true/false) wajib dicantumkan.' },
        { status: 400 }
      );
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          aktif,
          updated_at: getServerTimestampWIB(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        data: updated,
        message: `Status anggota berhasil diubah menjadi ${aktif ? 'Aktif' : 'Non-Aktif'}.`,
      });
    } else {
      return NextResponse.json({
        ok: true,
        data: { id, aktif },
        message: `Status anggota berhasil diubah menjadi ${aktif ? 'Aktif' : 'Non-Aktif'}.`,
      });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
