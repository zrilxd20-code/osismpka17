import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { InputManualSchema, formatZodError } from '@/lib/validations/api-schemas';
import { getServerTimestampWIB } from '@/lib/server-time';
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat melakukan input manual.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = InputManualSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { profile_id, jenis_ibadah_id, tanggal, status, keterangan, saksi, catatan_verifikasi } =
      parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      const record = {
        profile_id,
        jenis_ibadah_id,
        tanggal,
        status,
        keterangan: status === 'izin' ? keterangan : null,
        saksi: saksi?.trim() || null,
        diverifikasi_oleh: currentUser.id,
        status_verifikasi: 'valid',
        catatan_verifikasi: catatan_verifikasi || 'Diinput manual oleh pengurus keagamaan',
        dibuat_pada: getServerTimestampWIB(),
      };

      const { data: saved, error } = await supabase
        .from('checkin')
        .upsert(record, { onConflict: 'profile_id,jenis_ibadah_id,tanggal' })
        .select('*, profile:profiles!checkin_profile_id_fkey(*)')
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, error: `Gagal menyimpan input manual: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: saved,
          message: 'Presensi manual berhasil disimpan dan diverifikasi.',
        },
        { status: 201 }
      );
    } else {
      const targetUser = dataService.getProfileById(profile_id);
      const targetIbadah = targetUser?.agama === 'islam' ? 'sholat_dzuhur' : 'pendalaman_iman';

      const res = dataService.inputManualPengurus({
        targetUserId: profile_id,
        tanggal,
        ibadah: targetIbadah,
        status: status as 'hadir' | 'tidak_hadir' | 'izin_halangan',
        keteranganHalangan: keterangan || undefined,
        catatanPengurus: catatan_verifikasi || 'Diinput manual oleh pengurus keagamaan',
      });

      return NextResponse.json(
        {
          ok: true,
          data: res.data,
          message: res.message,
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
