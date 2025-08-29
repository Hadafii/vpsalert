export interface VerificationResult {
  success: boolean;
  message: string;
  error?: string;
  code?: string;
  data?: {
    user: {
      id: number;
      email: string;
      email_verified: boolean;
      created_at: string;
      verified_at: string;
    };
    subscriptions: {
      total: number;
      active: number;
      models: number[];
      datacenters: string[];
    };
    next_steps: string[];
  };
  timestamp: string;
}
