"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/app/layouts/MainLayout";
import SubscriptionForm from "@/app/components/SubscriptionForm";
import { Card, CardBody, Alert, Button, Divider } from "@heroui/react";
import {
  IconBell,
  IconShield,
  IconClock,
  IconGlobe,
  IconArrowLeft,
  IconHome,
} from "@tabler/icons-react";

const SubscribePage = () => {
  const router = useRouter();
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  const handleSubscriptionSuccess = useCallback((data: any) => {
    setSubscriptionSuccess(true);
    setSubscriptionData(data);
  }, []);

  const handleSubscriptionError = useCallback((error: string) => {
    console.error("Subscription error:", error);
  }, []);

  return (
    <Layout>
      <section className="relative py-16 px-6 min-h-dvh bg-[#EEF6FF] dark:bg-[#000710] transition-colors">
        <div className="max-w-6xl mx-auto">
          {/* Navigation */}
          <div className="pt-12">
            <Button
              variant="light"
              startContent={<IconArrowLeft className="w-4 h-4" />}
              onClick={() => router.back()}
              className=""
            >
              Back
            </Button>
          </div>

          {!subscriptionSuccess ? (
            <>
              {/* Header Section */}
              <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  Subscribe to VPS Availability Alerts
                </h1>
                <p className="text-lg text-default-600 max-w-3xl mx-auto">
                  Get instant notifications when OVH VPS configurations become
                  available. Monitor multiple models across different
                  datacenters with real-time updates every 30 seconds.
                </p>
              </div>

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Subscription Form */}
                <div className="lg:col-span-2">
                  <SubscriptionForm
                    onSuccess={handleSubscriptionSuccess}
                    onError={handleSubscriptionError}
                  />
                </div>

                {/* Information Sidebar */}
                <div className="space-y-6">
                  <Card className="shadow-sm">
                    <CardBody className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                          <IconBell className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">
                            Real-time Notifications
                          </h3>
                          <p className="text-small text-default-600 leading-relaxed">
                            Receive instant email alerts the moment your
                            selected VPS configurations become available for
                            purchase.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-success/10 rounded-lg flex-shrink-0">
                          <IconClock className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">
                            30-Second Monitoring
                          </h3>
                          <p className="text-small text-default-600 leading-relaxed">
                            Our system checks OVH's availability API every 30
                            seconds to ensure you never miss an opportunity.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-warning/10 rounded-lg flex-shrink-0">
                          <IconGlobe className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">
                            Global Coverage
                          </h3>
                          <p className="text-small text-default-600 leading-relaxed">
                            Monitor VPS availability across all major OVH
                            datacenters in Europe and North America.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-secondary/10 rounded-lg flex-shrink-0">
                          <IconShield className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">
                            Easy Management
                          </h3>
                          <p className="text-small text-default-600 leading-relaxed">
                            Modify, pause, or cancel your subscriptions anytime
                            through your personal management dashboard.
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>

              <Divider className="my-12" />

              {/* How It Works Section */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-4">How It Works</h2>
                <p className="text-default-600 max-w-2xl mx-auto">
                  Our monitoring system follows a simple three-step process to
                  keep you informed about VPS availability changes.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="font-semibold mb-2">Subscribe & Verify</h3>
                  <p className="text-small text-default-600">
                    Choose your preferred VPS models and datacenters, then
                    verify your email address to activate notifications.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="font-semibold mb-2">Continuous Monitoring</h3>
                  <p className="text-small text-default-600">
                    Our system automatically checks OVH's API every 30 seconds
                    for availability changes in your selected configurations.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="font-semibold mb-2">Instant Alerts</h3>
                  <p className="text-small text-default-600">
                    Receive immediate email notifications when your desired VPS
                    becomes available, with direct links to order.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="max-w-2xl mx-auto">
              <Card className="shadow-lg">
                <CardBody className="p-8 text-center">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IconBell className="w-8 h-8 text-success" />
                  </div>

                  <h1 className="text-2xl font-bold mb-4">
                    Subscription Created Successfully
                  </h1>

                  <Alert
                    color="success"
                    variant="flat"
                    className="mb-6"
                    title="You're all set!"
                    description={
                      subscriptionData?.data?.verification_email_sent
                        ? "Please check your email and click the verification link to activate your notifications."
                        : "Your subscriptions are now active and you'll receive notifications immediately when VPS becomes available."
                    }
                  />

                  <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-6 mb-6">
                    <h3 className="font-semibold mb-3">What happens next:</h3>
                    <ul className="text-left space-y-2 text-small">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0"></div>
                        <span>
                          {subscriptionData?.data?.created?.length || 0}{" "}
                          subscription combinations are now being monitored
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0"></div>
                        <span>
                          Real-time monitoring every 30 seconds across all
                          selected configurations
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0"></div>
                        <span>
                          Instant email alerts when VPS becomes available for
                          purchase
                        </span>
                      </li>
                      {subscriptionData?.data?.verification_email_sent && (
                        <li className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-warning rounded-full mt-2 flex-shrink-0"></div>
                          <span>
                            Email verification required to receive notifications
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="space-x-4">
                      <Button
                        color="primary"
                        size="lg"
                        startContent={<IconHome className="w-4 h-4" />}
                        onClick={() => router.push("/")}
                      >
                        View Live Status
                      </Button>

                      <Button
                        color="default"
                        variant="bordered"
                        size="lg"
                        onClick={() => router.push("/manage")}
                      >
                        Manage Subscriptions
                      </Button>
                    </div>

                    <Button
                      color="default"
                      variant="light"
                      onClick={() => {
                        setSubscriptionSuccess(false);
                        setSubscriptionData(null);
                      }}
                    >
                      Create Another Subscription
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Footer */}
          {!subscriptionSuccess && (
            <div className="text-center mt-16">
              <p className="text-default-500 mb-4">
                Already have subscriptions?
              </p>
              <div className="space-x-4">
                <Button
                  color="default"
                  variant="bordered"
                  onClick={() => router.push("/manage")}
                >
                  Manage Existing Subscriptions
                </Button>
                <Button
                  color="default"
                  variant="light"
                  onClick={() => router.push("/")}
                >
                  View Current Status
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default SubscribePage;
