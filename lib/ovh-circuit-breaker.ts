import { logger } from "@/lib/logs";
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  lastLogTime: number;
}

const FAILURE_THRESHOLD = parseInt(
  process.env.OVH_CIRCUIT_BREAKER_THRESHOLD || "5"
);
const RECOVERY_TIMEOUT = 300000;
const LOG_THROTTLE = 60000;

let circuitState: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  state: "CLOSED",
  lastLogTime: 0,
};

const throttledLog = (level: "info" | "warn" | "error", message: string) => {
  const now = Date.now();
  if (now - circuitState.lastLogTime > LOG_THROTTLE) {
    console[level](`Circuit Breaker: ${message}`);
    circuitState.lastLogTime = now;
  }
};

export const canCallOVHAPI = (): boolean => {
  const now = Date.now();

  if (circuitState.state === "OPEN") {
    if (now - circuitState.lastFailureTime > RECOVERY_TIMEOUT) {
      circuitState.state = "HALF_OPEN";
      throttledLog("info", "Moving to HALF_OPEN - trying recovery");
      return true;
    }

    throttledLog(
      "warn",
      `API calls blocked - circuit OPEN (${Math.round((RECOVERY_TIMEOUT - (now - circuitState.lastFailureTime)) / 1000)}s remaining)`
    );
    return false;
  }

  return true;
};

export const recordOVHSuccess = (): void => {
  if (circuitState.state === "HALF_OPEN") {
    circuitState.state = "CLOSED";
    circuitState.failureCount = 0;
    throttledLog("info", "Circuit CLOSED - OVH API recovered");
  } else if (circuitState.failureCount > 0) {
    circuitState.failureCount = Math.max(0, circuitState.failureCount - 1);
  }
};

export const recordOVHFailure = (error?: string): void => {
  circuitState.failureCount++;
  circuitState.lastFailureTime = Date.now();

  if (
    circuitState.failureCount >= FAILURE_THRESHOLD &&
    circuitState.state !== "OPEN"
  ) {
    circuitState.state = "OPEN";
    logger.error(
      `Circuit Breaker: OPENED after ${circuitState.failureCount} failures. ` +
        `Recovery in ${RECOVERY_TIMEOUT / 1000}s. Last error: ${error || "Unknown"}`
    );
  } else if (circuitState.state === "HALF_OPEN") {
    circuitState.state = "OPEN";
    logger.warn(`Circuit Breaker: Back to OPEN from HALF_OPEN due to failure`);
  }
};

export const getCircuitBreakerStatus = () => {
  return {
    state: circuitState.state,
    failureCount: circuitState.failureCount,
    lastFailureTime: circuitState.lastFailureTime,
    timeUntilRecovery:
      circuitState.state === "OPEN"
        ? Math.max(
            0,
            RECOVERY_TIMEOUT - (Date.now() - circuitState.lastFailureTime)
          )
        : 0,
    threshold: FAILURE_THRESHOLD,
  };
};

export const resetCircuitBreaker = (): void => {
  circuitState = {
    failureCount: 0,
    lastFailureTime: 0,
    state: "CLOSED",
    lastLogTime: 0,
  };
  logger.log("Circuit Breaker: Manual reset to CLOSED state");
};

const circuitBreaker = {
  canCallOVHAPI,
  recordOVHSuccess,
  recordOVHFailure,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
};

export default circuitBreaker;
