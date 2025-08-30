export const testingUtils = {
  generateTestStatusChange: () => ({
    model: Math.floor(Math.random() * 6) + 1,
    datacenter: ["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR", "SGP", "SYD"][
      Math.floor(Math.random() * 6)
    ],
    status: Math.random() > 0.5 ? "available" : "out-of-stock",
  }),

  buildTestUrl: (endpoint: string, params: Record<string, string> = {}) => {
    const url = new URL(endpoint, process.env.NEXT_PUBLIC_APP_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  },

  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

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
