import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAndRole, createClient } from '@/lib/supabase/server';
import { getServerDateWIB } from '@/lib/server-time';
import { dataService } from '@/lib/data-service';
import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
        { ok: false, error: 'Akses ditolak. Hanya pengurus dan pembina yang dapat mengunduh berkas ekspor.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const today = getServerDateWIB();
    const dari = searchParams.get('dari') || today;
    const sampai = searchParams.get('sampai') || today;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    let dataList: Array<{
      nis: string;
      nama: string;
      kelas: string;
      jabatan: string;
      agama: string;
      hadir: number;
      izin: number;
      tidak_hadir: number;
      total: number;
      persen: number;
    }> = [];

    if (!isDemo) {
      const supabase = await createClient();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('aktif', true)
        .neq('role', 'pembina');

      const { data: checkins } = await supabase
        .from('checkin')
        .select('*')
        .gte('tanggal', dari)
        .lte('tanggal', sampai);

      dataList = (profiles || []).map((p) => {
        const userChecks = (checkins || []).filter((c) => c.profile_id === p.id);
        const hadir = userChecks.filter((c) => c.status === 'hadir').length;
        const izin = userChecks.filter((c) => c.status === 'izin').length;
        const tidak_hadir = userChecks.filter((c) => c.status === 'tidak_hadir').length;
        const total = hadir + izin + tidak_hadir;
        const persen = total > 0 ? Math.round(((hadir + izin) / total) * 100) : 0;
        return {
          nis: p.nis,
          nama: p.nama,
          kelas: p.kelas,
          jabatan: p.jabatan,
          agama: p.agama.toUpperCase(),
          hadir,
          izin,
          tidak_hadir,
          total,
          persen,
        };
      });
    } else {
      const profiles = dataService.getProfiles().filter((p) => p.is_active && p.role !== 'pembina');
      const presensi = dataService.getPresensiList();
      dataList = profiles.map((p) => {
        const userChecks = presensi.filter((pr) => pr.user_id === p.id);
        const hadir = userChecks.filter((pr) => pr.status === 'hadir').length;
        const izin = userChecks.filter((pr) => pr.status === 'izin_halangan').length;
        const tidak_hadir = userChecks.filter((pr) => pr.status === 'tidak_hadir').length;
        const total = hadir + izin + tidak_hadir;
        const persen = total > 0 ? Math.round(((hadir + izin) / total) * 100) : 0;
        return {
          nis: p.nis,
          nama: p.full_name,
          kelas: p.kelas,
          jabatan: p.jabatan,
          agama: p.agama.toUpperCase(),
          hadir,
          izin,
          tidak_hadir,
          total,
          persen,
        };
      });
    }

    // ==========================================
    // 1. FORMAT EXCEL (.xlsx) MENGGUNAKAN EXCELJS
    // ==========================================
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'OSIS MPK Divisi Keagamaan';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Rekapitulasi Ibadah');

      // Title
      sheet.mergeCells('A1:I1');
      sheet.getCell('A1').value = 'LAPORAN REKAPITULASI PRESENSI IBADAH OSIS & MPK';
      sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:I2');
      sheet.getCell('A2').value = `Periode: ${dari} s/d ${sampai} | Tanggal Cetak: ${today}`;
      sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
      sheet.getCell('A2').alignment = { horizontal: 'center' };

      // Table Header Row 4
      sheet.getRow(4).values = [
        'No',
        'NIS',
        'Nama Lengkap',
        'Kelas',
        'Jabatan',
        'Agama',
        'Hadir',
        'Izin',
        'Tidak Hadir',
        'Persentase',
      ];
      sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }, // Teal 700
      };

      sheet.columns = [
        { key: 'no', width: 6 },
        { key: 'nis', width: 14 },
        { key: 'nama', width: 30 },
        { key: 'kelas', width: 14 },
        { key: 'jabatan', width: 25 },
        { key: 'agama', width: 14 },
        { key: 'hadir', width: 10 },
        { key: 'izin', width: 10 },
        { key: 'tidak_hadir', width: 14 },
        { key: 'persen', width: 14 },
      ];

      dataList.forEach((row, idx) => {
        sheet.addRow([
          idx + 1,
          row.nis,
          row.nama,
          row.kelas,
          row.jabatan,
          row.agama,
          row.hadir,
          row.izin,
          row.tidak_hadir,
          `${row.persen}%`,
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Rekap_Ibadah_OSIS_MPK_${today}.xlsx"`,
        },
      });
    }

    // ==========================================
    // 2. FORMAT PDF MENGGUNAKAN PDF-LIB
    // ==========================================
    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Landscape A4: 841.89 x 595.28 pt
      const page = pdfDoc.addPage([842, 595]);
      const { width, height } = page.getSize();

      // Title
      page.drawText('LAPORAN PRESENSI IBADAH OSIS & MPK', {
        x: width / 2 - 180,
        y: height - 50,
        size: 16,
        font: fontBold,
        color: rgb(0.06, 0.1, 0.18),
      });

      page.drawText(`Periode: ${dari} s/d ${sampai} | Dicetak: ${today} WIB`, {
        x: width / 2 - 120,
        y: height - 70,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.55),
      });

      // Header garis
      page.drawLine({
        start: { x: 40, y: height - 85 },
        end: { x: width - 40, y: height - 85 },
        thickness: 1,
        color: rgb(0.8, 0.82, 0.88),
      });

      // Table Header
      let currentY = height - 110;
      page.drawRectangle({
        x: 40,
        y: currentY - 5,
        width: width - 80,
        height: 22,
        color: rgb(0.06, 0.46, 0.43),
      });

      const cols = [
        { label: 'No', x: 45 },
        { label: 'NIS', x: 75 },
        { label: 'Nama Lengkap', x: 155 },
        { label: 'Kelas', x: 345 },
        { label: 'Jabatan', x: 430 },
        { label: 'Agama', x: 580 },
        { label: 'Hadir', x: 650 },
        { label: 'Izin', x: 700 },
        { label: '% Hadir', x: 750 },
      ];

      cols.forEach((col) => {
        page.drawText(col.label, {
          x: col.x,
          y: currentY + 2,
          size: 9,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      });

      currentY -= 20;

      // Table Rows
      dataList.slice(0, 18).forEach((item, idx) => {
        if (idx % 2 === 1) {
          page.drawRectangle({
            x: 40,
            y: currentY - 4,
            width: width - 80,
            height: 18,
            color: rgb(0.96, 0.97, 0.99),
          });
        }

        page.drawText(String(idx + 1), { x: 45, y: currentY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(item.nis, { x: 75, y: currentY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(item.nama.slice(0, 26), { x: 155, y: currentY, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(item.kelas, { x: 345, y: currentY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(item.jabatan.slice(0, 22), { x: 430, y: currentY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(item.agama, { x: 580, y: currentY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(String(item.hadir), { x: 655, y: currentY, size: 8, font: fontRegular, color: rgb(0.06, 0.5, 0.2) });
        page.drawText(String(item.izin), { x: 705, y: currentY, size: 8, font: fontRegular, color: rgb(0.7, 0.4, 0.05) });
        page.drawText(`${item.persen}%`, { x: 755, y: currentY, size: 8, font: fontBold, color: rgb(0.06, 0.4, 0.4) });

        currentY -= 18;
      });

      // Tanda Tangan
      page.drawText('Mengetahui,', { x: 80, y: 75, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page.drawText('Pembina OSIS & MPK', { x: 80, y: 62, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText('( Nurkholis Aiman / Maria Ulfa )', { x: 80, y: 25, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      page.drawText('Diverifikasi oleh,', { x: width - 220, y: 75, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page.drawText('Koordinator Divisi Keagamaan', { x: width - 220, y: 62, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(`( ${currentUser.nama || currentUser.full_name || 'Fadhil Pratama'} )`, {
        x: width - 220,
        y: 25,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      const pdfBytes = await pdfDoc.save();

      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Rekap_Ibadah_OSIS_MPK_${today}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: 'Format tidak didukung. Pilihan: format=xlsx atau format=pdf.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terjadi kesalahan saat ekspor data: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
