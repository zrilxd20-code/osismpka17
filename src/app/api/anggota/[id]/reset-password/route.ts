import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createAdminClient, createClient } from '@/lib/supabase/server';
import { getServerTimestampWIB } from '@/lib/server-time';
import crypto from 'crypto';

export async function POST(
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mereset password anggota.' },
        { status: 403 }
      );
    }

    const tempPassword = `Reset#${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const adminClient = createAdminClient();
      const supabase = await createClient();

      // Reset password via Supabase Auth Admin Service Role
      const { error: authErr } = await adminClient.auth.admin.updateUserById(id, {
        password: tempPassword,
      });

      if (authErr) {
        return NextResponse.json(
          { ok: false, error: `Gagal mereset password: ${authErr.message}` },
          { status: 500 }
        );
      }

      // Tandai must_change_password = true di tabel profiles
      await supabase
        .from('profiles')
        .update({
          must_change_password: true,
          updated_at: getServerTimestampWIB(),
        })
        .eq('id', id);

      // Audit log
      await supabase.from('audit_log').insert({
        aktor_id: authResult.user.id,
        aksi: 'RESET_PASSWORD',
        tabel: 'profiles',
        record_id: id,
        waktu: getServerTimestampWIB(),
      });

      return NextResponse.json({
        ok: true,
        data: {
          profile_id: id,
          password_baru_sementara: tempPassword,
        },
        message: 'Password berhasil direset. Berikan password sementara kepada siswa.',
      });
    } else {
      return NextResponse.json({
        ok: true,
        data: {
          profile_id: id,
          password_baru_sementara: tempPassword,
        },
        message: 'Password berhasil direset (mode demo).',
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
