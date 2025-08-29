"use client";
import {
  Navbar as HerouiNav,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Tooltip,
} from "@heroui/react";
import Image from "next/image";
import { ThemeSwitch } from "@/components/theme-switch";
import React from "react";
import GlareHover from "@/components/ui/GlareHover";
import { IconBrandGithub, IconCoffee } from "@tabler/icons-react";

export default function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [navbarHeight, setNavbarHeight] = React.useState(64);
  const [buttonSize, setButtonSize] = React.useState<"sm" | "md" | "lg">("md");
  const [isSmallScreen, setIsSmallScreen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10); // threshold scrollY
    };

    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        // lg breakpoint
        setNavbarHeight(120);
        setButtonSize("lg");
        setIsSmallScreen(false);
      } else if (width >= 768) {
        // md breakpoint
        setNavbarHeight(96);
        setButtonSize("md");
        setIsSmallScreen(false);
      } else {
        // sm and below
        setNavbarHeight(64);
        setButtonSize("md");
        setIsSmallScreen(true);
      }
    };

    // Set initial height
    handleResize();

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  return (
    <HerouiNav
      height={navbarHeight}
      maxWidth="xl"
      isBlurred={false}
      className={`fixed top-0 bg-gradient-to-b 
        dark:from-[#000710] dark:via-[#000710]/80 dark:via-30% dark:to-transparent
        from-[#EEF6FF] via-[#EEF6FF]/80 via-30% to-transparent 
        transition-colors`}
    >
      <NavbarBrand>
        <div className="hidden dark:flex">
          <Image
            alt="VPSALERT"
            height={160}
            src="/assets/logotext.svg"
            width={160}
          />
        </div>
        <div className="flex dark:hidden">
          <Image
            alt="VPSALERT"
            height={160}
            src="/assets/logotextdark.svg"
            width={160}
          />
        </div>
      </NavbarBrand>

      <NavbarContent justify="end" className="gap-1 md:gap-2">
        <ThemeSwitch />
        <NavbarItem>
          <GlareHover hoverElevation={6}>
            <Button
              as="a"
              isIconOnly={isSmallScreen}
              size={buttonSize}
              className="bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 
     dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 text-slate-800 
             dark:text-white font-semibold transition-colors"
              radius="full"
              href="https://github.com/Hadafii/vpsalert"
              target="_blank"
              endContent={
                !isSmallScreen ? (
                  <IconBrandGithub width={20} stroke={2} />
                ) : undefined
              }
            >
              {isSmallScreen ? (
                <IconBrandGithub width={20} stroke={2} />
              ) : (
                "Github Star"
              )}
            </Button>
          </GlareHover>
        </NavbarItem>
        <NavbarItem>
          <GlareHover hoverElevation={6}>
            <Tooltip
              placement="bottom"
              content="Buy me a coffee"
              showArrow
              isDisabled={isSmallScreen}
            >
              <Button
                as="a"
                isIconOnly
                size={buttonSize}
                className="bg-gradient-to-tl from-sky-200 via-blue-100 to-indigo-200 
              dark:bg-gradient-to-tl dark:from-blue-950 dark:via-slate-900 dark:to-indigo-900 text-slate-800 
              dark:text-white font-semibold transition-colors"
                radius="full"
                href="https://ko-fi.com/dafiutomo"
                target="_blank"
                startContent={<IconCoffee width={20} stroke={2} />}
              ></Button>
            </Tooltip>
          </GlareHover>
        </NavbarItem>
      </NavbarContent>
    </HerouiNav>
  );
}
