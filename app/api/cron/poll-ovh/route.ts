// app/api/cron/poll-ovh/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  upsertStatus,
  getActiveSubscriptionsForStatus,
  queueEmailNotification,
} from "@/lib/queries";
import { VPSStatus, StatusChange } from "@/lib/queries";
import {
  canCallOVHAPI,
  recordOVHSuccess,
  recordOVHFailure,
  getCircuitBreakerStatus,
} from "@/lib/ovh-circuit-breaker";
import { logger } from "@/lib/logs";
import { triggerSSEBroadcast } from "@/lib/sse-broadcast";

// OVH API Configuration - Fixed untuk real endpoints
const OVH_BASE_URL = "https://ca.api.ovh.com/1.0/vps/order/rule/datacenter";
const OVH_PARAMS = "ovhSubsidiary=ASIA&os=";
const VPS_MODELS = [1, 2, 3, 4, 5, 6];

// Datacenter mapping untuk response OVH
const DATACENTER_MAPPING: Record<string, string> = {
  // Europe
  gra: "GRA", // Gravelines, France
  sbg: "SBG", // Strasbourg, France
  rbx: "RBX", // Roubaix, France
  waw: "WAW", // Warsaw, Poland
  fra: "DE", // Frankfurt, Germany (legacy)
  // Americas
  bhs: "BHS", // Beauharnois, Canada
  // Asia Pacific
  sgp: "SGP", // Singapore (NEW!)
  syd: "SYD", // Sydney, Australia (NEW!)
  // UK & Others
  lon: "UK", // London, UK (legacy)
  uk: "UK", // London, UK (current)
  de: "DE", // Germany (current)
};

// Interface untuk OVH API Response (actual structure)
interface OVHDatacenterResponse {
  datacenter: string;
  available: boolean;
}

interface OVHResponse {
  datacenters?: OVHDatacenterResponse[];
  // Alternative structures yang mungkin
  available_datacenters?: string[];
  unavailable_datacenters?: string[];
}

// Parse OVH Response - Fixed untuk actual API
// Replace parseOVHResponse function dengan handling multiple formats
const parseOVHResponse = (
  response: any,
  model: number
): { datacenter: string; status: VPSStatus }[] => {
  const results: { datacenter: string; status: VPSStatus }[] = [];

  try {
    // NEW API Structure - Handle "datacenters" array
    if (response.datacenters && Array.isArray(response.datacenters)) {
      response.datacenters.forEach((dc: any) => {
        if (dc.datacenter) {
          // Use datacenter code directly (SGP, DE, WAW, etc.)
          const datacenterCode = dc.datacenter.toUpperCase();

          // Determine status - prioritize linuxStatus untuk VPS Linux
          let status: VPSStatus = "out-of-stock";

          if (dc.linuxStatus === "available" || dc.status === "available") {
            status = "available";
          }

          results.push({
            datacenter: datacenterCode,
            status: status,
          });

          console.log(
            `✅ Parsed: ${datacenterCode} → ${status} (linux: ${dc.linuxStatus})`
          );
        }
      });
    }

    // LEGACY: Handle old format if new format not available
    else if (
      response.available_datacenters &&
      Array.isArray(response.available_datacenters)
    ) {
      response.available_datacenters.forEach((dc: string) => {
        const mappedDC =
          DATACENTER_MAPPING[dc.toLowerCase()] || dc.toUpperCase();
        results.push({
          datacenter: mappedDC,
          status: "available",
        });
      });

      if (
        response.unavailable_datacenters &&
        Array.isArray(response.unavailable_datacenters)
      ) {
        response.unavailable_datacenters.forEach((dc: string) => {
          const mappedDC =
            DATACENTER_MAPPING[dc.toLowerCase()] || dc.toUpperCase();
          results.push({
            datacenter: mappedDC,
            status: "out-of-stock",
          });
        });
      }
    }

    // FALLBACK: Handle any other structure
    else {
      console.warn(
        `Unknown OVH API response structure for model ${model}:`,
        response
      );
    }
  } catch (error) {
    console.error(`Error parsing OVH response for model ${model}:`, error);
  }

  return results;
};

// Fetch single VPS model status
const fetchModelStatus = async (
  model: number
): Promise<{ model: number; datacenters: any[]; error?: string }> => {
  const url = `${OVH_BASE_URL}?${OVH_PARAMS}&planCode=vps-2025-model${model}`;

  // Circuit breaker check
  if (!canCallOVHAPI()) {
    return {
      model,
      datacenters: [],
      error: "Circuit breaker is OPEN - OVH API temporarily unavailable",
    };
  }

  try {
    // Create AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      parseInt(process.env.OVH_API_TIMEOUT || "5000")
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "OVH-VPS-Monitor/1.0",
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OVHResponse = await response.json();
    const datacenters = parseOVHResponse(data, model);

    // Record success for circuit breaker
    recordOVHSuccess();

    return { model, datacenters };
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error(`Error fetching model ${model}:`, errorMessage);

    // Record failure for circuit breaker
    recordOVHFailure(errorMessage);

    return {
      model,
      datacenters: [],
      error: errorMessage,
    };
  }
};

// Process status updates and queue notifications
const processStatusUpdates = async (results: any[]) => {
  let totalChanges = 0;
  const statusUpdates: any[] = []; // NEW: Collect updates untuk SSE

  for (const result of results) {
    if (result.error) continue;

    for (const dcStatus of result.datacenters) {
      const updateResult = await upsertStatus(
        result.model,
        dcStatus.datacenter,
        dcStatus.status
      );

      if (updateResult.changed) {
        totalChanges++;

        // Collect untuk SSE broadcast - NEW!
        statusUpdates.push({
          model: result.model,
          datacenter: dcStatus.datacenter,
          status: dcStatus.status,
          oldStatus: updateResult.oldStatus,
          timestamp: new Date().toISOString(),
        });

        // Queue email notifications
        const statusChange: StatusChange =
          dcStatus.status === "available"
            ? "became_available"
            : "became_out_of_stock";

        const subscriptions = await getActiveSubscriptionsForStatus(
          result.model,
          dcStatus.datacenter
        );

        for (const subscription of subscriptions) {
          await queueEmailNotification(
            subscription.user_id,
            result.model,
            dcStatus.datacenter,
            statusChange
          );
        }

        logger.log(
          `Status change: Model ${result.model} in ${dcStatus.datacenter} is now ${dcStatus.status}`
        );
      }
    }
  }

  // NEW: Trigger SSE broadcast untuk semua changes
  if (statusUpdates.length > 0) {
    try {
      await triggerSSEBroadcast(statusUpdates);
      logger.log(
        `✅ SSE broadcast sent for ${statusUpdates.length} status changes`
      );
    } catch (error) {
      logger.error("❌ SSE broadcast failed:", error);
    }
  }

  return totalChanges;
};

// Main polling endpoint
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Security check
  const cronSecret =
    request.headers.get("X-Cron-Secret") ||
    request.nextUrl.searchParams.get("secret");

  if (cronSecret !== process.env.CRON_SECRET) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.log("Starting OVH status polling for 6 models...");

  try {
    // Fetch all models in parallel
    const promises = VPS_MODELS.map((model) => fetchModelStatus(model));
    const results = await Promise.allSettled(promises);

    // Process results
    const processedResults = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          model: VPS_MODELS[index],
          datacenters: [],
          error: result.reason?.message || "Unknown error",
        };
      }
    });

    // Update database and queue notifications
    const totalChanges = await processStatusUpdates(processedResults);

    const duration = Date.now() - startTime;
    const successCount = processedResults.filter((r) => !r.error).length;
    const errorCount = processedResults.filter((r) => r.error).length;

    logger.log(
      `Polling completed: ${successCount}/${VPS_MODELS.length} successful, ` +
        `${totalChanges} changes detected (${duration}ms)`
    );

    return NextResponse.json({
      success: errorCount === 0,
      timestamp: new Date().toISOString(),
      summary: {
        models_checked: VPS_MODELS.length,
        successful: successCount,
        failed: errorCount,
        changes_detected: totalChanges,
        duration: duration,
      },
      circuit_breaker: getCircuitBreakerStatus(),
      results: processedResults,
      message:
        totalChanges > 0
          ? `Found ${totalChanges} status changes`
          : "No changes detected",
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Polling failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Polling failed",
        message: (error as Error).message,
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

// Health check
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "X-Cron-Status": "ready",
      "X-Models": VPS_MODELS.join(","),
    },
  });
}
