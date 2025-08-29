"use client";
import React, { useRef, useEffect, useState } from "react";

interface GlareHoverProps {
  children?: React.ReactNode;
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
  playOnce?: boolean;
  className?: string;
  style?: React.CSSProperties;
  hoverElevation?: number;
}

const GlareHover: React.FC<GlareHoverProps> = ({
  children,
  glareColor = "#ffffff",
  glareOpacity = 0.5,
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = 650,
  playOnce = false,
  className = "",
  style = {},
  hoverElevation = 4,
}) => {
  const hex = glareColor.replace("#", "");
  let rgba = glareColor;
  if (/^[\dA-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    rgba = `rgba(${r}, ${g}, ${b}, ${glareOpacity})`;
  } else if (/^[\dA-Fa-f]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    rgba = `rgba(${r}, ${g}, ${b}, ${glareOpacity})`;
  }

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const childRef = useRef<HTMLDivElement | null>(null);
  const [childBorderRadius, setChildBorderRadius] = useState<string>("");

  useEffect(() => {
    const child = childRef.current?.firstElementChild as HTMLElement;

    if (child) {
      const computedStyle = window.getComputedStyle(child);
      setChildBorderRadius(computedStyle.borderRadius);
    }
  }, [children]);

  const animateIn = () => {
    const el = overlayRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    // Glare effect
    el.style.transition = "none";
    el.style.backgroundPosition = "-100% -100%";
    el.style.transition = `background-position ${transitionDuration}ms ease`;
    el.style.backgroundPosition = "100% 100%";

    // Hover elevation effect
    container.style.transform = `translateY(-${hoverElevation}px)`;
  };

  const animateOut = () => {
    const el = overlayRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    // Reset hover elevation
    container.style.transform = "translateY(0px)";

    if (playOnce) {
      el.style.transition = "none";
      el.style.backgroundPosition = "-100% -100%";
    } else {
      el.style.transition = `background-position ${transitionDuration}ms ease`;
      el.style.backgroundPosition = "-100% -100%";
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(${glareAngle}deg,
        transparent 60%,
        ${rgba} 70%,
        transparent 100%)`,
    backgroundSize: `${glareSize}% ${glareSize}%`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "-100% -100%",
    pointerEvents: "none",
    borderRadius: childBorderRadius || "inherit",
    overflow: "hidden",
  };

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center cursor-pointer transition-transform duration-300 ease-out  ${className}`}
      style={{
        ...style,
      }}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <div
        ref={childRef}
        className="relative"
        style={{
          borderRadius: childBorderRadius || "inherit",
          overflow: "hidden",
        }}
      >
        {children}
        <div ref={overlayRef} style={overlayStyle} />
      </div>
    </div>
  );
};

export default GlareHover;
