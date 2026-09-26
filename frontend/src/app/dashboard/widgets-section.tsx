"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ShoppingCart, AlertTriangle, Clock, ArrowRight, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useSystemPreferences } from "@/contexts/SystemPreferencesContext";
import { format } from "date-fns";
import { cn, parseDateTime } from "@/lib/utils";

interface WidgetsSectionProps {
  timeframe?: string;
  dateRange?: { start: string; end: string } | null;
  refreshTrigger?: number;
}

export default function WidgetsSection({ timeframe = "today", dateRange = null, refreshTrigger = 0 }: WidgetsSectionProps) {
  const { formatNumber, formatCurrency } = useSystemPreferences();
  const swrKey = useMemo(() => {
    if (timeframe === "custom" && !dateRange) return null;
    let url = `/dashboard/widgets?timeframe=${timeframe}`;
    if (timeframe === "custom" && dateRange) {
      url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
    }
    return url;
  }, [timeframe, dateRange, refreshTrigger]);

  const { data, error, isLoading } = useSWR(swrKey, async (url: string) => {
    const res = await apiClient.get(url);
    if (res.success === false) {
      toast.error(res.error || "Failed to load activity widgets");
      throw new Error(res.error);
    }
    return res;
  }, { keepPreviousData: true });

  if (isLoading && !data && !error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
        <Card className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
        <Card className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
        <Card className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
      </div>
    );
  }

  if (!data) return null;

  const hasSales  = data.recent_sales.length   > 0;
  const hasStock  = data.low_stock.length       > 0;
  const hasExpiry = data.expiry_alerts.length   > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 pb-4">

      {/* Widget 1: Recent Sales */}
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[310px]">
        <div className="px-4 py-3 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            Recent Sales
          </div>
          <Link href="/dashboard/sales?tab=history" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 p-0">
          {!hasSales ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
              <p className="text-sm">No recent sales</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent_sales.map((sale: any) => (
                <li key={sale.sales_id} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-foreground truncate">{sale.invoice_no}</span>
                      {(sale.status === "Returned" || sale.status === "Fully Refunded") && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 shrink-0">RETURNED</span>
                      )}
                    </div>
                    <span className={cn("font-bold text-sm shrink-0 ml-2", (sale.status === "Returned" || sale.status === "Fully Refunded") ? "text-rose-500 line-through opacity-70" : "text-green-600 dark:text-green-500")}>
                      {formatCurrency(sale.amount)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(parseDateTime(sale.date), "dd/MM/yyyy, hh:mm a")} &bull; {sale.customer}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Widget 2: Low Stock */}
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[310px]">
        <div className="px-4 py-3 border-b border-border bg-orange-50 dark:bg-orange-950/20 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-500 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Low Stock Alerts
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {data.low_stock.length}
            </span>
            <Link href="/dashboard/inventory?tab=current&status=Low%20Stock" className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 p-0">
          {!hasStock ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
              <p className="text-sm">Stock levels are healthy</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.low_stock.map((item: any) => (
                <li key={item.medicine_id} className="px-4 py-2.5 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors group">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm text-foreground truncate">{item.name}</span>
                    <span className="font-bold text-sm text-orange-600 dark:text-orange-500 shrink-0 ml-2">{item.current_quantity} left</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      Threshold: {item.reorder_level} <span className="opacity-70">({item.threshold_source || "Global Setting"})</span>
                    </span>
                    <Link href="/dashboard/purchases/new" className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PackageSearch className="w-3 h-3" /> Create PO
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Widget 3: Expiry Alerts */}
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[310px]">
        <div className="px-4 py-3 border-b border-border bg-red-50 dark:bg-red-950/20 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-500 font-semibold text-sm">
            <Clock className="w-4 h-4" />
            Expiry Alerts
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {data.expiry_alerts.length}
            </span>
            <Link href="/dashboard/inventory?tab=expiry" className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 p-0">
          {!hasExpiry ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
              <p className="text-sm">No approaching expirations</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.expiry_alerts.map((alert: any) => {
                const isExpired = new Date(alert.expiry_date) < new Date();
                return (
                  <li key={alert.batch_id} className={`px-4 py-2.5 transition-colors group ${isExpired ? "bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm text-foreground truncate">{alert.medicine_name}</span>
                      <span className={`font-bold text-sm shrink-0 ml-2 ${isExpired ? "text-red-600 dark:text-red-500" : "text-amber-600 dark:text-amber-500"}`}>
                        Qty: {alert.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-xs text-muted-foreground">Batch: {alert.batch_number}</span>
                      <span className={`text-xs font-bold ${isExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {isExpired ? "EXPIRED" : alert.expiry_date}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

    </div>
  );
}
