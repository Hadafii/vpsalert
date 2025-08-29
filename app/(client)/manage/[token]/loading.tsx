// app/manage/[token]/loading.tsx
"use client";

import React from "react";
import Layout from "@/app/layouts/MainLayout";
import { Card, CardBody, CardHeader, Skeleton, Divider } from "@heroui/react";

const ManagementLoadingPage = () => {
  return (
    <Layout>
      <section className="py-8 px-6 min-h-screen bg-gradient-to-br from-background to-default-50">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </CardHeader>
          </Card>

          {/* Statistics Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="p-4">
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-8 mx-auto" />
                  <Skeleton className="h-4 w-12 mx-auto" />
                </div>
              </Card>
            ))}
          </div>

          {/* Actions Bar Skeleton */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-7 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          </div>

          {/* Main Content Skeleton */}
          <Card>
            <CardBody>
              {/* Table Header */}
              <div className="flex justify-between items-center mb-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-32" />
              </div>

              <Divider className="mb-4" />

              {/* Table Rows */}
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-4"
                >
                  <div className="flex items-center space-x-3">
                    <Skeleton className="w-6 h-6" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="w-4 h-4" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Loading Text */}
          <div className="text-center py-8">
            <div className="animate-pulse">
              <div className="w-2 h-2 bg-primary rounded-full inline-block mx-1 animate-bounce"></div>
              <div
                className="w-2 h-2 bg-primary rounded-full inline-block mx-1 animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-primary rounded-full inline-block mx-1 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
            <p className="text-default-600 mt-4">
              Loading your subscription dashboard...
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ManagementLoadingPage;
