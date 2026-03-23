/**
 * Stable mock fixtures for analytics composites (swap for tRPC data in T03/T04).
 */

export type OrgAnalyticsDashboardData = {
  dailyTotals: {
    date: string;
    grossCents: number;
    purchaseCount: number;
    platformShareCents: number;
  }[];
  productByDay: {
    operatorProductId: string;
    productName: string;
    date: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  machineTotals: {
    machineId: string;
    label: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  entityTotals: {
    businessEntityId: string;
    name: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  monthlyFinancials: {
    monthStart: string;
    grossCents: number;
    platformShareCents: number;
    rentCents: number;
  }[];
};

export type MachineAnalyticsDashboardData = {
  dailyTotals: OrgAnalyticsDashboardData["dailyTotals"];
  productByDay: OrgAnalyticsDashboardData["productByDay"];
  /** Single-machine product distribution (same shape as org product rollups). */
  productTotals: { name: string; grossCents: number; purchaseCount: number }[];
};

export type AdminPlatformAnalyticsDashboardData = {
  dailyTotals: OrgAnalyticsDashboardData["dailyTotals"];
  topOrganizations: {
    organizationId: string;
    name: string;
    grossCents: number;
    purchaseCount: number;
  }[];
  machineTotals: OrgAnalyticsDashboardData["machineTotals"];
  totalPlatformShareCents: number;
};

export const mockOrgAnalyticsData: OrgAnalyticsDashboardData = {
  dailyTotals: [
    {
      date: "2026-03-18",
      grossCents: 120_00,
      purchaseCount: 14,
      platformShareCents: 12_00,
    },
    {
      date: "2026-03-19",
      grossCents: 95_50,
      purchaseCount: 11,
      platformShareCents: 9_55,
    },
    {
      date: "2026-03-20",
      grossCents: 210_00,
      purchaseCount: 22,
      platformShareCents: 21_00,
    },
    {
      date: "2026-03-21",
      grossCents: 88_00,
      purchaseCount: 9,
      platformShareCents: 8_80,
    },
  ],
  productByDay: [
    {
      operatorProductId: "p1",
      productName: "Slush A",
      date: "2026-03-20",
      grossCents: 120_00,
      purchaseCount: 12,
    },
    {
      operatorProductId: "p2",
      productName: "Slush B",
      date: "2026-03-20",
      grossCents: 90_00,
      purchaseCount: 10,
    },
    {
      operatorProductId: "p1",
      productName: "Slush A",
      date: "2026-03-21",
      grossCents: 55_00,
      purchaseCount: 6,
    },
    {
      operatorProductId: "p2",
      productName: "Slush B",
      date: "2026-03-21",
      grossCents: 33_00,
      purchaseCount: 3,
    },
  ],
  machineTotals: [
    {
      machineId: "m1",
      label: "Lobby North",
      grossCents: 280_00,
      purchaseCount: 28,
    },
    {
      machineId: "m2",
      label: "Courtyard",
      grossCents: 190_00,
      purchaseCount: 19,
    },
    {
      machineId: "m3",
      label: "m3",
      grossCents: 43_50,
      purchaseCount: 5,
    },
  ],
  entityTotals: [
    {
      businessEntityId: "e1",
      name: "Main entity",
      grossCents: 400_00,
      purchaseCount: 40,
    },
    {
      businessEntityId: "e2",
      name: "Pop-up",
      grossCents: 113_50,
      purchaseCount: 12,
    },
  ],
  monthlyFinancials: [
    {
      monthStart: "2026-02-01",
      grossCents: 12_000_00,
      platformShareCents: 1_200_00,
      rentCents: 300_00,
    },
    {
      monthStart: "2026-03-01",
      grossCents: 8_500_00,
      platformShareCents: 850_00,
      rentCents: 300_00,
    },
  ],
};

export const mockMachineAnalyticsData: MachineAnalyticsDashboardData = {
  dailyTotals: mockOrgAnalyticsData.dailyTotals,
  productByDay: mockOrgAnalyticsData.productByDay.filter(
    (r) => r.date >= "2026-03-20",
  ),
  productTotals: [
    { name: "Slush A", grossCents: 175_00, purchaseCount: 18 },
    { name: "Slush B", grossCents: 123_00, purchaseCount: 13 },
    { name: "Slush C", grossCents: 42_00, purchaseCount: 4 },
  ],
};

export const mockAdminPlatformAnalyticsData: AdminPlatformAnalyticsDashboardData =
  {
    dailyTotals: mockOrgAnalyticsData.dailyTotals.map((d) => ({
      ...d,
      grossCents: d.grossCents * 12,
      purchaseCount: d.purchaseCount * 10,
      platformShareCents: d.platformShareCents * 12,
    })),
    topOrganizations: [
      {
        organizationId: "o1",
        name: "Acme Vending",
        grossCents: 890_000_00,
        purchaseCount: 8900,
      },
      {
        organizationId: "o2",
        name: "City Slush Co",
        grossCents: 620_000_00,
        purchaseCount: 6100,
      },
      {
        organizationId: "o3",
        name: "North Loop",
        grossCents: 310_000_00,
        purchaseCount: 3200,
      },
    ],
    machineTotals: mockOrgAnalyticsData.machineTotals.map((m) => ({
      ...m,
      grossCents: m.grossCents * 40,
      purchaseCount: m.purchaseCount * 35,
    })),
    totalPlatformShareCents: 1_250_000_00,
  };
