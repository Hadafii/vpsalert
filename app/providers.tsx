"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/toast";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

function DynamicThemeColorProvider() {
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    const currentTheme = theme === "system" ? systemTheme : theme;

    const themeColors = {
      light: "#EEF6FF",
      dark: "#000710",
    };

    const themeColor =
      themeColors[currentTheme as keyof typeof themeColors] || themeColors.dark;

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", themeColor);
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = themeColor;
      document.head.appendChild(meta);
    }

    const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
    existingMetas.forEach((meta) => {
      meta.setAttribute("content", themeColor);
    });
  }, [theme, systemTheme]);

  return null;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <DynamicThemeColorProvider />
        <ToastProvider />
        {children}
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
