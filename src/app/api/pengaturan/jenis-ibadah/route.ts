import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { JenisIbadahPatchSchema, formatZodError } from '@/lib/validations/api-schemas';
import { dataService } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();
      const { data, error } = await supabase.from('jenis_ibadah').select('*').order('created_at');
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data });
    } else {
      const settings = dataService.getSettings();
      return NextResponse.json({ ok: true, data: settings });
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

export async function PATCH(req: NextRequest) {
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
        { ok: false, error: 'Akses ditolak. Hanya pengurus yang dapat mengubah pengaturan waktu ibadah.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const nama = searchParams.get('nama');

    if (!id && !nama) {
      return NextResponse.json(
        { ok: false, error: 'ID atau nama jenis ibadah wajib dicantumkan dalam query parameter (?id= atau ?nama=).' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parseResult = JenisIbadahPatchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: formatZodError(parseResult.error) }, { status: 400 });
    }
    const { jam_mulai, jam_selesai, hari_aktif } = parseResult.data;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();
      let query = supabase.from('jenis_ibadah').update({
        jam_mulai,
        jam_selesai,
        hari_aktif,
      });

      if (id) {
        query = query.eq('id', id);
      } else if (nama) {
        query = query.eq('nama', nama);
      }

      const { data: updated, error } = await query.select().single();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        data: updated,
        message: 'Pengaturan jendela waktu check-in berhasil diperbarui.',
      });
    } else {
      const targetIbadah = (nama || (id?.includes('iman') ? 'pendalaman_iman' : 'sholat_dzuhur')) as 'sholat_dzuhur' | 'pendalaman_iman';
      dataService.updateSetting(targetIbadah, {
        start_time: jam_mulai,
        end_time: jam_selesai,
        days_active: hari_aktif,
      });

      return NextResponse.json({
        ok: true,
        data: { jam_mulai, jam_selesai, hari_aktif },
        message: 'Pengaturan jendela waktu check-in berhasil diperbarui.',
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
