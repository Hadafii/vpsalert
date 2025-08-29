// app/api/test/sse-trigger/route.ts - NEW FILE
import { NextRequest, NextResponse } from "next/server";
import { upsertStatus } from "@/lib/queries";
import { triggerSSEBroadcast } from "@/lib/sse-broadcast";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Test-Secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { model, datacenter, status } = await request.json();

    // Force status change
    const result = await upsertStatus(model, datacenter, status);

    // Trigger SSE broadcast
    if (result.changed) {
      await triggerSSEBroadcast([
        {
          model,
          datacenter,
          status,
          oldStatus: result.oldStatus,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      changed: result.changed,
      oldStatus: result.oldStatus,
      newStatus: status,
      message: `Model ${model} in ${datacenter} → ${status}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to trigger change",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
