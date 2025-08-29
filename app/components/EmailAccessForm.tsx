// components/EmailAccessForm.tsx
"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Input,
  Button,
  Divider,
  Alert,
} from "@heroui/react";
import {
  IconMail,
  IconSend,
  IconCheck,
  IconExclamationCircle,
  IconClock,
} from "@tabler/icons-react";
import axios from "axios";

// Types
interface EmailAccessFormProps {
  title?: string;
  subtitle?: string;
  placeholder?: string;
  className?: string;
}

interface RequestState {
  isLoading: boolean;
  success: boolean;
  error: string | null;
  emailSent: boolean;
  lastRequestTime: number | null;
}

export default function EmailAccessForm({
  title = "Access Your Subscription Dashboard",
  subtitle = "Enter your email address and we'll send you a secure link to manage your VPS notifications.",
  placeholder = "Enter your email address",
  className = "",
}) {
  // State management
  const [email, setEmail] = useState("");
  const [requestState, setRequestState] = useState<RequestState>({
    isLoading: false,
    success: false,
    error: null,
    emailSent: false,
    lastRequestTime: null,
  });

  // Email validation
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 320;
  }, []);

  // Rate limiting check (client-side)
  const canSendRequest = useCallback((): boolean => {
    if (!requestState.lastRequestTime) return true;
    const timeDiff = Date.now() - requestState.lastRequestTime;
    const oneHour = 60 * 60 * 1000;
    return timeDiff > oneHour;
  }, [requestState.lastRequestTime]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation
      if (!email.trim()) {
        setRequestState((prev) => ({
          ...prev,
          error: "Please enter your email address",
          success: false,
        }));
        return;
      }

      if (!isValidEmail(email.trim())) {
        setRequestState((prev) => ({
          ...prev,
          error: "Please enter a valid email address",
          success: false,
        }));
        return;
      }

      if (!canSendRequest()) {
        const timeLeft = Math.ceil(
          (60 * 60 * 1000 - (Date.now() - requestState.lastRequestTime!)) /
            (60 * 1000)
        );
        setRequestState((prev) => ({
          ...prev,
          error: `Please wait ${timeLeft} minutes before requesting another link`,
          success: false,
        }));
        return;
      }

      // Start loading
      setRequestState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        success: false,
      }));

      try {
        const response = await axios.post("/api/manage/request", {
          email: email.trim().toLowerCase(),
        });

        if (response.data.success) {
          setRequestState({
            isLoading: false,
            success: true,
            error: null,
            emailSent: true,
            lastRequestTime: Date.now(),
          });

          // Clear email for security
          setEmail("");
        } else {
          throw new Error(
            response.data.message || "Failed to send management link"
          );
        }
      } catch (error: any) {
        let errorMessage = "Failed to send management link. Please try again.";

        if (error.response?.status === 429) {
          errorMessage =
            error.response.data?.message ||
            "Too many requests. Please try again later.";
        } else if (error.response?.status === 400) {
          errorMessage =
            error.response.data?.message || "Invalid email address.";
        }

        setRequestState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          success: false,
        }));
      }
    },
    [email, isValidEmail, canSendRequest, requestState.lastRequestTime]
  );

  // Handle input change
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      // Clear error when user starts typing
      if (requestState.error) {
        setRequestState((prev) => ({ ...prev, error: null }));
      }
    },
    [requestState.error]
  );

  // Reset form
  const handleReset = useCallback(() => {
    setRequestState({
      isLoading: false,
      success: false,
      error: null,
      emailSent: false,
      lastRequestTime: requestState.lastRequestTime, // Keep rate limit tracking
    });
  }, [requestState.lastRequestTime]);

  return (
    <Card className={`w-full max-w-md mx-auto shadow-lg ${className}`}>
      <CardHeader className="flex flex-col space-y-1 pb-2">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10">
          <IconMail className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-center">{title}</h2>
        <p className="text-small text-default-600 text-center leading-relaxed">
          {subtitle}
        </p>
      </CardHeader>

      <Divider />

      <CardBody className="pt-6">
        {/* Success State */}
        {requestState.emailSent && (
          <div className="space-y-4">
            <Alert
              color="success"
              variant="flat"
              startContent={<IconCheck className="w-4 h-4" />}
              title="Management Link Sent!"
              description="Check your email inbox and spam folder for the management link."
            />

            <div className="text-center space-y-2">
              <p className="text-small text-default-600">
                Didn't receive the email?
              </p>
              <Button
                variant="light"
                color="primary"
                size="sm"
                onClick={handleReset}
              >
                Send to Different Email
              </Button>
            </div>
          </div>
        )}

        {/* Form State */}
        {!requestState.emailSent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {requestState.error && (
              <Alert
                color="danger"
                variant="flat"
                startContent={<IconExclamationCircle className="w-4 h-4" />}
                description={requestState.error}
                className="mb-4"
              />
            )}

            {/* Rate Limit Warning */}
            {requestState.lastRequestTime && !canSendRequest() && (
              <Alert
                color="warning"
                variant="flat"
                startContent={<IconClock className="w-4 h-4" />}
                title="Rate Limited"
                description="You can request a new management link once per hour to prevent abuse."
                className="mb-4"
              />
            )}

            {/* Email Input */}
            <Input
              type="email"
              label="Email Address"
              placeholder={placeholder}
              value={email}
              onChange={handleEmailChange}
              isRequired
              isDisabled={requestState.isLoading}
              color={requestState.error ? "danger" : "default"}
              startContent={<IconMail className="w-4 h-4 text-default-400" />}
              classNames={{
                input: "text-small",
                inputWrapper: "h-12",
              }}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              color="primary"
              size="lg"
              className="w-full font-medium"
              isLoading={requestState.isLoading}
              isDisabled={
                !email.trim() ||
                !isValidEmail(email.trim()) ||
                !canSendRequest()
              }
              startContent={
                !requestState.isLoading && <IconSend className="w-4 h-4" />
              }
            >
              {requestState.isLoading
                ? "Sending Link..."
                : "Send Management Link"}
            </Button>

            {/* Info Text */}
            <div className="text-center">
              <p className="text-tiny text-default-500 leading-relaxed">
                This link will be valid for future use and doesn't expire. You
                can bookmark it for easy access.
              </p>
            </div>
          </form>
        )}

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t border-divider">
          <div className="flex items-start space-x-2">
            <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center mt-0.5 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
            </div>
            <p className="text-tiny text-default-600 leading-relaxed">
              The management link is personal to your email address. Keep it
              secure and don't share it with others.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
