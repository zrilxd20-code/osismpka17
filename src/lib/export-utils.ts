// Utilitas Ekspor Laporan ke Excel (.xlsx) dan PDF (jsPDF)

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PresensiIbadah } from '@/types/database';
import { formatTanggalIndonesia, formatJamWIB } from './time-utils';

/**
 * Ekspor data presensi ke format file Excel (.xlsx)
 */
export function exportToExcel(data: PresensiIbadah[], title: string = 'Laporan_Presensi_Ibadah'): void {
  const rows = data.map((item, index) => {
    const isIzin = item.status === 'izin' || item.status === 'izin_halangan';
    const alasan = item.keterangan || item.keterangan_halangan || 'Izin';
    const statusLabel = item.status === 'hadir' ? 'Hadir' : isIzin ? `Izin (${alasan})` : 'Tidak Hadir';
    const verif =
      item.status_verifikasi === 'valid' || item.status_verifikasi === 'terverifikasi'
        ? 'Terverifikasi'
        : item.status_verifikasi === 'pelanggaran' || item.status_verifikasi === 'tidak_valid'
        ? 'Tidak Valid'
        : item.status_verifikasi === 'ditolak'
        ? 'Ditolak'
        : 'Menunggu';

    return {
      No: index + 1,
      Tanggal: item.tanggal,
      NIS: item.profile?.nis || '-',
      'Nama Lengkap': item.profile?.full_name || item.profile?.nama || '-',
      Organisasi: item.profile?.organisasi || '-',
      Kelas: item.profile?.kelas || '-',
      Agama: item.profile?.agama?.toUpperCase() || '-',
      'Jenis Ibadah': (item.ibadah || item.jenis_ibadah?.nama) === 'sholat_dzuhur' ? 'Sholat Dzuhur' : 'Pendalaman Iman',
      Status: statusLabel,
      'Waktu Check-in': formatJamWIB(item.waktu_checkin || item.dibuat_pada),
      Saksi: item.saksi || '-',
      'Status Verifikasi': verif,
      'Catatan Pengurus': item.catatan_verifikasi || item.catatan_pengurus || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 10 }, // NIS
    { wch: 25 }, // Nama
    { wch: 12 }, // Organisasi
    { wch: 12 }, // Kelas
    { wch: 10 }, // Agama
    { wch: 20 }, // Jenis Ibadah
    { wch: 20 }, // Status
    { wch: 15 }, // Waktu
    { wch: 18 }, // Saksi
    { wch: 16 }, // Verifikasi
    { wch: 30 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Presensi Ibadah');

  // Trigger download
  XLSX.writeFile(workbook, `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Ekspor data presensi ke file PDF berformat resmi dengan tabel dan tanda tangan
 */
export function exportToPDF(
  data: PresensiIbadah[],
  periodeText: string = 'Rekapitulasi Ibadah',
  kordinatorName: string = 'Fadhil Pratama',
  pembinaName: string = 'Nurkholis Aiman / Maria Ulfa'
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('DIVISI KEAGAMAAN (A17) OSIS & MPK SMKN 17 JAKARTA', 148, 15, { align: 'center' });

  doc.setFontSize(13);
  doc.text('LAPORAN PRESENSI IBADAH ANGGOTA', 148, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${periodeText} | Dicetak: ${formatTanggalIndonesia(new Date().toISOString().slice(0, 10))}`, 148, 28, {
    align: 'center',
  });

  doc.setLineWidth(0.5);
  doc.line(14, 32, 283, 32);

  const tableData = data.map((item, idx) => {
    const isIzin = item.status === 'izin' || item.status === 'izin_halangan';
    const statusText = item.status === 'hadir' ? 'Hadir' : isIzin ? 'Izin' : 'Tidak Hadir';
    const catatan = item.catatan_verifikasi || item.catatan_pengurus || item.keterangan || item.keterangan_halangan || '-';

    return [
      idx + 1,
      item.tanggal,
      item.profile?.nis || '-',
      item.profile?.full_name || item.profile?.nama || '-',
      item.profile?.organisasi || '-',
      item.profile?.kelas || '-',
      (item.ibadah || item.jenis_ibadah?.nama) === 'sholat_dzuhur' ? 'Dzuhur' : 'Pend. Iman',
      statusText,
      formatJamWIB(item.waktu_checkin || item.dibuat_pada),
      item.saksi || '-',
      item.status_verifikasi.toUpperCase(),
      catatan,
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['No', 'Tgl', 'NIS', 'Nama', 'Org', 'Kelas', 'Ibadah', 'Status', 'Jam', 'Saksi', 'Verif', 'Catatan']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [16, 78, 139],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [247, 249, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 18 },
      3: { cellWidth: 40 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 16 },
      6: { cellWidth: 22 },
      7: { halign: 'center', cellWidth: 20 },
      8: { halign: 'center', cellWidth: 20 },
      9: { cellWidth: 25 },
      10: { halign: 'center', cellWidth: 22 },
      11: { cellWidth: 41 },
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable to doc
  const finalY = (doc.lastAutoTable?.finalY || 120) + 12;

  if (finalY < 170) {
    doc.setFontSize(9);
    doc.text('Mengetahui,', 40, finalY);
    doc.text('Pembina OSIS / MPK', 40, finalY + 5);
    doc.text(`(${pembinaName})`, 40, finalY + 25);

    doc.text('Diverifikasi oleh,', 220, finalY);
    doc.text('Koordinator Divisi Keagamaan', 220, finalY + 5);
    doc.text(`(${kordinatorName})`, 220, finalY + 25);
  }

  doc.save(`Laporan_Ibadah_OSIS_MPK_${new Date().toISOString().slice(0, 10)}.pdf`);
}
