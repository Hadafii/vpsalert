// components/Footer.tsx
"use client";

import React from "react";
import { Link, Divider, Chip } from "@heroui/react";
import {
  IconBrandGithub,
  IconMail,
  IconServer,
  IconShield,
  IconBolt,
  IconHeart,
} from "@tabler/icons-react";

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = "" }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`bg-content1/50 backdrop-blur-sm border-t border-divider ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <IconServer className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                VPS Alert
              </span>
            </div>
            <p className="text-small text-default-600 leading-relaxed">
              Real-time monitoring for OVH VPS availability across all
              datacenters. Get instant notifications when your desired
              configurations become available.
            </p>
            <div className="flex items-center space-x-2">
              <Chip size="sm" color="success" variant="flat">
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
                  <span className="text-xs">Live Monitoring</span>
                </div>
              </Chip>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-small font-semibold text-default-700 uppercase tracking-wide">
              Quick Links
            </h3>
            <nav className="space-y-3">
              <Link
                href="/"
                className="block text-small text-default-600 hover:text-primary transition-colors"
                underline="hover"
              >
                Live Status Dashboard
              </Link>
              <Link
                href="/subscribe"
                className="block text-small text-default-600 hover:text-primary transition-colors"
                underline="hover"
              >
                Subscribe to Alerts
              </Link>
              <Link
                href="/manage"
                className="block text-small text-default-600 hover:text-primary transition-colors"
                underline="hover"
              >
                Manage Subscriptions
              </Link>
            </nav>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-small font-semibold text-default-700 uppercase tracking-wide">
              Features
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <IconBolt className="w-3.5 h-3.5 text-warning-500" />
                <span className="text-small text-default-600">
                  30-second monitoring
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <IconShield className="w-3.5 h-3.5 text-success-500" />
                <span className="text-small text-default-600">
                  Reliable notifications
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <IconServer className="w-3.5 h-3.5 text-primary-500" />
                <span className="text-small text-default-600">
                  All VPS models
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <IconMail className="w-3.5 h-3.5 text-secondary-500" />
                <span className="text-small text-default-600">
                  Instant email alerts
                </span>
              </div>
            </div>
          </div>

          {/* VPS Models */}
          <div className="space-y-4">
            <h3 className="text-small font-semibold text-default-700 uppercase tracking-wide">
              Monitored Models
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }, (_, i) => i + 1).map((model) => (
                <Chip
                  key={model}
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="text-xs"
                >
                  VPS-{model}
                </Chip>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-tiny text-default-500">Datacenters:</p>
              <div className="flex flex-wrap gap-1">
                {["GRA", "SBG", "BHS", "WAW", "UK", "DE", "FR"].map((dc) => (
                  <span
                    key={dc}
                    className="text-tiny text-default-600 bg-default-100 px-1.5 py-0.5 rounded"
                  >
                    {dc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Divider className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="flex items-center space-x-4">
            <p className="text-small text-default-500">
              © {currentYear} VPS Alert. Made with{" "}
              <IconHeart className="inline w-3.5 h-3.5 text-danger-500 mx-1" />{" "}
              for the community.
            </p>
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-4">
            <Link
              href="https://github.com/yourusername/vps-alert"
              isExternal
              className="text-default-500 hover:text-default-700 transition-colors"
            >
              <IconBrandGithub className="w-5 h-5" />
            </Link>
            <Link
              href="mailto:support@vpsalert.online"
              className="text-default-500 hover:text-default-700 transition-colors"
            >
              <IconMail className="w-5 h-5" />
            </Link>
            <div className="h-4 w-px bg-divider"></div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-tiny text-success">
                All systems operational
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Notice */}
        <div className="mt-6 pt-4 border-t border-divider/50">
          <p className="text-center text-tiny text-default-400 leading-relaxed">
            This service is not affiliated with OVH. We monitor publicly
            available data to provide notifications about VPS availability.
            Always verify availability on OVH's official website before making
            purchase decisions.
          </p>
        </div>
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/5 to-transparent pointer-events-none" />
    </footer>
  );
};

export default React.memo(Footer);
