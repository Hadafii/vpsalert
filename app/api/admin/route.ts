// app/api/admin/circuit-breaker/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  recordOVHFailure,
  recordOVHSuccess,
} from "@/lib/ovh-circuit-breaker";

// Admin endpoint untuk managing circuit breaker
export async function GET(request: NextRequest) {
  // Simple auth check
  const authHeader = request.headers.get("X-Admin-Secret");
  if (authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = getCircuitBreakerStatus();

    return NextResponse.json({
      circuit_breaker: status,
      timestamp: new Date().toISOString(),
      actions_available: ["reset", "test-failure", "test-success"],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get circuit breaker status",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// Admin actions untuk circuit breaker
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("X-Admin-Secret");
  if (authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "reset":
        resetCircuitBreaker();
        return NextResponse.json({
          success: true,
          message: "Circuit breaker reset to CLOSED state",
          circuit_breaker: getCircuitBreakerStatus(),
          timestamp: new Date().toISOString(),
        });

      case "test-failure":
        const testError = body.error || "Admin test failure";
        recordOVHFailure(testError);
        return NextResponse.json({
          success: true,
          message: "Test failure recorded",
          circuit_breaker: getCircuitBreakerStatus(),
          timestamp: new Date().toISOString(),
        });

      case "test-success":
        recordOVHSuccess();
        return NextResponse.json({
          success: true,
          message: "Test success recorded",
          circuit_breaker: getCircuitBreakerStatus(),
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          {
            error: "Invalid action",
            available_actions: ["reset", "test-failure", "test-success"],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to perform circuit breaker action",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
