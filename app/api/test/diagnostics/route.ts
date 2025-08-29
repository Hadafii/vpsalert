// ====================================
// FIX #1: app/api/test/diagnostics/route.ts - UPDATE EXISTING
// ====================================

import { NextRequest, NextResponse } from "next/server";
import { getAllStatus } from "@/lib/queries";
import { getCircuitBreakerStatus } from "@/lib/ovh-circuit-breaker";
import { sseConnections } from "@/lib/sse-broadcast";

export async function GET() {
  const startTime = Date.now();

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,

    // Database diagnostics - FIX: Make error properly typed
    database: {
      status: "testing...",
      connection: false,
      record_count: 0,
      last_updated: null as string | null,
      error: null as string | null, // FIX: Explicitly type as string | null
    },

    // SSE diagnostics
    sse: {
      endpoint_accessible: true,
      active_connections: sseConnections.size,
      max_connections: process.env.MAX_SSE_CONNECTIONS || "1000",
      connection_usage_percent: Math.round((sseConnections.size / 1000) * 100),
      error: null as string | null, // FIX: Explicitly type
    },

    // OVH API diagnostics
    ovh_api: {
      circuit_breaker: null as any,
      endpoint_url: "https://ca.api.ovh.com/1.0/vps/order/rule/datacenter",
      timeout: process.env.OVH_API_TIMEOUT || "5000",
      error: null as string | null, // FIX: Explicitly type
    },

    // Cron diagnostics
    cron: {
      secret_configured: !!process.env.CRON_SECRET,
      external_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/poll-ovh`,
      last_simulation: null as string | null,
      error: null as string | null, // FIX: Explicitly type
    },
  };

  // Test database connection
  try {
    const statuses = await getAllStatus();
    const latestUpdate =
      statuses.length > 0
        ? Math.max(...statuses.map((s) => new Date(s.last_checked).getTime()))
        : null;

    diagnostics.database = {
      status: "✅ Connected",
      connection: true,
      record_count: statuses.length,
      last_updated: latestUpdate ? new Date(latestUpdate).toISOString() : null,
      error: null,
    };
  } catch (error) {
    diagnostics.database = {
      status: "❌ Failed",
      connection: false,
      record_count: 0,
      last_updated: null,
      error: (error as Error).message, // FIX: Proper error casting
    };
  }

  // Test circuit breaker
  try {
    diagnostics.ovh_api.circuit_breaker = getCircuitBreakerStatus();
  } catch (error) {
    diagnostics.ovh_api.error = (error as Error).message; // FIX: Proper error casting
  }

  // Calculate response time
  const responseTime = Date.now() - startTime;

  return NextResponse.json(
    {
      ...diagnostics,
      response_time_ms: responseTime,
      overall_health:
        diagnostics.database.connection &&
        diagnostics.sse.active_connections >= 0
          ? "🟢 Healthy"
          : "🔴 Issues Detected",
    },
    {
      headers: {
        "Cache-Control": "no-cache",
      },
    }
  );
}
