import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { AnggotaUpdateSchema, formatZodError } from '@/lib/validations/api-schemas';
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mengubah data anggota.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = AnggotaUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();
      const updates = {
        ...parseResult.data,
        updated_at: getServerTimestampWIB(),
      };

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        data: updated,
        message: 'Data anggota berhasil diperbarui.',
      });
    } else {
      return NextResponse.json({
        ok: true,
        data: { id, ...parseResult.data },
        message: 'Data anggota berhasil diperbarui.',
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
