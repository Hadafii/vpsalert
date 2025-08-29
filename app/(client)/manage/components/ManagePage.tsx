// app/manage/page.tsx
"use client";

import React from "react";
import { Metadata } from "next";
import Layout from "@/app/layouts/MainLayout";
import EmailAccessForm from "@/app/components/EmailAccessForm";
import { Card, CardBody, Divider, Button } from "@heroui/react";
import { IconShield, IconMail, IconBolt } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Manage Subscriptions - OVH VPS Monitor",
  description:
    "Access your VPS availability subscription dashboard to manage notifications and preferences.",
  keywords: "OVH, VPS, manage subscriptions, notifications, dashboard access",
};

const ManageAccessPage = () => {
  return (
    <Layout>
      <section className="relative py-16  px-6 min-h-screen bg-gradient-to-br from-background to-default-50 transition-colors ">
        <div className="max-w-4xl mx-auto ">
          {/* Header Section */}
          <div className="text-center mb-12 pt-28">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Manage Your VPS Subscriptions
            </h1>
            <p className="text-lg text-default-600 max-w-2xl mx-auto">
              Access your subscription dashboard to view, modify, or cancel your
              VPS availability notifications.
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Access Form */}
            <div>
              <EmailAccessForm
                title="Access Dashboard"
                subtitle="Enter your email address to receive a secure link to your subscription management dashboard."
                placeholder="your.email@example.com"
              />
            </div>

            {/* Information Cards */}
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardBody className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <IconMail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Email-Based Access</h3>
                      <p className="text-small text-default-600 leading-relaxed">
                        We'll send a secure management link to your email. No
                        passwords required - just click the link to access your
                        dashboard.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="shadow-sm">
                <CardBody className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-success/10 rounded-lg flex-shrink-0">
                      <IconShield className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Secure & Private</h3>
                      <p className="text-small text-default-600 leading-relaxed">
                        Your management link is unique and personal. We use
                        industry-standard security measures to protect your
                        subscription data.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="shadow-sm">
                <CardBody className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-warning/10 rounded-lg flex-shrink-0">
                      <IconBolt className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Instant Control</h3>
                      <p className="text-small text-default-600 leading-relaxed">
                        Add new VPS models, remove unwanted notifications, or
                        view your subscription history - all from one convenient
                        dashboard.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          <Divider className="my-12" />

          {/* Features Section */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">What You Can Manage</h2>
            <p className="text-default-600 mb-8">
              Your subscription dashboard gives you complete control over your
              VPS monitoring preferences.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center p-6 hover:shadow-md transition-shadow">
              <CardBody>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl">👁️</span>
                </div>
                <h3 className="font-semibold mb-2">
                  View Active Subscriptions
                </h3>
                <p className="text-small text-default-600">
                  See all your current VPS model and datacenter monitoring
                  combinations in one place.
                </p>
              </CardBody>
            </Card>

            <Card className="text-center p-6 hover:shadow-md transition-shadow">
              <CardBody>
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl">➕</span>
                </div>
                <h3 className="font-semibold mb-2">Add New Alerts</h3>
                <p className="text-small text-default-600">
                  Expand your monitoring to include additional VPS models or
                  datacenters as needed.
                </p>
              </CardBody>
            </Card>

            <Card className="text-center p-6 hover:shadow-md transition-shadow">
              <CardBody>
                <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl">🗑️</span>
                </div>
                <h3 className="font-semibold mb-2">Remove Unwanted Alerts</h3>
                <p className="text-small text-default-600">
                  Turn off notifications for specific configurations or
                  unsubscribe completely.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Security Notice */}
          <Card className="mt-12 bg-primary/5 border border-primary/20">
            <CardBody className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <IconShield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-2">
                    Security Notice
                  </h3>
                  <p className="text-small text-primary-700 dark:text-primary-300 leading-relaxed">
                    Your management link is sent only to your registered email
                    address and provides access to modify your notification
                    preferences. If you receive unexpected emails, please verify
                    the sender and report any suspicious activity.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Alternative Actions */}
          <div className="text-center mt-8">
            <p className="text-default-600 mb-4">
              Don't have any subscriptions yet?
            </p>
            <div className="space-x-4">
              <Button as="a" href="/subscribe" color="primary" variant="shadow">
                Create New Subscription
              </Button>
              <Button as="a" href="/">
                View Live Status
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ManageAccessPage;
