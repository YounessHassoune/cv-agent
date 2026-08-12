import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const application = await db.application.findFirst({
    where: { id, userId: user.userId },
    select: { pdfBytes: true, cvJson: true },
  });
  if (!application?.pdfBytes) return new Response("Not found", { status: 404 });

  const cv = application.cvJson as { header?: { fullName?: string } } | null;
  const name = (cv?.header?.fullName ?? "cv").replace(/[^\w-]+/g, "_");

  return new Response(new Uint8Array(application.pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}_CV.pdf"`,
      "cache-control": "no-store",
    },
  });
}
