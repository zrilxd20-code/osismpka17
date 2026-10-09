import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { CekAcakUpdateSchema, formatZodError } from '@/lib/validations/api-schemas';
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mencatat hasil cek acak.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = CekAcakUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { hasil, catatan } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      const { data: updated, error } = await supabase
        .from('cek_acak')
        .update({
          hasil,
          catatan: catatan || null,
        })
        .eq('id', id)
        .select('*, checkin:checkin(*, profile:profiles!checkin_profile_id_fkey(*))')
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      if (hasil === 'tidak_sesuai' && updated.checkin_id) {
        await supabase
          .from('checkin')
          .update({
            status_verifikasi: 'tidak_valid',
            catatan_verifikasi: `Sidak lapangan: Tidak ditemukan di tempat ibadah. ${catatan || ''}`,
          })
          .eq('id', updated.checkin_id);
      }

      return NextResponse.json({
        ok: true,
        data: updated,
        message: 'Hasil pengecekan acak berhasil disimpan.',
      });
    } else {
      const checks = dataService.getRandomChecks();
      for (const check of checks) {
        const item = check.selected_users.find((u) => u.user_id === id);
        if (item) {
          item.status_cek = hasil === 'sesuai' ? 'sesuai' : 'tidak_ada';
          if (catatan) item.catatan = catatan;
          break;
        }
      }

      return NextResponse.json({
        ok: true,
        data: { id, hasil, catatan },
        message: 'Hasil pengecekan acak berhasil diperbarui.',
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
