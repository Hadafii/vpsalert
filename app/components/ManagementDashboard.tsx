// components/ManagementDashboard.tsx
"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Switch,
  Divider,
  Alert,
  Chip,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
} from "@heroui/react";
import {
  IconServer,
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconExclamationCircle,
  IconSettings,
  IconBell,
  IconBellOff,
} from "@tabler/icons-react";
import axios from "axios";

// Types
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

interface User {
  id: number;
  email: string;
  email_verified: boolean;
  created_at: string;
}

interface Statistics {
  total: number;
  active: number;
  inactive: number;
  modelsCovered: number;
  datacentersCovered: number;
}

interface ManagementDashboardProps {
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
  unsubscribeToken: string;
  isLoading?: boolean;
  onUpdate?: () => void;
}

interface ActionState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

export default function ManagementDashboard({
  user,
  subscriptions,
  statistics,
  availableOptions,
  unsubscribeToken,
  isLoading = false,
  onUpdate,
}: ManagementDashboardProps) {
  // State management
  const [actionState, setActionState] = useState<ActionState>({
    isLoading: false,
    error: null,
    success: null,
  });

  // New subscription state
  const [newSubscription, setNewSubscription] = useState({
    model: "",
    datacenter: "",
  });

  // Modal controls
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onOpenChange: onDeleteModalChange,
  } = useDisclosure();
  const {
    isOpen: isAddModalOpen,
    onOpen: onAddModalOpen,
    onOpenChange: onAddModalChange,
  } = useDisclosure();

  // VPS model configurations
  const VPS_MODELS: Record<
    number,
    { name: string; specs: string; price: string }
  > = {
    1: {
      name: "VPS-1",
      specs: "4 vCores, 8GB RAM, 75GB SSD",
      price: "US$4.20",
    },
    2: {
      name: "VPS-2",
      specs: "6 vCores, 12GB RAM, 100GB SSD",
      price: "US$6.75",
    },
    3: {
      name: "VPS-3",
      specs: "8 vCores, 24GB RAM, 200GB SSD",
      price: "US$12.75",
    },
    4: {
      name: "VPS-4",
      specs: "12 vCores, 48GB RAM, 300GB SSD",
      price: "US$25.08",
    },
    5: {
      name: "VPS-5",
      specs: "16 vCores, 64GB RAM, 350GB SSD",
      price: "US$34.34",
    },
    6: {
      name: "VPS-6",
      specs: "24 vCores, 96GB RAM, 400GB SSD",
      price: "US$45.39",
    },
  };

  const DATACENTER_INFO: Record<
    string,
    { name: string; country: string; flag: string }
  > = {
    GRA: { name: "Gravelines", country: "France", flag: "🇫🇷" },
    SBG: { name: "Strasbourg", country: "France", flag: "🇫🇷" },
    BHS: { name: "Beauharnois", country: "Canada", flag: "🇨🇦" },
    WAW: { name: "Warsaw", country: "Poland", flag: "🇵🇱" },
    UK: { name: "London", country: "United Kingdom", flag: "🇬🇧" },
    DE: { name: "Frankfurt", country: "Germany", flag: "🇩🇪" },
    FR: { name: "Roubaix", country: "France", flag: "🇫🇷" },
  };

  // API call helper
  const makeAPICall = useCallback(
    async (operation: string, requestData: any) => {
      setActionState({ isLoading: true, error: null, success: null });

      try {
        const response = await axios.put(
          `/api/subscriptions/${unsubscribeToken}`,
          requestData
        );

        if (response.data.success) {
          setActionState({
            isLoading: false,
            error: null,
            success: `${operation} completed successfully`,
          });

          // Clear success message after 3 seconds
          setTimeout(() => {
            setActionState((prev) => ({ ...prev, success: null }));
          }, 3000);

          onUpdate?.();
          return true;
        } else {
          throw new Error(
            response.data.message || `Failed to ${operation.toLowerCase()}`
          );
        }
      } catch (error: any) {
        let errorMessage = `Failed to ${operation.toLowerCase()}. Please try again.`;

        if (error.response?.status === 429) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }

        setActionState({
          isLoading: false,
          error: errorMessage,
          success: null,
        });

        return false;
      }
    },
    [unsubscribeToken, onUpdate]
  );

  // Toggle subscription active/inactive
  const handleToggleSubscription = useCallback(
    async (subscription: UserSubscription) => {
      const operation = subscription.is_active
        ? "remove subscription"
        : "add subscription";
      const action = subscription.is_active ? "remove" : "add";

      const success = await makeAPICall(operation, {
        action,
        model: subscription.model,
        datacenter: subscription.datacenter,
      });

      return success;
    },
    [makeAPICall]
  );

  // Add new subscription
  const handleAddSubscription = useCallback(async () => {
    if (!newSubscription.model || !newSubscription.datacenter) {
      setActionState({
        isLoading: false,
        error: "Please select both model and datacenter",
        success: null,
      });
      return;
    }

    const success = await makeAPICall("add subscription", {
      action: "add",
      model: parseInt(newSubscription.model),
      datacenter: newSubscription.datacenter,
    });

    if (success) {
      setNewSubscription({ model: "", datacenter: "" });
      onAddModalChange();
    }
  }, [newSubscription, makeAPICall, onAddModalChange]);

  // Delete all subscriptions
  const handleDeleteAllSubscriptions = useCallback(async () => {
    try {
      setActionState({ isLoading: true, error: null, success: null });

      const response = await axios.delete(
        `/api/subscriptions/${unsubscribeToken}`
      );

      if (response.data.success) {
        setActionState({
          isLoading: false,
          error: null,
          success: "All subscriptions have been removed",
        });
        onUpdate?.();
        onDeleteModalChange();
      } else {
        throw new Error(
          response.data.message || "Failed to delete subscriptions"
        );
      }
    } catch (error: any) {
      setActionState({
        isLoading: false,
        error:
          error.response?.data?.message || "Failed to delete subscriptions",
        success: null,
      });
    }
  }, [unsubscribeToken, onUpdate, onDeleteModalChange]);

  // Available options for new subscriptions (exclude existing active ones)
  const availableNewOptions = useMemo(() => {
    const existingCombinations = new Set(
      subscriptions.active.map((sub) => `${sub.model}-${sub.datacenter}`)
    );

    const availableModels = availableOptions.models.filter((modelId) => {
      return availableOptions.datacenters.some(
        (datacenter) => !existingCombinations.has(`${modelId}-${datacenter}`)
      );
    });

    const availableDatacentersForModel = (modelId: string) => {
      if (!modelId) return [];
      return availableOptions.datacenters.filter(
        (datacenter) => !existingCombinations.has(`${modelId}-${datacenter}`)
      );
    };

    return { availableModels, availableDatacentersForModel };
  }, [subscriptions.active, availableOptions]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <IconSettings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Subscription Dashboard</h1>
              <p className="text-small text-default-600">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user.email_verified ? (
              <Chip
                color="success"
                size="sm"
                startContent={<IconCheck className="w-3 h-3" />}
              >
                Verified
              </Chip>
            ) : (
              <Chip
                color="warning"
                size="sm"
                startContent={<IconExclamationCircle className="w-3 h-3" />}
              >
                Unverified
              </Chip>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-success-600">
              {statistics.active}
            </div>
            <div className="text-small text-default-600">Active</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-default-600">
              {statistics.total}
            </div>
            <div className="text-small text-default-600">Total</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {statistics.modelsCovered}
            </div>
            <div className="text-small text-default-600">Models</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary-600">
              {statistics.datacentersCovered}
            </div>
            <div className="text-small text-default-600">Datacenters</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-600">
              {new Date(user.created_at).toLocaleDateString()}
            </div>
            <div className="text-small text-default-600">Member Since</div>
          </div>
        </Card>
      </div>

      {/* Status Messages */}
      {actionState.error && (
        <Alert
          color="danger"
          variant="flat"
          startContent={<IconExclamationCircle className="w-4 h-4" />}
          description={actionState.error}
          onClose={() => setActionState((prev) => ({ ...prev, error: null }))}
        />
      )}

      {actionState.success && (
        <Alert
          color="success"
          variant="flat"
          startContent={<IconCheck className="w-4 h-4" />}
          description={actionState.success}
        />
      )}

      {/* Email Verification Warning */}
      {!user.email_verified && (
        <Alert
          color="warning"
          variant="flat"
          startContent={<IconExclamationCircle className="w-4 h-4" />}
          title="Email Not Verified"
          description="Please verify your email address to receive notifications. Check your inbox for the verification link."
        />
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Subscriptions</h2>
        <div className="flex gap-2">
          <Button
            color="primary"
            startContent={<IconPlus className="w-4 h-4" />}
            onPress={onAddModalOpen}
            isDisabled={availableNewOptions.availableModels.length === 0}
          >
            Add New
          </Button>
          <Button
            color="danger"
            variant="light"
            startContent={<IconTrash className="w-4 h-4" />}
            onPress={onDeleteModalOpen}
            isDisabled={statistics.active === 0}
          >
            Delete All
          </Button>
        </div>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardBody>
          {subscriptions.all.length === 0 ? (
            <div className="text-center py-8">
              <IconBellOff className="w-12 h-12 text-default-300 mx-auto mb-4" />
              <p className="text-default-600">
                No subscriptions found. Add your first subscription to get
                started.
              </p>
            </div>
          ) : (
            <Table aria-label="Subscription management table">
              <TableHeader>
                <TableColumn>MODEL</TableColumn>
                <TableColumn>DATACENTER</TableColumn>
                <TableColumn>PRICE</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {subscriptions.all.map((subscription) => (
                  <TableRow
                    key={`${subscription.model}-${subscription.datacenter}`}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <IconServer className="w-4 h-4 text-default-500" />
                        <div>
                          <div className="font-medium">
                            {subscription.modelInfo.name}
                          </div>
                          <div className="text-tiny text-default-500">
                            {subscription.modelInfo.specs}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{subscription.datacenterInfo.flag}</span>
                        <div>
                          <div className="font-medium">
                            {subscription.datacenter}
                          </div>
                          <div className="text-tiny text-default-500">
                            {subscription.datacenterInfo.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" color="primary" variant="flat">
                        {subscription.modelInfo.price}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {subscription.is_active ? (
                        <Chip
                          size="sm"
                          color="success"
                          startContent={<IconBell className="w-3 h-3" />}
                        >
                          Active
                        </Chip>
                      ) : (
                        <Chip
                          size="sm"
                          color="default"
                          startContent={<IconBellOff className="w-3 h-3" />}
                        >
                          Inactive
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        isSelected={subscription.is_active}
                        onChange={() => handleToggleSubscription(subscription)}
                        isDisabled={actionState.isLoading}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Add Subscription Modal */}
      <Modal isOpen={isAddModalOpen} onOpenChange={onAddModalChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Add New Subscription
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Select
                    label="VPS Model"
                    placeholder="Select a VPS model"
                    selectedKeys={
                      newSubscription.model ? [newSubscription.model] : []
                    }
                    onSelectionChange={(keys) => {
                      const selectedModel =
                        Array.from(keys)[0]?.toString() || "";
                      setNewSubscription((prev) => ({
                        ...prev,
                        model: selectedModel,
                        datacenter: "",
                      }));
                    }}
                  >
                    {availableNewOptions.availableModels.map((modelId) => (
                      <SelectItem key={modelId.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{VPS_MODELS[modelId].name}</span>
                          <span className="text-small text-default-500">
                            {VPS_MODELS[modelId].price}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Datacenter"
                    placeholder="Select a datacenter"
                    selectedKeys={
                      newSubscription.datacenter
                        ? [newSubscription.datacenter]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const selectedDatacenter =
                        Array.from(keys)[0]?.toString() || "";
                      setNewSubscription((prev) => ({
                        ...prev,
                        datacenter: selectedDatacenter,
                      }));
                    }}
                    isDisabled={!newSubscription.model}
                  >
                    {availableNewOptions
                      .availableDatacentersForModel(newSubscription.model)
                      .map((datacenter) => (
                        <SelectItem key={datacenter}>
                          <div className="flex items-center space-x-2">
                            <span>{DATACENTER_INFO[datacenter]?.flag}</span>
                            <span>
                              {datacenter} - {DATACENTER_INFO[datacenter]?.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </Select>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleAddSubscription}
                  isLoading={actionState.isLoading}
                  isDisabled={
                    !newSubscription.model || !newSubscription.datacenter
                  }
                >
                  Add Subscription
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete All Modal */}
      <Modal isOpen={isDeleteModalOpen} onOpenChange={onDeleteModalChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Delete All Subscriptions
              </ModalHeader>
              <ModalBody>
                <Alert
                  color="danger"
                  variant="flat"
                  startContent={<IconExclamationCircle className="w-4 h-4" />}
                  title="This action cannot be undone"
                  description={`This will permanently delete all ${statistics.active} active subscriptions. You will stop receiving notifications immediately.`}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={handleDeleteAllSubscriptions}
                  isLoading={actionState.isLoading}
                >
                  Delete All Subscriptions
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
