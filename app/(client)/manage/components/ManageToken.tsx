// app/manage/[token]/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/app/layouts/MainLayout";
import ManagementDashboard from "@/app/components/ManagementDashboard";
import { Card, CardBody, Alert, Spinner, Button } from "@heroui/react";
import {
  IconExclamationCircle,
  IconHome,
  IconRefresh,
} from "@tabler/icons-react";
import axios from "axios";

// Types
interface User {
  id: number;
  email: string;
  email_verified: boolean;
  created_at: string;
}

interface UserSubscription {
  id: number;
  model: number;
  datacenter: string;
  is_active: boolean;
  created_at: string;
  modelInfo: {
    name: string;
    specs: string;
    price: string;
  };
  datacenterInfo: {
    name: string;
    country: string;
    flag: string;
  };
}

interface Statistics {
  total: number;
  active: number;
  inactive: number;
  modelsCovered: number;
  datacentersCovered: number;
}

interface DashboardData {
  user: User;
  subscriptions: {
    active: UserSubscription[];
    inactive: UserSubscription[];
    all: UserSubscription[];
  };
  statistics: Statistics;
  availableOptions: {
    models: number[];
    datacenters: string[];
  };
}

interface PageState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  isValidToken: boolean;
}

interface ManageTokenPageProps {
  params: Promise<{ token: string }>;
}

const ManageTokenPage: React.FC<ManageTokenPageProps> = ({ params }) => {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{
    token: string;
  } | null>(null);
  const [pageState, setPageState] = useState<PageState>({
    data: null,
    isLoading: true,
    error: null,
    isValidToken: true,
  });

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Validate token format
  const validateTokenFormat = useCallback((token: string): boolean => {
    return /^[a-f0-9]{32}$/.test(token);
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(
    async (token: string) => {
      if (!validateTokenFormat(token)) {
        setPageState({
          data: null,
          isLoading: false,
          error: "Invalid token format",
          isValidToken: false,
        });
        return;
      }

      setPageState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await axios.get(`/api/subscriptions/${token}`);

        if (response.data.success) {
          setPageState({
            data: response.data.data,
            isLoading: false,
            error: null,
            isValidToken: true,
          });
        } else {
          throw new Error(
            response.data.message || "Failed to fetch dashboard data"
          );
        }
      } catch (error: any) {
        let errorMessage = "Failed to load dashboard data";
        let isValidToken = true;

        if (error.response?.status === 404) {
          errorMessage = "Invalid or expired management link";
          isValidToken = false;
        } else if (error.response?.status === 400) {
          errorMessage = "Invalid token format";
          isValidToken = false;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }

        setPageState({
          data: null,
          isLoading: false,
          error: errorMessage,
          isValidToken,
        });
      }
    },
    [validateTokenFormat]
  );

  // Handle dashboard refresh
  const handleRefresh = useCallback(() => {
    if (resolvedParams?.token) {
      fetchDashboardData(resolvedParams.token);
    }
  }, [resolvedParams?.token, fetchDashboardData]);

  // Initial data load
  useEffect(() => {
    if (resolvedParams?.token) {
      fetchDashboardData(resolvedParams.token);
    }
  }, [resolvedParams?.token, fetchDashboardData]);

  // Loading state
  if (pageState.isLoading || !resolvedParams) {
    return (
      <Layout>
        <section className="py-16 px-6 min-h-screen">
          <div className="max-w-6xl mx-auto ">
            <Card>
              <CardBody className="p-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Spinner size="lg" />
                  <h2 className="text-xl font-semibold">Loading Dashboard</h2>
                  <p className="text-default-600 text-center">
                    Please wait while we load your subscription management
                    dashboard...
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </section>
      </Layout>
    );
  }

  // Error states
  if (pageState.error) {
    return (
      <Layout>
        <section className="py-16 px-6 min-h-screen">
          <div className="max-w-4xl mx-auto pt-28">
            <Card>
              <CardBody className="p-12 ">
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto">
                    <IconExclamationCircle className="w-8 h-8 text-danger" />
                  </div>

                  <div>
                    <h1 className="text-2xl font-bold mb-2">
                      Dashboard Access Error
                    </h1>
                    <p className="text-default-600">{pageState.error}</p>
                  </div>

                  {!pageState.isValidToken ? (
                    <Alert
                      color="danger"
                      variant="flat"
                      title="Invalid Management Link"
                      description="This link may be corrupted, expired, or incorrectly formatted. Please request a new management link from the access portal."
                    />
                  ) : (
                    <Alert
                      color="warning"
                      variant="flat"
                      title="Temporary Error"
                      description="This appears to be a temporary issue. Please try refreshing the page or request a new management link."
                    />
                  )}

                  <div className="flex justify-center space-x-4">
                    {pageState.isValidToken && (
                      <Button
                        color="primary"
                        startContent={<IconRefresh className="w-4 h-4" />}
                        onClick={handleRefresh}
                      >
                        Retry Loading
                      </Button>
                    )}

                    <Button
                      color="default"
                      variant="bordered"
                      startContent={<IconHome className="w-4 h-4" />}
                      onClick={() => router.push("/manage")}
                    >
                      Request New Link
                    </Button>

                    <Button
                      color="default"
                      variant="light"
                      onClick={() => router.push("/")}
                    >
                      Go Home
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </section>
      </Layout>
    );
  }

  // Success state - render dashboard
  if (pageState.data) {
    return (
      <Layout>
        <section className="py-8 px-6 min-h-screen bg-gradient-to-br from-background to-default-50">
          <div className="max-w-6xl mx-auto">
            <ManagementDashboard
              user={pageState.data.user}
              subscriptions={pageState.data.subscriptions}
              statistics={pageState.data.statistics}
              availableOptions={pageState.data.availableOptions}
              unsubscribeToken={resolvedParams.token}
              onUpdate={handleRefresh}
            />
          </div>
        </section>
      </Layout>
    );
  }

  // Fallback (shouldn't reach here)
  return (
    <Layout>
      <section className="py-16 px-6 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardBody className="p-12">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Unexpected Error</h1>
                <p className="text-default-600 mb-6">
                  An unexpected error occurred while loading the dashboard.
                </p>
                <Button color="primary" onClick={() => router.push("/")}>
                  Return Home
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default ManageTokenPage;
