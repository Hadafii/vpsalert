// components/SubscriptionForm.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Checkbox,
  CheckboxGroup,
  Divider,
  Alert,
  Chip,
  Progress,
} from "@heroui/react";
import {
  IconMail,
  IconServer,
  IconCheck,
  IconExclamationCircle,
  IconInfoCircle,
  IconBell,
} from "@tabler/icons-react";
import axios from "axios";

// Types
interface VPSModel {
  id: number;
  name: string;
  specs: string;
  price: string;
}

interface DatacenterInfo {
  code: string;
  name: string;
  country: string;
  flag: string;
}

interface SubscriptionFormProps {
  vpsModels?: VPSModel[];
  datacenters?: DatacenterInfo[];
  className?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface FormState {
  email: string;
  selectedModels: string[];
  selectedDatacenters: string[];
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  emailSent: boolean;
}

// Default data based on existing system
const DEFAULT_VPS_MODELS: VPSModel[] = [
  {
    id: 1,
    name: "VPS-1",
    specs: "4 vCores, 8GB RAM, 75GB SSD",
    price: "US$4.20",
  },
  {
    id: 2,
    name: "VPS-2",
    specs: "6 vCores, 12GB RAM, 100GB SSD",
    price: "US$6.75",
  },
  {
    id: 3,
    name: "VPS-3",
    specs: "8 vCores, 24GB RAM, 200GB SSD",
    price: "US$12.75",
  },
  {
    id: 4,
    name: "VPS-4",
    specs: "12 vCores, 48GB RAM, 300GB SSD",
    price: "US$25.08",
  },
  {
    id: 5,
    name: "VPS-5",
    specs: "16 vCores, 64GB RAM, 350GB SSD",
    price: "US$34.34",
  },
  {
    id: 6,
    name: "VPS-6",
    specs: "24 vCores, 96GB RAM, 400GB SSD",
    price: "US$45.39",
  },
];

const DEFAULT_DATACENTERS: DatacenterInfo[] = [
  { code: "GRA", name: "Gravelines", country: "France", flag: "🇫🇷" },
  { code: "SBG", name: "Strasbourg", country: "France", flag: "🇫🇷" },
  { code: "BHS", name: "Beauharnois", country: "Canada", flag: "🇨🇦" },
  { code: "WAW", name: "Warsaw", country: "Poland", flag: "🇵🇱" },
  { code: "UK", name: "London", country: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "Roubaix", country: "France", flag: "🇫🇷" },
  // NEW: Add Singapore and Sydney
  { code: "SGP", name: "Singapore", country: "Singapore", flag: "🇸🇬" },
  { code: "SYD", name: "Sydney", country: "Australia", flag: "🇦🇺" },
];

export default function SubscriptionForm({
  vpsModels = DEFAULT_VPS_MODELS,
  datacenters = DEFAULT_DATACENTERS,
  className = "",
  onSuccess,
  onError,
}: SubscriptionFormProps) {
  // Form state
  const [formState, setFormState] = useState<FormState>({
    email: "",
    selectedModels: [],
    selectedDatacenters: [],
    isLoading: false,
    isSuccess: false,
    error: null,
    emailSent: false,
  });

  // Email validation
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 320;
  }, []);

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      isValidEmail(formState.email.trim()) &&
      formState.selectedModels.length > 0 &&
      formState.selectedDatacenters.length > 0
    );
  }, [
    formState.email,
    formState.selectedModels,
    formState.selectedDatacenters,
    isValidEmail,
  ]);

  // Calculate total subscriptions
  const totalSubscriptions = useMemo(() => {
    return (
      formState.selectedModels.length * formState.selectedDatacenters.length
    );
  }, [formState.selectedModels, formState.selectedDatacenters]);

  // Handle email change
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        email: e.target.value,
        error: prev.error ? null : prev.error, // Clear error when user types
      }));
    },
    []
  );

  // Handle model selection
  const handleModelChange = useCallback((selectedModels: string[]) => {
    setFormState((prev) => ({
      ...prev,
      selectedModels,
    }));
  }, []);

  // Handle datacenter selection
  const handleDatacenterChange = useCallback(
    (selectedDatacenters: string[]) => {
      setFormState((prev) => ({
        ...prev,
        selectedDatacenters,
      }));
    },
    []
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isFormValid) return;

      setFormState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Prepare subscription data
        const subscriptions = formState.selectedModels.flatMap((modelId) =>
          formState.selectedDatacenters.map((datacenter) => ({
            model: parseInt(modelId),
            datacenter: datacenter,
          }))
        );

        const requestData = {
          email: formState.email.trim().toLowerCase(),
          subscriptions,
        };

        const response = await axios.post("/api/subscriptions", requestData);

        if (response.data.success) {
          setFormState((prev) => ({
            ...prev,
            isLoading: false,
            isSuccess: true,
            emailSent: response.data.data.verification_email_sent,
          }));

          onSuccess?.(response.data);
        } else {
          throw new Error(
            response.data.message || "Failed to create subscriptions"
          );
        }
      } catch (error: any) {
        let errorMessage = "Failed to create subscriptions. Please try again.";

        if (error.response?.status === 429) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (error.response?.status === 400) {
          errorMessage =
            error.response.data?.message || "Invalid subscription data.";
        }

        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        onError?.(errorMessage);
      }
    },
    [
      formState.email,
      formState.selectedModels,
      formState.selectedDatacenters,
      isFormValid,
      onSuccess,
      onError,
    ]
  );

  // Reset form
  const handleReset = useCallback(() => {
    setFormState({
      email: "",
      selectedModels: [],
      selectedDatacenters: [],
      isLoading: false,
      isSuccess: false,
      error: null,
      emailSent: false,
    });
  }, []);

  // Render VPS model selection
  const renderVPSModels = useMemo(
    () => (
      <CheckboxGroup
        label="Select VPS Models to Monitor"
        description="Choose which VPS configurations you want to be notified about"
        value={formState.selectedModels}
        onValueChange={handleModelChange}
        classNames={{
          base: "w-full",
        }}
      >
        {vpsModels.map((model) => (
          <Checkbox
            key={model.id}
            value={model.id.toString()}
            classNames={{
              base: "inline-flex w-full max-w-full my-0 bg-content1 hover:bg-content2 items-center justify-start cursor-pointer rounded-lg gap-2 p-4 border-2 border-transparent data-[selected=true]:border-primary",
              label: "w-full",
            }}
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-3">
                <IconServer className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-semibold">{model.name}</div>
                  <div className="text-small text-default-600">
                    {model.specs}
                  </div>
                </div>
              </div>
              <Chip size="sm" color="primary" variant="flat">
                {model.price}
              </Chip>
            </div>
          </Checkbox>
        ))}
      </CheckboxGroup>
    ),
    [vpsModels, formState.selectedModels, handleModelChange]
  );

  // Render datacenter selection
  const renderDatacenters = useMemo(
    () => (
      <CheckboxGroup
        label="Select Datacenters"
        description="Choose which geographic locations you want to monitor"
        value={formState.selectedDatacenters}
        onValueChange={handleDatacenterChange}
        orientation="horizontal"
        classNames={{
          wrapper: "gap-2",
        }}
      >
        {datacenters.map((dc) => (
          <Checkbox
            key={dc.code}
            value={dc.code}
            classNames={{
              base: "inline-flex m-0 bg-content1 hover:bg-content2 items-center justify-start cursor-pointer rounded-lg gap-2 p-3 border-2 border-transparent data-[selected=true]:border-primary",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{dc.flag}</span>
              <div>
                <div className="font-medium text-small">{dc.code}</div>
                <div className="text-tiny text-default-600">{dc.name}</div>
              </div>
            </div>
          </Checkbox>
        ))}
      </CheckboxGroup>
    ),
    [datacenters, formState.selectedDatacenters, handleDatacenterChange]
  );

  return (
    <Card className={`w-full max-w-4xl mx-auto shadow-lg ${className}`}>
      <CardHeader className="flex flex-col space-y-1 pb-2">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10">
          <IconBell className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-center">
          Subscribe to VPS Alerts
        </h2>
        <p className="text-default-600 text-center max-w-2xl">
          Get instant notifications when your preferred OVH VPS configurations
          become available. We monitor stock every 30 seconds across all
          datacenters.
        </p>
      </CardHeader>

      <Divider />

      <CardBody className="space-y-6">
        {/* Success State */}
        {formState.isSuccess && (
          <div className="space-y-4">
            <Alert
              color="success"
              variant="flat"
              startContent={<IconCheck className="w-5 h-5" />}
              title="Subscriptions Created Successfully!"
              description={
                formState.emailSent
                  ? "Check your email to verify your address and activate notifications."
                  : "Your subscriptions are now active and you'll receive notifications immediately."
              }
            />

            <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2">What happens next:</h4>
              <ul className="text-small space-y-1 text-success-700 dark:text-success-300">
                <li>
                  • {totalSubscriptions} subscription combinations created
                </li>
                <li>• Real-time monitoring every 30 seconds</li>
                <li>• Instant email alerts when VPS becomes available</li>
                {formState.emailSent && (
                  <li>• Please verify your email to activate notifications</li>
                )}
              </ul>
            </div>

            <div className="text-center">
              <Button color="primary" variant="light" onClick={handleReset}>
                Create New Subscription
              </Button>
            </div>
          </div>
        )}

        {/* Form State */}
        {!formState.isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {formState.error && (
              <Alert
                color="danger"
                variant="flat"
                startContent={<IconExclamationCircle className="w-5 h-5" />}
                title="Subscription Failed"
                description={formState.error}
              />
            )}

            {/* Email Input */}
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter your email for notifications"
              value={formState.email}
              onChange={handleEmailChange}
              isRequired
              isDisabled={formState.isLoading}
              color={formState.error ? "danger" : "default"}
              startContent={<IconMail className="w-4 h-4 text-default-400" />}
              description="We'll send you instant notifications when VPS becomes available"
              classNames={{
                input: "text-small",
                inputWrapper: "h-12",
              }}
            />

            {/* VPS Models Selection */}
            <div className="space-y-2">{renderVPSModels}</div>

            {/* Datacenters Selection */}
            <div className="space-y-2">{renderDatacenters}</div>

            {/* Subscription Summary */}
            {totalSubscriptions > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-primary">
                    Subscription Summary
                  </h4>
                  <Chip color="primary" size="sm">
                    {totalSubscriptions} combinations
                  </Chip>
                </div>
                <p className="text-small text-primary-700 dark:text-primary-300">
                  You'll receive notifications for{" "}
                  {formState.selectedModels.length} VPS models across{" "}
                  {formState.selectedDatacenters.length} datacenters ={" "}
                  {totalSubscriptions} total alert combinations.
                </p>
                <Progress
                  value={Math.min((totalSubscriptions / 42) * 100, 100)}
                  color="primary"
                  size="sm"
                  className="mt-2"
                />
              </div>
            )}

            {/* Info */}
            <Alert
              color="primary"
              variant="flat"
              startContent={<IconInfoCircle className="w-4 h-4" />}
              description="You can modify or cancel your subscriptions anytime using the management link we'll send to your email."
            />

            {/* Submit Button */}
            <Button
              type="submit"
              color="primary"
              size="lg"
              className="w-full font-semibold"
              isLoading={formState.isLoading}
              isDisabled={!isFormValid}
              startContent={
                !formState.isLoading && <IconCheck className="w-4 h-4" />
              }
            >
              {formState.isLoading
                ? "Creating Subscriptions..."
                : `Subscribe to ${totalSubscriptions} Alert${totalSubscriptions !== 1 ? "s" : ""}`}
            </Button>
          </form>
        )}
      </CardBody>

      <CardFooter className="pt-0">
        <div className="w-full text-center">
          <p className="text-tiny text-default-500">
            By subscribing, you agree to receive email notifications about VPS
            availability. You can unsubscribe at any time.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
