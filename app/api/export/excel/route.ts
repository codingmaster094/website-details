import { NextRequest, NextResponse } from "next/server";
import { analysisToExcelBuffer, excelFilename } from "@/lib/export/excel-export";
import { companyAnalysisSchema } from "@/lib/validation/company-schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = companyAnalysisSchema.safeParse(body?.data ?? body);
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
