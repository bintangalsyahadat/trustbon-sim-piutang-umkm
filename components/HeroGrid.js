"use client";

import { useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";

const SPACING = 32;
const BASE_RADIUS = 1.2;
const HOVER_RADIUS = 3.5;
const INFLUENCE_RADIUS = 140;
const GLOW_RADIUS = 200;

const LIGHT_DOT = "rgba(139, 92, 246, ";
const DARK_DOT = "rgba(255, 255, 255, ";
const LIGHT_GLOW = [139, 92, 246];
const DARK_GLOW = [167, 139, 250];

function getIsDark() {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
  );
}

function useDarkMode() {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", callback);
      const observer = new MutationObserver(callback);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      return () => {
        mq.removeEventListener("change", callback);
        observer.disconnect();
      };
    },
    getIsDark,
    getIsDark
  );
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

export function HeroGrid() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouseRef = useRef({ x: -9999, y: -9999 });
  const animFrameRef = useRef(null);
  const isDark = useDarkMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width, height, cols, rows;
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / SPACING) + 1;
      rows = Math.ceil(height / SPACING) + 1;
    }

    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas.parentElement);

    let mouseX = -9999;
    let mouseY = -9999;
    let smoothX = -9999;
    let smoothY = -9999;
    let isHovering = false;

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isHovering = true;
    }

    function onMouseLeave() {
      mouseX = -9999;
      mouseY = -9999;
      isHovering = false;
    }

    function onTouchMove(e) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      mouseX = touch.clientX - rect.left;
      mouseY = touch.clientY - rect.top;
      isHovering = true;
    }

    function onTouchEnd() {
      setTimeout(() => {
        mouseX = -9999;
        mouseY = -9999;
        isHovering = false;
      }, 2000);
    }

    canvas.parentElement.addEventListener("mousemove", onMouseMove);
    canvas.parentElement.addEventListener("mouseleave", onMouseLeave);
    canvas.parentElement.addEventListener("touchmove", onTouchMove, {
      passive: true,
    });
    canvas.parentElement.addEventListener("touchend", onTouchEnd);

    function draw() {
      const dark = getIsDark();
      const dotPrefix = dark ? DARK_DOT : LIGHT_DOT;
      const glowRGB = dark ? DARK_GLOW : LIGHT_GLOW;
      const baseAlpha = dark ? 0.15 : 0.3;

      smoothX = lerp(smoothX, mouseX, 0.12);
      smoothY = lerp(smoothY, mouseY, 0.12);

      ctx.clearRect(0, 0, width, height);

      if (isHovering && smoothX > 0 && smoothY > 0) {
        const gradient = ctx.createRadialGradient(
          smoothX,
          smoothY,
          0,
          smoothX,
          smoothY,
          GLOW_RADIUS
        );
        gradient.addColorStop(
          0,
          `rgba(${glowRGB[0]}, ${glowRGB[1]}, ${glowRGB[2]}, 0.08)`
        );
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(
          smoothX - GLOW_RADIUS,
          smoothY - GLOW_RADIUS,
          GLOW_RADIUS * 2,
          GLOW_RADIUS * 2
        );
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const dx = col * SPACING;
          const dy = row * SPACING;

          const distX = dx - smoothX;
          const distY = dy - smoothY;
          const dist = Math.sqrt(distX * distX + distY * distY);

          let alpha = baseAlpha;
          let r = BASE_RADIUS;

          if (dist < INFLUENCE_RADIUS && isHovering) {
            const t = 1 - dist / INFLUENCE_RADIUS;
            alpha = lerp(baseAlpha, 0.8, t * t);
            r = lerp(BASE_RADIUS, HOVER_RADIUS, t * t);
          }

          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fillStyle = dotPrefix + alpha + ")";
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      canvas.parentElement?.removeEventListener("mousemove", onMouseMove);
      canvas.parentElement?.removeEventListener("mouseleave", onMouseLeave);
      canvas.parentElement?.removeEventListener("touchmove", onTouchMove);
      canvas.parentElement?.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
