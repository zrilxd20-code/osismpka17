import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { getServerDateWIB } from '@/lib/server-time';
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
    const currentUser = authResult.user;

    if (!['pengurus', 'pembina'].includes(currentUser.role)) {
      return NextResponse.json(
        { ok: false, error: 'Akses ditolak. Hanya pengurus dan pembina yang dapat mengakses rekapitulasi.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periode = searchParams.get('periode') || 'bulanan';
    const filterKelas = searchParams.get('kelas');
    const today = getServerDateWIB();

    let dari = searchParams.get('dari');
    let sampai = searchParams.get('sampai') || today;

    if (!dari) {
      if (periode === 'harian') {
        dari = today;
      } else if (periode === 'mingguan') {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        dari = d.toISOString().slice(0, 10);
      } else {
        // bulanan (30 hari terakhir)
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        dari = d.toISOString().slice(0, 10);
      }
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) {
      const supabase = await createClient();

      // Ambil profil anggota aktif
      let profileQuery = supabase
        .from('profiles')
        .select('*')
        .eq('aktif', true)
        .neq('role', 'pembina');

      if (filterKelas && filterKelas !== 'semua') {
        profileQuery = profileQuery.eq('kelas', filterKelas);
      }

      const { data: profiles, error: pErr } = await profileQuery;
      if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

      // Ambil checkin dalam rentang tanggal
      const { data: checkinList, error: cErr } = await supabase
        .from('checkin')
        .select('*')
        .gte('tanggal', dari)
        .lte('tanggal', sampai);

      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });

      // Hitung per anggota
      const rekapAnggota = (profiles || []).map((prof) => {
        const userChecks = (checkinList || []).filter((c) => c.profile_id === prof.id);
        const hadir = userChecks.filter((c) => c.status === 'hadir').length;
        const izin = userChecks.filter((c) => c.status === 'izin').length;
        const tidakHadir = userChecks.filter((c) => c.status === 'tidak_hadir').length;
        const total = hadir + izin + tidakHadir;
        const persentase = total > 0 ? Math.round(((hadir + izin) / total) * 100) : 0;

        return {
          profile_id: prof.id,
          nis: prof.nis,
          nama: prof.nama,
          kelas: prof.kelas,
          jabatan: prof.jabatan,
          agama: prof.agama,
          hadir,
          izin,
          tidak_hadir: tidakHadir,
          total_tercatat: total,
          persentase,
        };
      });

      return NextResponse.json({
        ok: true,
        data: {
          periode,
          dari,
          sampai,
          total_anggota: (profiles || []).length,
          rekap: rekapAnggota,
        },
      });
    } else {
      // Mock fallback
      const profiles = dataService.getProfiles().filter((p) => p.is_active && p.role !== 'pembina');
      const presensi = dataService.getPresensiList();

      const rekap = profiles.map((p) => {
        const userPres = presensi.filter((pr) => pr.user_id === p.id);
        const hadir = userPres.filter((pr) => pr.status === 'hadir').length;
        const izin = userPres.filter((pr) => pr.status === 'izin_halangan').length;
        const tidakHadir = userPres.filter((pr) => pr.status === 'tidak_hadir').length;
        const total = hadir + izin + tidakHadir;
        const persentase = total > 0 ? Math.round(((hadir + izin) / total) * 100) : 0;

        return {
          profile_id: p.id,
          nis: p.nis,
          nama: p.full_name,
          kelas: p.kelas,
          jabatan: p.jabatan,
          agama: p.agama,
          hadir,
          izin,
          tidak_hadir: tidakHadir,
          total_tercatat: total,
          persentase,
        };
      });

      return NextResponse.json({
        ok: true,
        data: {
          periode,
          dari,
          sampai,
          total_anggota: profiles.length,
          rekap,
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
