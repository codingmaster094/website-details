import { NextRequest, NextResponse } from "next/server";
import { analysesToExcelBuffer, analysisToExcelBuffer, detailRowsToExcelBuffer, excelFilename, type ExcelDetailRow } from "@/lib/export/excel-export";
import { companyAnalysisSchema } from "@/lib/validation/company-schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const payload = body?.data ?? body;
  if (body?.rows && Array.isArray(body.rows)) {
    const buffer = detailRowsToExcelBuffer(body.rows as ExcelDetailRow[]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${excelFilename()}"`,
      },
    });
  }

  if (Array.isArray(payload)) {
    const parsed = payload.map((item) => companyAnalysisSchema.safeParse(item));
    if (parsed.some((item) => !item.success)) {
      return NextResponse.json({ success: false, error: "Invalid analysis payload" }, { status: 400 });
    }
    const analyses = parsed.map((item) => item.data!);
    const buffer = analysesToExcelBuffer(analyses);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${excelFilename()}"`,
      },
    });
  }

  const parsed = companyAnalysisSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid analysis payload" }, { status: 400 });
  }

  const buffer = analysisToExcelBuffer(parsed.data);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${excelFilename()}"`,
    },
  });
}
