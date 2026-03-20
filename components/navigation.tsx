"use client";

import {
  AppBarDropdownMenu,
  AppBarMenuItem,
  NavbarWithOverflow,
  useMobileMenu,
} from "@gearbox-protocol/permissionless-ui";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { id: "multisig", path: "/", label: "Multisig" },
  { id: "emergency", path: "/emergency", label: "Emergency" },
] as const;

function getActivePath(pathname: string) {
  if (pathname?.startsWith("/emergency")) return "/emergency";
  return "/";
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = getActivePath(pathname ?? "");

  const items = NAV_ITEMS.map(({ id, path, label }) => ({
    id,
    label,
    active: activePath === path,
    onClick: () => router.push(path),
  }));

  return <NavbarWithOverflow items={items} moreLabel="More" />;
}

export function NavigationMobile() {
  const router = useRouter();
  const { closeMobileMenu } = useMobileMenu();

  const handleNavigate = (path: string) => {
    router.push(path);
    closeMobileMenu();
  };

  return (
    <AppBarDropdownMenu className="mt-0 min-w-0 w-full shadow-none bg-transparent p-0">
      <AppBarMenuItem onClick={() => handleNavigate("/")}>
        Multisig
      </AppBarMenuItem>
      <AppBarMenuItem onClick={() => handleNavigate("/emergency")}>
        Emergency
      </AppBarMenuItem>
    </AppBarDropdownMenu>
  );
}
