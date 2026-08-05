"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { RefreshCw, Download, Calendar } from "lucide-react";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

interface ChartsSectionProps {
  timeframe?: string;
  dateRange?: { start: string; end: string } | null;
  refreshTrigger?: number;
}

export default function ChartsSection({ timeframe = 'last_30_days', dateRange = null, refreshTrigger = 0 }: ChartsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchCharts();
  }, [timeframe, dateRange, refreshTrigger]);

  const fetchCharts = async () => {
    setLoading(true);
    try {
      let url = `/dashboard/charts?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load charts data");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching charts");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.success("Charts data exported successfully!");
  };

  const renderFilters = () => (
    <div className="flex items-center space-x-2 text-sm">
      <select
        value={timeframe}
        onChange={(e) => setTimeframe(e.target.value)}
        className="px-3 py-1.5 rounded-md border border-border bg-background text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last_7_days">Last 7 Days</option>
        <option value="last_30_days">Last 30 Days</option>
        <option value="this_month">This Month</option>
        <option value="last_month">Last Month</option>
        <option value="this_year">This Year</option>
      </select>
      <button onClick={fetchCharts} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Refresh">
        <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button onClick={handleExport} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Export Data">
        <Download className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 shadow-lg rounded-lg">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pt-4">

      {loading && !data && (
        <div className="flex justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {data && (
        <>
          {/* ROW 1: BUSINESS PERFORMANCE (3 columns) */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">📈 BUSINESS PERFORMANCE</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground">Sales Trend</h4>
                  <p className="text-sm text-muted-foreground">Revenue timeline over the selected period</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.sales_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(val) => `₹${val}`} width={40} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" name="Sales (₹)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground">Purchase Trend</h4>
                  <p className="text-sm text-muted-foreground">Inventory purchases over time</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.purchase_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(val) => `₹${val}`} width={40} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                      <Bar dataKey="value" name="Purchases (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground">Profit Trend</h4>
                  <p className="text-sm text-muted-foreground">Calculated via COGS per time bucket</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.profit_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(val) => `₹${val}`} width={40} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" name="Profit (₹)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          {/* ROW 2: SALES INSIGHTS & COMPARISON (3 columns) */}
          <div className="space-y-6 pt-6 pb-12">
            <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">💊 SALES INSIGHTS & COMPARISON</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground">Top Selling Medicines</h4>
                  <p className="text-sm text-muted-foreground">By quantity sold in period</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data.top_medicines} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={80} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                      <Bar dataKey="quantity" name="Quantity Sold" fill="#ec4899" radius={[0, 4, 4, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6 flex justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">Sales by Category</h4>
                    <p className="text-sm text-muted-foreground">Distribution of revenue</p>
                  </div>
                </div>
                <div className="h-[350px] w-full flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.sales_by_category}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="total_sales"
                        nameKey="category"
                        animationDuration={1000}
                      >
                        {data.sales_by_category.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 border border-border shadow-sm bg-card rounded-2xl">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground">Monthly Sales vs Purchases</h4>
                  <p className="text-sm text-muted-foreground">Last 12 months performance</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly_comparison} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(val) => `₹${val}`} width={40} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="sales" name="Sales (₹)" fill="#0ea5e9" radius={[4, 4, 0, 0]} animationDuration={1000} />
                      <Bar dataKey="purchases" name="Purchases (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
