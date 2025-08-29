// ====================================
// TESTING HELPER UTILITIES
// ====================================

// lib/testing-utils.ts - Testing helper functions
export const testingUtils = {
  // Generate test data
  generateTestStatusChange: () => ({
    model: Math.floor(Math.random() * 6) + 1,
    datacenter: ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR", "SGP", "SYD"][
      Math.floor(Math.random() * 6)
    ],
    status: Math.random() > 0.5 ? "available" : "out-of-stock",
  }),

  // Test URL builder
  buildTestUrl: (endpoint: string, params: Record<string, string> = {}) => {
    const url = new URL(endpoint, process.env.NEXT_PUBLIC_APP_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  },

  // Wait helper for async tests
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Format test results
  formatTestResult: (
    name: string,
    success: boolean,
    message: string,
    data?: any
  ) => ({
    test_name: name,
    success,
    message,
    timestamp: new Date().toISOString(),
    data: data || null,
  }),
};
