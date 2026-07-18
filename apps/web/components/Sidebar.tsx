"use client";

import Link from "next/link";
import { ListIcon, TrendingIcon, WalletIcon, BookIcon, ReceiptIcon, CloseIcon } from "@/components/icons";

interface NavItem {
  label: string;
  href?: string;
  icon: (props: { className?: string }) => React.ReactNode;
  soon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Fixtures", href: "/", icon: ListIcon },
  { label: "Live Markets", icon: TrendingIcon, soon: true },
  { label: "My Positions", icon: WalletIcon, soon: true },
  { label: "How It Works", icon: BookIcon, soon: true },
  { label: "Receipts", icon: ReceiptIcon, soon: true },
];

/**
 * Persistent left nav (Jupiter reference). Items without a real page yet
 * get a "Soon" tag and render as non-interactive - deliberately not dead
 * links, per the brief: makes the product read as bigger/roadmapped, not
 * broken. Only "Fixtures" links anywhere real today.
 */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <div key={item.label} className="flex items-center justify-between gap-2 px-3 py-2 opacity-40">
              <span className="flex items-center gap-2.5 font-mono text-xs text-gp-text-dim">
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
              <span className="shrink-0 border border-gp-line-strong px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-gp-text-faint uppercase">Soon</span>
            </div>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href ?? "/"}
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs text-gp-text-dim transition-colors hover:bg-gp-surface hover:text-gp-text"
          >
            <Icon className="h-4 w-4 shrink-0 text-gp-amber" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-gp-line bg-gp-bg lg:flex lg:flex-col">
      <div className="px-5 py-5">
        <Link href="/" className="font-mono text-sm font-bold tracking-[0.15em] text-gp-text uppercase">
          Goalpost
        </Link>
      </div>
      <NavList />
    </aside>
  );
}

/** Mobile drawer version, toggled by the hamburger in TopBar. */
export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-gp-line bg-gp-bg">
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" onClick={onClose} className="font-mono text-sm font-bold tracking-[0.15em] text-gp-text uppercase">
            Goalpost
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="text-gp-text-dim hover:text-gp-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <NavList onNavigate={onClose} />
      </aside>
    </div>
  );
}
