"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export type BillingSubscription = null | {
  status: string;
  monthlyMessageLimit: number;
  usedMessages: number;
  extraMessageCredits: number;
  planName?: string;
  currentPeriodEnd?: string;
};

export type BillingCatalog = {
  plans: any[];
  packs: any[];
  subscription: BillingSubscription;
};

type BillingContextType = {
  subscription: BillingSubscription;
  catalog: BillingCatalog | null;
  refreshBilling: () => Promise<void>;
  isLoading: boolean;
};

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children, initialData }: { children: React.ReactNode; initialData: BillingCatalog }) {
  const [catalog, setCatalog] = useState<BillingCatalog>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setCatalog(initialData);
  }, [initialData]);

  const refreshBilling = async () => {
    setIsLoading(true);
    // Triggering Next.js to re-fetch the server layout which updates initialData
    router.refresh();
    setIsLoading(false);
  };

  return (
    <BillingContext.Provider value={{ subscription: catalog?.subscription || null, catalog, refreshBilling, isLoading }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error("useBilling must be used within a BillingProvider");
  }
  return context;
}
