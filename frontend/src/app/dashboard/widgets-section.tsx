"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ShoppingCart, AlertTriangle, Clock, ArrowRight, Printer, PackageSearch } from "lucide-react";
import Link from "next/link";

interface WidgetsSectionProps {
  timeframe?: string;
  dateRange?: { start: string; end: string } | null;
  refreshTrigger?: number;
}

export default function WidgetsSection({ timeframe = 'today', dateRange = null, refreshTrigger = 0 }: WidgetsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchWidgets();
  }, [timeframe, dateRange, refreshTrigger]);

  const fetchWidgets = async () => {
    setLoading(true);
    try {
      let url = `/dashboard/widgets?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load activity widgets");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching activity widgets");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        <Card className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
        <Card className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
        <Card className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 pb-8">
      {/* Widget 1: Recent Sales */}
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[400px]">
        <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <ShoppingCart className="w-5 h-5 text-blue-500" />
            Recent Sales
          </div>
          <Link href="/dashboard/sales" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-y-auto flex-1 p-0">
          {data.recent_sales.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No recent sales</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent_sales.map((sale: any) => (
                <li key={sale.sales_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm text-foreground">{sale.invoice_no}</span>
                    <span className="font-bold text-sm text-green-600 dark:text-green-500">₹{sale.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{sale.date} • {sale.customer}</span>
                    <button className="text-xs font-medium text-slate-500 hover:text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Printer className="w-3 h-3" /> Reprint
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Widget 2: Low Stock */}
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[400px]">
        <div className="p-4 border-b border-border bg-orange-50 dark:bg-orange-950/20 flex justify-between items-center">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-500 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            Low Stock Alerts
          </div>
          <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {data.low_stock.length}
          </span>
        </div>
        <div className="overflow-y-auto flex-1 p-0">
          {data.low_stock.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">Stock levels are healthy</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.low_stock.map((item: any) => (
                <li key={item.medicine_id} className="p-4 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm text-foreground">{item.name}</span>
                    <span className="font-bold text-sm text-orange-600 dark:text-orange-500">{item.current_quantity} left</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Reorder Level: {item.reorder_level}</span>
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
      <Card className="p-0 border border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col h-[400px]">
        <div className="p-4 border-b border-border bg-red-50 dark:bg-red-950/20 flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-500 font-semibold">
            <Clock className="w-5 h-5" />
            Expiry Alerts
          </div>
          <span className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {data.expiry_alerts.length}
          </span>
        </div>
        <div className="overflow-y-auto flex-1 p-0">
          {data.expiry_alerts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No approaching expirations</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.expiry_alerts.map((alert: any) => {
                const isExpired = new Date(alert.expiry_date) < new Date();
                return (
                  <li key={alert.batch_id} className={`p-4 transition-colors group ${isExpired ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-foreground">{alert.medicine_name}</span>
                      <span className={`font-bold text-sm ${isExpired ? 'text-red-600 dark:text-red-500' : 'text-amber-600 dark:text-amber-500'}`}>
                        Qty: {alert.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Batch: {alert.batch_number}</span>
                      <span className={`text-xs font-bold ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isExpired ? 'EXPIRED' : alert.expiry_date}
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
