import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { CekAcakGenerateSchema, formatZodError } from '@/lib/validations/api-schemas';
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat melakukan pengecekan acak.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = CekAcakGenerateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { tanggal = getServerDateWIB(), jenis_ibadah_id, jumlah } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      let query = supabase
        .from('checkin')
        .select('*, profile:profiles(*)')
        .eq('tanggal', tanggal)
        .eq('status', 'hadir');

      if (jenis_ibadah_id) {
        query = query.eq('jenis_ibadah_id', jenis_ibadah_id);
      }

      const { data: hadirList, error: fetchErr } = await query;
      if (fetchErr) {
        return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
      }

      if (!hadirList || hadirList.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Belum ada anggota yang check-in "Hadir" pada tanggal ini untuk diacak.',
          },
          { status: 400 }
        );
      }

      const shuffled = [...hadirList].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(jumlah, hadirList.length));

      const recordsToInsert = selected.map((item) => ({
        tanggal,
        checkin_id: item.id,
        dicek_oleh: currentUser.id,
        hasil: 'belum_dicek',
        dibuat_pada: getServerTimestampWIB(),
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('cek_acak')
        .insert(recordsToInsert)
        .select('*, checkin:checkin(*, profile:profiles(*))');

      if (insertErr) {
        return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        data: inserted,
        message: `Berhasil mengacak ${inserted.length} anggota untuk dicek lapangan.`,
      });
    } else {
      const targetIbadah = jenis_ibadah_id?.includes('iman') ? 'pendalaman_iman' : 'sholat_dzuhur';
      const result = dataService.generateRandomCheck(targetIbadah, jumlah);

      return NextResponse.json({
        ok: true,
        data: result,
        message: `Berhasil mengacak ${result.selected_users.length} anggota untuk dicek lapangan.`,
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
