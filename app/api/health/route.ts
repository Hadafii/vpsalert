import { NextRequest, NextResponse } from "next/server";
import { healthCheck } from "@/lib/db";
import { testEmailConnection } from "@/lib/email";
import { getCircuitBreakerStatus } from "@/lib/ovh-circuit-breaker";

interface HealthStatus {
  database: boolean | string;
  email: boolean | string;
  ovh_api: {
    available: boolean;
    circuit_breaker: any;
  };
  memory_usage?: {
    used: string;
    total: string;
    percentage: number;
  };
  uptime: number;
  timestamp: string;
  version: string;
}

const getMemoryUsage = () => {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const usage = process.memoryUsage();
    const used = Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
    const total = Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100;

    return {
      used: `${used} MB`,
      total: `${total} MB`,
      percentage: Math.round((used / total) * 100),
    };
  }
  return undefined;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const healthStatus: HealthStatus = {
    database: false,
    email: false,
    ovh_api: {
      available: false,
      circuit_breaker: null,
    },
    uptime: process.uptime ? Math.floor(process.uptime()) : 0,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  };

  let overallHealth = true;

  try {
    try {
      const dbHealthy = await healthCheck();
      healthStatus.database = dbHealthy;
      if (!dbHealthy) overallHealth = false;
    } catch (error) {
      healthStatus.database = (error as Error).message;
      overallHealth = false;
    }

    try {
      const emailHealthy = await testEmailConnection();
      healthStatus.email = emailHealthy;
      if (!emailHealthy) overallHealth = false;
    } catch (error) {
      healthStatus.email = (error as Error).message;
      overallHealth = false;
    }

    try {
      const circuitStatus = getCircuitBreakerStatus();
      healthStatus.ovh_api = {
        available:
          circuitStatus.state === "CLOSED" ||
          circuitStatus.state === "HALF_OPEN",
        circuit_breaker: circuitStatus,
      };
    } catch (error) {
      healthStatus.ovh_api = {
        available: false,
        circuit_breaker: { error: (error as Error).message },
      };
    }

    const memoryUsage = getMemoryUsage();
    if (memoryUsage) {
      healthStatus.memory_usage = memoryUsage;

      if (memoryUsage.percentage > 90) {
        overallHealth = false;
      }
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: overallHealth ? "healthy" : "unhealthy",
        ...healthStatus,
        response_time_ms: responseTime,
      },
      {
        status: overallHealth ? 200 : 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        ...healthStatus,
        error: (error as Error).message,
        response_time_ms: Date.now() - startTime,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}

export async function HEAD() {
  try {
    await healthCheck();

    return new Response(null, {
      status: 200,
      headers: {
        "X-Health-Status": "ok",
        "X-Timestamp": new Date().toISOString(),
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        "X-Health-Status": "error",
        "X-Error": (error as Error).message,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("X-Admin-Secret");
  if (authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const includeDetailed = body.detailed === true;

    const basicHealth = await GET(request);
    const healthData = await basicHealth.json();

    if (!includeDetailed) {
      return NextResponse.json(healthData);
    }

    const detailedInfo = {
      ...healthData,
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu_usage: process.cpuUsage ? process.cpuUsage() : null,
        env: process.env.NODE_ENV || "development",
      },
      database_pool: {},
    };

    return NextResponse.json(detailedInfo);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request",
        message: (error as Error).message,
      },
      { status: 400 }
    );
  }
}
