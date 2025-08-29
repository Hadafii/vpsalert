"use client";
import { motion, Transition } from "motion/react";
import { EasingFunction } from "motion-utils";
import { useEffect, useRef, useState, useMemo } from "react";

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: EasingFunction;
  onAnimationComplete?: () => void;
  stepDuration?: number;
};

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
): Record<string, Array<string | number>> => {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

const BlurText: React.FC<BlurTextProps> = ({
  text = "",
  delay = 200,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}) => {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Function to check if text contains "OVH VPS" and should be navy colored
  const isOVHVPS = (segment: string) => {
    const fullText = text.toLowerCase();
    const currentIndex = elements.indexOf(segment);

    if (animateBy === "words") {
      // Check if current word and next word form "OVH VPS"
      if (
        segment.toLowerCase() === "ovh" &&
        elements[currentIndex + 1]?.toLowerCase() === "vps"
      ) {
        return true;
      }
      if (
        segment.toLowerCase() === "vps" &&
        elements[currentIndex - 1]?.toLowerCase() === "ovh"
      ) {
        return true;
      }
    } else {
      // For letter-based animation, check if we're within "OVH VPS" sequence
      const segmentIndex = text.split("").indexOf(segment);
      const ovhVpsMatch = fullText.match(/ovh\s+vps/);
      if (ovhVpsMatch) {
        const startIndex = ovhVpsMatch.index || 0;
        const endIndex = startIndex + ovhVpsMatch[0].length;
        return segmentIndex >= startIndex && segmentIndex < endIndex;
      }
    }
    return false;
  };

  // Get the appropriate class for OVH VPS text styling
  const getOVHVPSClass = (segment: string) => {
    if (isOVHVPS(segment)) {
      return "dark:bg-gradient-to-tl dark:from-sky-200 dark:via-blue-100 dark:to-indigo-200 bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 text-slate-800 bg-clip-text text-transparent font-bold";
    }
    return "";
  };

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref.current as Element);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -50 }
        : { filter: "blur(10px)", opacity: 0, y: 50 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: "blur(5px)",
        opacity: 0.5,
        y: direction === "top" ? 5 : -5,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  );

  return (
    <p ref={ref} className={`blur-text ${className} flex flex-wrap`}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing,
        };

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
            className={getOVHVPSClass(segment)}
            style={{
              display: "inline-block",
              willChange: "transform, filter, opacity",
            }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
};

export default BlurText;
