// ====================================
// app/api/test/sse-debug/route.ts - SSE CONNECTION DEBUGGING
// ====================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    // Get SSE connection stats
    if (action === "stats") {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/sse/status`,
        {
          method: "HEAD",
        }
      );

      return NextResponse.json({
        sse_stats: {
          active_connections:
            response.headers.get("X-Active-Connections") || "0",
          max_connections:
            response.headers.get("X-Max-Connections") || "unknown",
          usage_percentage: response.headers.get("X-Connection-Usage") || "0%",
          endpoint_status: response.ok ? "accessible" : "failed",
          response_headers: Object.fromEntries(response.headers.entries()),
        },
        test_info: {
          timestamp: new Date().toISOString(),
          app_url: process.env.NEXT_PUBLIC_APP_URL,
          environment: process.env.NODE_ENV,
        },
      });
    }

    // Test SSE broadcast manually
    if (action === "broadcast") {
      const secret = searchParams.get("secret");

      if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/sse/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "broadcast",
            test_data: {
              type: "test-broadcast",
              message: "Manual SSE broadcast test",
              timestamp: new Date().toISOString(),
            },
          }),
        }
      );

      const result = await response.text();

      return NextResponse.json({
        broadcast_test: {
          success: response.ok,
          status_code: response.status,
          response: result,
          message: response.ok
            ? "Broadcast sent successfully"
            : "Broadcast failed",
        },
        timestamp: new Date().toISOString(),
      });
    }

    // List all available actions
    return NextResponse.json({
      available_actions: [
        {
          action: "stats",
          url: "/api/test/sse-debug?action=stats",
          description: "Get SSE connection statistics",
        },
        {
          action: "broadcast",
          url: "/api/test/sse-debug?action=broadcast&secret=YOUR_SECRET",
          description: "Test manual SSE broadcast",
        },
      ],
      current_stats: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "SSE debug failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
