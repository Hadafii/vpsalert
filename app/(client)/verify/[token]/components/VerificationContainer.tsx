"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconMail,
  IconServer,
  IconBell,
  IconExternalLink,
  IconRefresh,
  IconHome,
  IconSettings,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface VerificationContainerProps {
  token: string;
}

interface VerificationState {
  status: "loading" | "success" | "error";
  data?: VerificationResult["data"];
  error?: string;
  message?: string;
}
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

export default function VerificationContainer({
  token,
}: VerificationContainerProps) {
  const router = useRouter();
  const [verification, setVerification] = useState<VerificationState>({
    status: "loading",
  });
  const [retryCount, setRetryCount] = useState(0);

  const verifyEmail = async () => {
    try {
      setVerification({ status: "loading" });

      const response = await fetch(`/api/verify/${token}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const result: VerificationResult = await response.json();

      if (result.success && result.data) {
        setVerification({
          status: "success",
          data: result.data,
          message: result.message,
        });
      } else {
        setVerification({
          status: "error",
          error: result.error || "Verification failed",
          message: result.message,
        });
      }
    } catch (error) {
      setVerification({
        status: "error",
        error: "NETWORK_ERROR",
        message: "Failed to connect to verification service. Please try again.",
      });
    }
  };

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    verifyEmail();
  };

  const handleGoToDashboard = () => {
    router.push("/");
  };

  const handleManageSubscriptions = () => {
    router.push("/manage");
  };

  const handleSubscribeMore = () => {
    router.push("/subscribe");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-lg mx-auto"
    >
      <Card className="bg-background/90 backdrop-blur-xl shadow-2xl border border-divider/20">
        <CardHeader className="text-center pb-2">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              {verification.status === "loading" && (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconLoader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}

              {verification.status === "success" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
                >
                  <IconCheck className="w-8 h-8 text-success" />
                </motion.div>
              )}

              {verification.status === "error" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center"
                >
                  <IconX className="w-8 h-8 text-danger" />
                </motion.div>
              )}
            </motion.div>

            <div>
              <h1 className="text-2xl font-bold">
                {verification.status === "loading" && "Verifying Email..."}
                {verification.status === "success" && "Email Verified!"}
                {verification.status === "error" && "Verification Failed"}
              </h1>
              <p className="text-default-600 mt-1">
                {verification.message ||
                  "Please wait while we verify your email address."}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="py-6">
          <AnimatePresence mode="wait">
            {verification.status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <Progress
                  size="sm"
                  isIndeterminate
                  className="w-full"
                  color="primary"
                />
                <div className="text-center text-small text-default-500">
                  Processing verification token...
                </div>
              </motion.div>
            )}

            {verification.status === "success" && verification.data && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* User Info */}
                <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <IconMail className="w-5 h-5 text-success" />
                    <span className="font-medium">Verified Email</span>
                  </div>
                  <p className="text-small text-default-600 font-mono bg-default-100 p-2 rounded">
                    {verification.data.user.email}
                  </p>
                </div>

                {/* Subscription Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {verification.data.subscriptions.active}
                    </div>
                    <div className="text-small text-default-600">
                      Active Alerts
                    </div>
                  </div>
                  <div className="text-center p-4 bg-secondary/5 rounded-lg">
                    <div className="text-2xl font-bold text-secondary">
                      {verification.data.subscriptions.models.length}
                    </div>
                    <div className="text-small text-default-600">
                      VPS Models
                    </div>
                  </div>
                </div>

                {/* Monitored Models */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <IconServer className="w-4 h-4" />
                    Monitored VPS Models
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {verification.data.subscriptions.models.map((model) => (
                      <Chip
                        key={model}
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<IconServer className="w-3 h-3" />}
                      >
                        VPS-{model}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* Datacenters */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <IconBell className="w-4 h-4" />
                    Monitored Datacenters
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {verification.data.subscriptions.datacenters.map((dc) => (
                      <Chip key={dc} size="sm" color="secondary" variant="flat">
                        {dc}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-default/5 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">🚀 What's Next?</h4>
                  <ul className="space-y-2">
                    {verification.data.next_steps.map((step, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-small"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {verification.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconX className="w-4 h-4 text-danger" />
                    <span className="font-medium text-danger">
                      Error Details
                    </span>
                  </div>
                  <p className="text-small text-danger/80">
                    {verification.message}
                  </p>
                </div>

                <div className="text-small text-default-600">
                  <p className="mb-2">Common causes:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• The verification link has expired</li>
                    <li>• The link has already been used</li>
                    <li>• The token is invalid or corrupted</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardBody>

        <Divider />

        <CardFooter className="justify-center pt-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {verification.status === "success" && (
              <>
                <Button
                  color="primary"
                  startContent={<IconHome className="w-4 h-4" />}
                  onPress={handleGoToDashboard}
                  className="font-medium"
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="bordered"
                  startContent={<IconSettings className="w-4 h-4" />}
                  onPress={handleManageSubscriptions}
                >
                  Manage Alerts
                </Button>
              </>
            )}

            {verification.status === "error" && (
              <>
                <Button
                  color="primary"
                  startContent={<IconRefresh className="w-4 h-4" />}
                  onPress={handleRetry}
                  className="font-medium"
                >
                  Try Again ({retryCount + 1})
                </Button>
                <Button
                  variant="bordered"
                  startContent={<IconExternalLink className="w-4 h-4" />}
                  onPress={handleSubscribeMore}
                >
                  Subscribe Again
                </Button>
              </>
            )}

            {verification.status === "loading" && (
              <Button
                isDisabled
                startContent={<IconLoader2 className="w-4 h-4 animate-spin" />}
              >
                Verifying...
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center"
      >
        <p className="text-tiny text-default-500">
          Having trouble? Visit our{" "}
          <Button
            as="a"
            href="/"
            variant="light"
            size="sm"
            className="p-0 h-auto min-w-0 text-tiny text-primary hover:underline"
          >
            dashboard
          </Button>{" "}
          or contact support.
        </p>
      </motion.div>
    </motion.div>
  );
}
