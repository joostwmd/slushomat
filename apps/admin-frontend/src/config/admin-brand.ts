const ORG_NAME = import.meta.env.VITE_ADMIN_ORG_NAME as string | undefined;
const ORG_LOGO_URL = import.meta.env.VITE_ADMIN_ORG_LOGO_URL as string | undefined;

export function getAdminOrgBrand() {
  const name = ORG_NAME?.trim() || "Slushomat";
  const logoUrl = ORG_LOGO_URL?.trim() || undefined;
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  return { name, subtitle: "Admin" as const, logoUrl, initial };
}
