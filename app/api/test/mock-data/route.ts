// ====================================
// app/api/test/mock-data/route.ts - MOCK DATA FOR TESTING
// ====================================

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Test-Secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action } = await request.json();

    if (action === "generate-changes") {
      // Generate random status changes for testing
      const models = [1, 2, 3, 4, 5, 6];
      const datacenters = [
        "GRA",
        "SBG",
        "BHS",
        "WAW",
        "UK",
        "DE",
        "FR",
        "SGP",
        "SYD",
      ];
      const changes = [];

      // Create 3-5 random changes
      const numChanges = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < numChanges; i++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const datacenter =
          datacenters[Math.floor(Math.random() * datacenters.length)];
        const status = Math.random() > 0.5 ? "available" : "out-of-stock";

        // Trigger the change
        const changeResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/test/sse-trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Test-Secret": process.env.CRON_SECRET || "",
            },
            body: JSON.stringify({ model, datacenter, status }),
          }
        );

        const changeResult = await changeResponse.json();
        changes.push(changeResult);

        // Small delay between changes
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return NextResponse.json({
        success: true,
        changes_generated: changes.length,
        changes: changes,
        message: `Generated ${changes.length} random status changes for testing`,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        error: "Invalid action",
        available_actions: ["generate-changes"],
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Mock data generation failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
