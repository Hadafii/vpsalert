// ====================================
// app/api/test/cron-simulation/route.ts - CRON JOB SIMULATION
// ====================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Simulate the actual cron job call
    const cronResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/poll-ovh?secret=${process.env.CRON_SECRET}`,
      {
        method: "GET",
        headers: {
          "X-Cron-Secret": process.env.CRON_SECRET || "",
          "User-Agent": "OVH-Monitor-Test/1.0",
        },
      }
    );

    const cronResult = await cronResponse.json();

    return NextResponse.json({
      simulation_result: {
        success: cronResponse.ok,
        status_code: cronResponse.status,
        cron_data: cronResult,
        message: cronResponse.ok
          ? "Cron simulation successful"
          : "Cron simulation failed",
      },
      test_info: {
        timestamp: new Date().toISOString(),
        simulated_by: "manual_test",
        actual_cron_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/poll-ovh`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cron simulation failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
