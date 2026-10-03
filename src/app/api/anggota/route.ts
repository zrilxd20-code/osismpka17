import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createAdminClient, createClient } from '@/lib/supabase/server';
import { AnggotaCreateSchema, formatZodError } from '@/lib/validations/api-schemas';
import { getServerTimestampWIB } from '@/lib/server-time';
import { dataService } from '@/lib/data-service';
import crypto from 'crypto';

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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mendaftarkan anggota.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = AnggotaCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { nis, nama, kelas, jabatan, agama, role, email } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    const userEmail = email || `${nis}@sekolah.local`;
    const tempPassword = `Siswa#${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    if (!isDemo) {
      const adminClient = createAdminClient();
      const supabase = await createClient();

      const { data: existingNis } = await supabase
        .from('profiles')
        .select('id')
        .eq('nis', nis)
        .maybeSingle();

      if (existingNis) {
        return NextResponse.json(
          { ok: false, error: `Siswa dengan NIS '${nis}' sudah terdaftar.` },
          { status: 409 }
        );
      }

      const { data: authCreated, error: authErr } = await adminClient.auth.admin.createUser({
        email: userEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nis, nama },
      });

      if (authErr) {
        return NextResponse.json(
          { ok: false, error: `Gagal membuat akun login: ${authErr.message}` },
          { status: 500 }
        );
      }

      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: authCreated.user.id,
          nis,
          nama,
          kelas,
          jabatan,
          agama,
          role,
          aktif: true,
          must_change_password: true,
          created_at: getServerTimestampWIB(),
          updated_at: getServerTimestampWIB(),
        })
        .select()
        .single();

      if (profileErr) {
        return NextResponse.json(
          { ok: false, error: `Gagal membuat profil siswa: ${profileErr.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: {
            profile: newProfile,
            kredensial: {
              email: userEmail,
              password_sementara: tempPassword,
            },
          },
          message: `Anggota ${nama} berhasil didaftarkan.`,
        },
        { status: 201 }
      );
    } else {
      const created = dataService.addProfile({
        nis,
        full_name: nama,
        kelas,
        jabatan,
        agama,
        organisasi: jabatan.toUpperCase().includes('MPK') ? 'MPK' : 'OSIS',
        role,
        is_active: true,
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            profile: created,
            kredensial: {
              email: userEmail,
              password_sementara: tempPassword,
            },
          },
          message: `Anggota ${nama} berhasil didaftarkan secara lokal.`,
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
