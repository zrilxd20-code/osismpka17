import { NextResponse } from 'next/server';
import { generateTemplateExcelBuffer } from '@/lib/impor-parser';

export async function GET() {
  try {
    const buffer = await generateTemplateExcelBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template_Impor_Siswa_OSIS_MPK.xlsx"',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Gagal membuat template: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
