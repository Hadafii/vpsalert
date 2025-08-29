// ====================================
// app/api/test/full-flow/route.ts - COMPLETE FLOW TEST
// ====================================

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Test-Secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testResults = {
    timestamp: new Date().toISOString(),
    test_sequence: [] as any[],
    overall_success: false,
    duration: 0,
  };

  const startTime = Date.now();

  try {
    // Step 1: Test manual status change
    testResults.test_sequence.push({
      step: 1,
      name: "Manual Status Change",
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const statusChangeResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/test/sse-trigger`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Test-Secret": process.env.CRON_SECRET || "",
        },
        body: JSON.stringify({
          model: 1,
          datacenter: "SBG",
          status: "available",
        }),
      }
    );

    const statusResult = await statusChangeResponse.json();

    testResults.test_sequence[0].status = statusResult.success
      ? "✅ success"
      : "❌ failed";
    testResults.test_sequence[0].result = statusResult;

    // Step 2: Wait and check SSE broadcast
    testResults.test_sequence.push({
      step: 2,
      name: "SSE Broadcast Check",
      status: "running",
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const sseStatsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/test/sse-debug?action=stats`
    );
    const sseStats = await sseStatsResponse.json();

    testResults.test_sequence[1].status =
      sseStats.sse_stats.endpoint_status === "accessible"
        ? "✅ success"
        : "❌ failed";
    testResults.test_sequence[1].result = sseStats;

    // Step 3: Test cron job simulation
    testResults.test_sequence.push({
      step: 3,
      name: "Cron Job Simulation",
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const cronResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/test/cron-simulation?secret=${process.env.CRON_SECRET}`
    );
    const cronResult = await cronResponse.json();

    testResults.test_sequence[2].status = cronResult.simulation_result?.success
      ? "✅ success"
      : "❌ failed";
    testResults.test_sequence[2].result = cronResult;

    // Calculate overall success
    testResults.overall_success = testResults.test_sequence.every((test) =>
      test.status.includes("✅")
    );
    testResults.duration = Date.now() - startTime;

    return NextResponse.json(testResults);
  } catch (error) {
    testResults.test_sequence.push({
      step: testResults.test_sequence.length + 1,
      name: "Test Execution",
      status: "❌ failed",
      result: { error: (error as Error).message },
      timestamp: new Date().toISOString(),
    });

    testResults.duration = Date.now() - startTime;

    return NextResponse.json(testResults, { status: 500 });
  }
}
