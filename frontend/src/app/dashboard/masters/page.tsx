"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MastersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/masters/medicines");
  }, [router]);

  return null;
}
