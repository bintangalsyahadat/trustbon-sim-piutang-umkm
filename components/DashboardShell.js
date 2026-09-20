"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  Receipt,
  Wallet,
  Users,
  ClipboardCheck,
  UserCog,
  BarChart3,
  Menu,
  X,
  Bell,
  User,
  Building2,
  LogOut,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GuardedLink } from "@/components/GuardedLink";
import { NavigationGuardProvider } from "@/components/NavigationGuard";
import { logoutAction } from "@/app/actions/auth";

const emptySubscribe = () => () => {};

/**
 * Dashboard navigation shell.
 *
 * Owns the whole chrome below `requireActiveMember()`: the fixed desktop
 * sidebar, the sticky top bar (notification bell + account menu) and the
 * off-canvas mobile drawer. The sidebar nav is role-based: owners see the
 * full menu, cashiers the daily subset. All data is passed in from the
 * server layout as plain, serializable values. The mobile drawer and the
 * account menu are
 * keyed by the current pathname so any route navigation unmounts them and
 * resets their open state without a setState-in-effect (which the project's
 * react-hooks lint rules reject).
 */

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const CASHIER_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/dashboard/transaksi", label: "Transaksi", icon: Receipt },
  { href: "/dashboard/pembayaran", label: "Pembayaran", icon: Wallet },
];

const OWNER_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/dashboard/transaksi", label: "Transaksi", icon: Receipt },
  { href: "/dashboard/pembayaran", label: "Pembayaran", icon: Wallet },
  { href: "/dashboard/approval", label: "Approval", icon: ClipboardCheck },
  { href: "/dashboard/tim", label: "Tim", icon: UserCog },
  { href: "/dashboard/laporan", label: "Laporan", icon: BarChart3 },
];

function isActive(pathname, href) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

function CountBadge({ count, className = "" }) {
  if (!count || count < 1) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Brand mark — mirrors the identity used by the auth shell / old header. */
function Brand() {
  return (
    <GuardedLink
      href="/dashboard"
      className={`flex items-center gap-2.5 rounded-xl px-1 py-1 shrink-0 ${FOCUS_RING}`}
    >
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/25 dark:shadow-black/30">
        <ShieldCheck className="w-4.5 h-4.5 text-violet-100" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-violet-600 to-violet-500 dark:from-violet-300 dark:to-violet-400 bg-clip-text text-transparent">
          TrustBon
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
          UMKM
        </span>
      </div>
    </GuardedLink>
  );
}

function NavList({ onNavigate, isOwner }) {
  const pathname = usePathname();
  const items = isOwner ? OWNER_NAV_ITEMS : CASHIER_NAV_ITEMS;

  return (
    <nav aria-label="Navigasi dashboard" className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <GuardedLink
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${FOCUS_RING} ${
              active
                ? "bg-violet-100/80 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold"
                : "text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-white/5 hover:text-violet-700 dark:hover:text-violet-300"
            }`}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            <span>{item.label}</span>
          </GuardedLink>
        );
      })}
    </nav>
  );
}

/** Sticky two-column sidebar (desktop only). */
function Sidebar({ isOwner }) {
  return (
    <aside className="hidden lg:flex sticky top-0 h-screen shrink-0 z-40 w-64 flex-col border-r border-white/40 dark:border-white/10 bg-white/65 dark:bg-[#1a1625]/60 backdrop-blur-xl">
      <div className="h-16 flex items-center px-4 border-b border-white/40 dark:border-white/10 shrink-0">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList isOwner={isOwner} />
      </div>
    </aside>
  );
}

/**
 * Hamburger trigger + off-canvas drawer. Rendered with a pathname key so
 * navigating away closes it. Escape and the dimmed overlay also close it, and
 * background scroll is locked while it is open.
 */
function MobileNav({ isOwner }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer ${FOCUS_RING}`}
      >
        <Menu className="w-5 h-5" />
      </button>

      {mounted
        ? createPortal(
            <>
              {open ? (
                <div
                  className="lg:hidden fixed inset-0 z-40 bg-black/50"
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
              ) : null}

              <aside
                role="dialog"
                aria-modal="true"
                aria-label="Menu navigasi"
                inert={!open}
                className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-white/40 dark:border-white/10 bg-white dark:bg-[#1a1625] shadow-2xl transition-transform duration-200 ease-out ${
                  open ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <div className="h-16 flex items-center justify-between gap-2 px-3 border-b border-white/40 dark:border-white/10 shrink-0">
                  <Brand />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Tutup menu"
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer ${FOCUS_RING}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <NavList onNavigate={() => setOpen(false)} isOwner={isOwner} />
                </div>
              </aside>
            </>,
            document.body
          )
        : null}
    </>
  );
}

function NotificationBell({ unreadCount }) {
  return (
    <GuardedLink
      href="/dashboard/notifikasi"
      aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${FOCUS_RING}`}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 ? (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold bg-violet-500 text-white border-2 border-white dark:border-[#1a1625]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </GuardedLink>
  );
}

/**
 * Avatar trigger + account dropdown (Profil / Bisnis[owner] / Keluar).
 * Keyed by pathname in the top bar so route navigation closes it; also closes
 * on outside click and Escape.
 */
function AccountMenu({ userName, isOwner, pendingCount }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (userName?.trim()?.[0] ?? "?").toUpperCase();

  function handleLogout() {
    if (pending) return;
    startTransition(() => logoutAction());
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-700 dark:text-violet-300 text-sm font-bold hover:bg-violet-200 dark:hover:bg-violet-500/25 transition-colors cursor-pointer ${FOCUS_RING}`}
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Menu akun"
          className="absolute right-0 mt-2 w-56 z-50 p-1.5 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#241f33]/95 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/40 animate-fadeIn"
        >
          <GuardedLink
            href="/dashboard/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-white/5 ${FOCUS_RING}`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="flex-1">Profil</span>
          </GuardedLink>

          {isOwner ? (
            <GuardedLink
              href="/dashboard/bisnis"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-white/5 ${FOCUS_RING}`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="flex-1">Bisnis</span>
              <CountBadge
                count={pendingCount}
                className="bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25"
              />
            </GuardedLink>
          ) : null}

          <div
            role="separator"
            className="my-1 h-px bg-gray-100 dark:bg-white/10"
          />

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={pending}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
          >
            {pending ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1 text-left">
              {pending ? "Keluar…" : "Keluar"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TopBar({ pathname, userName, isOwner, pendingCount, unreadCount }) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/65 dark:bg-[#1a1625]/60 backdrop-blur-xl border-b border-white/20 dark:border-white/10 flex items-center justify-between gap-3 px-5 sm:px-8 lg:px-12 xl:px-16">
      <div className="flex items-center gap-2 min-w-0">
        <MobileNav key={pathname} isOwner={isOwner} />
        <div className="lg:hidden min-w-0">
          <Brand />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <ThemeToggle id="dashboard-theme-toggle" />
        <NotificationBell unreadCount={unreadCount} />
        <AccountMenu
          key={pathname}
          userName={userName}
          isOwner={isOwner}
          pendingCount={pendingCount}
        />
      </div>
    </header>
  );
}

export function DashboardShell({
  children,
  userName,
  isOwner,
  pendingCount,
  unreadCount,
}) {
  const pathname = usePathname();

  return (
    <NavigationGuardProvider>
      <div className="min-h-screen selection:bg-violet-500 selection:text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
          <Sidebar isOwner={isOwner} />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <TopBar
              pathname={pathname}
              userName={userName}
              isOwner={isOwner}
              pendingCount={pendingCount}
              unreadCount={unreadCount}
            />
            <main className="flex-1 px-5 sm:px-8 lg:px-12 xl:px-16 py-10 sm:py-12 lg:py-16">{children}</main>
          </div>
        </div>
      </div>
    </NavigationGuardProvider>
  );
}
