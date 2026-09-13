"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigationGuard } from "@/components/NavigationGuard";

function hrefToString(href) {
  if (typeof href === "string") return href;
  if (href && typeof href === "object") return href.pathname ?? "";
  return "";
}

/** `next/link` that defers client-side navigation to the navigation guard. */
export function GuardedLink({ href, onNavigate, ...props }) {
  const pathname = usePathname();
  const { dirty, requestNavigation } = useNavigationGuard();
  const target = hrefToString(href);

  function handleNavigate(event) {
    if (onNavigate) onNavigate(event);
    if (!dirty) return;
    if (target === pathname) return;
    event.preventDefault();
    requestNavigation(target);
  }

  return <Link href={href} onNavigate={handleNavigate} {...props} />;
}
