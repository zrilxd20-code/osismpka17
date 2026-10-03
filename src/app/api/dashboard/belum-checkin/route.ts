import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { getServerDateWIB } from '@/lib/server-time';
import { dataService } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  try {
    // 1. Cek Sesi (Pengurus atau Pembina)
    const authResult = await getAuthenticatedUserAndRole(req);
    if (!authResult.user) {
      return NextResponse.json(
        { ok: false, error: authResult.error || 'Autentikasi gagal.' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    if (!['pengurus', 'pembina'].includes(currentUser.role)) {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus dan pembina yang dapat melihat daftar ini.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tanggal = searchParams.get('tanggal') || getServerDateWIB();
    const filterKelas = searchParams.get('kelas');
    const filterJabatan = searchParams.get('jabatan');

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      // Ambil seluruh profil aktif siswa (bukan pembina)
      let profileQuery = supabase
        .from('profiles')
        .select('*')
        .eq('aktif', true)
        .neq('role', 'pembina');

      if (filterKelas && filterKelas !== 'semua') {
        profileQuery = profileQuery.eq('kelas', filterKelas);
      }
      if (filterJabatan && filterJabatan !== 'semua') {
        profileQuery = profileQuery.ilike('jabatan', `%${filterJabatan}%`);
      }

      const { data: allProfiles, error: profileErr } = await profileQuery;
      if (profileErr) {
        return NextResponse.json({ ok: false, error: profileErr.message }, { status: 500 });
      }

      // Ambil seluruh check-in pada tanggal tersebut
      const { data: checkedInList, error: checkinErr } = await supabase
        .from('checkin')
        .select('profile_id, status, status_verifikasi')
        .eq('tanggal', tanggal);

      if (checkinErr) {
        return NextResponse.json({ ok: false, error: checkinErr.message }, { status: 500 });
      }

      const checkedInProfileIds = new Set((checkedInList || []).map((c) => c.profile_id));

      // Filter yang belum checkin
      const belumCheckin = (allProfiles || []).filter((p) => !checkedInProfileIds.has(p.id));

      return NextResponse.json({
        ok: true,
        data: {
          tanggal,
          total_belum_checkin: belumCheckin.length,
          total_aktif: (allProfiles || []).length,
          anggota: belumCheckin,
        },
      });
    } else {
      // Mock fallback
      const profiles = dataService.getProfiles().filter((p) => p.is_active && p.role !== 'pembina');
      const presensi = dataService.getPresensiList(tanggal);
      const checkedUserIds = new Set(presensi.map((p) => p.user_id));

      let belum = profiles.filter((p) => !checkedUserIds.has(p.id));

      if (filterKelas && filterKelas !== 'semua') {
        belum = belum.filter((p) => p.kelas === filterKelas);
      }
      if (filterJabatan && filterJabatan !== 'semua') {
        belum = belum.filter(
          (p) =>
            p.jabatan.toLowerCase().includes(filterJabatan.toLowerCase()) ||
            p.organisasi.toLowerCase().includes(filterJabatan.toLowerCase())
        );
      }

      return NextResponse.json({
        ok: true,
        data: {
          tanggal,
          total_belum_checkin: belum.length,
          total_aktif: profiles.length,
          anggota: belum,
        },
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
