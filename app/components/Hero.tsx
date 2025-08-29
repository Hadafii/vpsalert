"use client";
import React from "react";
import Prism from "@/components/ui/Prism";
import AnimatedContent from "@/components/ui/AnimatedContent";
import { Card, Button } from "@heroui/react";
import GlareHover from "@/components/ui/GlareHover";
import BlurText from "@/components/ui/BlurText";

import {
  IconBolt,
  IconShield,
  IconBell,
  IconHeartbeat,
  IconFreeRights,
} from "@tabler/icons-react";

export default function Hero() {
  const features = [
    {
      icon: <IconBolt className="w-5 h-5" />,
      title: "Real-time Monitoring",
      description: "Instant notifications when servers become available",
      delay: 0.5,
    },
    {
      icon: <IconShield className="w-5 h-5" />,
      title: "99.9% Uptime",
      description: "Enterprise-grade reliability with circuit breakers",
      delay: 0.7,
    },
    {
      icon: <IconBell className="w-5 h-5" />,
      title: "Smart Alerts",
      description: "Get notified only when it matters most",
      delay: 0.9,
    },
  ];
  return (
    <>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-60 ">
          <Prism
            animationType="3drotate"
            timeScale={0.3}
            height={2}
            baseWidth={5}
            scale={2.5}
            hueShift={0}
            colorFrequency={2}
            noise={0}
            glow={1}
          />
        </div>
        <div className="relative z-20 max-w-6xl mx-auto px-6 text-center pt-16 md:pt-12 lg:pt-0">
          <div className="flex items-center justify-center mb-6">
            <div className="border bg-white/10 dark:bg-black/10  p-1.5 w-fit border-white/20 rounded-full flex items-center font-medium hover:-translate-y-1.5 hover:scale-105 hover:shadow-blue-500/50 hover:shadow-2xl transition-all">
              <div className="bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 text-slate-800 dark:text-white font-semibold transition-colors rounded-full p-2 me-2 ">
                100%
              </div>
              Completely Free
              <IconFreeRights className="w-6 h-6 mx-2" />
            </div>
          </div>

          <BlurText
            text="Realtime Monitoring OVH VPS Availability and instant notifications"
            delay={200}
            className="text-3xl md:text-5xl font-medium text-center justify-center"
          />

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-auto pt-12">
            {features.map((feature, index) => (
              <AnimatedContent
                key={feature.title} // Pindah key ke sini
                distance={50}
                delay={feature.delay}
                className={
                  feature.title === "Smart Alerts"
                    ? "col-span-2 md:col-span-1"
                    : ""
                }
              >
                <Card
                  shadow="none"
                  className={`p-3 h-full bg-background/40 backdrop-blur-sm transition-all hover:-translate-y-1.5`}
                >
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary/30 transition-colors">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-medium ">{feature.title}</h3>
                    <p className="text-foreground/70 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              </AnimatedContent>
            ))}
          </div>

          <div className="pt-8">
            <AnimatedContent delay={1.3}>
              <GlareHover>
                <Button
                  size="lg"
                  className="p-5 px-8 bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 
              dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 text-slate-800 
              dark:text-white font-semibold transition-colors"
                  radius="full"
                  endContent={<IconHeartbeat className="w-5 h-5" />}
                >
                  Start Monitoring
                </Button>
              </GlareHover>
            </AnimatedContent>
          </div>
        </div>
      </div>
    </>
  );
}
