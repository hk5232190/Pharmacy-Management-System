"use client";

import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false, // Prevents background polling when focusing the window
        dedupingInterval: 5000, // Prevents duplicate API requests within 5 seconds
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
