"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { 
  ShoppingCart, RefreshCw, Printer, Download, Calendar, 
  TrendingUp, PackageSearch, FileText, FileSpreadsheet 
} from "lucide-react";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Filters
  const [timeframe, setTimeframe] = useState("last_30_days");
  const [dateRange, setDateRange] = useState<{start: string, end: string} | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [activeTab, setActiveTab] = useState("sales");

  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesReports();
    } else if (activeTab === "purchases") {
      fetchPurchaseReports();
    }
  }, [timeframe, dateRange, activeTab]);

  const fetchSalesReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/sales?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load sales report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/purchases?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load purchase report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = (tf: string) => {
    if (tf === 'custom') {
      setShowCustom(true);
      setTimeframe(tf);
    } else {
      setShowCustom(false);
      setDateRange(null);
      setTimeframe(tf);
    }
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      setDateRange({ start: startDate, end: endDate });
    }
  };

  const exportCSV = () => {
    let endpoint = activeTab === 'sales' ? '/reports/sales/export/csv' : '/reports/purchases/export/csv';
    let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}${endpoint}?timeframe=${timeframe}`;
    if (timeframe === 'custom' && dateRange) {
      url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
    }
    window.open(url, '_blank');
  };

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
    <div className="flex-1 space-y-6 p-8 bg-slate-50/50 dark:bg-background min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Analyze business performance, generate reports, and identify trends.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => activeTab === 'sales' ? fetchSalesReports() : fetchPurchaseReports()} className="rounded-full bg-white dark:bg-card">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border pb-2 overflow-x-auto">
        <Button 
          variant={activeTab === 'sales' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => setActiveTab('sales')}
        >
          <TrendingUp className="w-4 h-4 mr-2" /> Sales Reports
        </Button>
        <Button 
          variant={activeTab === 'purchases' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => setActiveTab('purchases')}
        >
          <PackageSearch className="w-4 h-4 mr-2" /> Purchase Reports
        </Button>
        <Button variant="ghost" className="rounded-full opacity-50 cursor-not-allowed">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Inventory Reports
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border w-full justify-between">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Calendar className="w-5 h-5 text-primary" />
          Date Range
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last_7_days', label: 'Last 7 Days' },
            { id: 'last_30_days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom Range' }
          ].map((f) => (
            <Button
              key={f.id}
              variant={timeframe === f.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeframeChange(f.id)}
              className="rounded-full"
            >
              {f.label}
            </Button>
          ))}
          {showCustom && (
            <div className="flex items-center gap-2 ml-4">
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">to</span>
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Button size="sm" onClick={handleApplyCustom}>Apply</Button>
            </div>
          )}
        </div>
      </div>

      {loading && !data && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {data && activeTab === 'sales' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card className="p-4 border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Gross Sales</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalGrossSales?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">Returns</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalReturns?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Net Sales</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">₹{data?.summary?.NetSales?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl">
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">COGS</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalCOGS?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-xl">
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Net Profit</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">₹{data?.summary?.NetProfit?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl">
              <div className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Profit Margin</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{data?.summary?.ProfitMarginPercent?.toFixed(1) || '0.0'}%</div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: Data Table & Additional Stats */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="flex gap-4">
                 <Card className="flex-1 p-4 flex items-center justify-between border border-border shadow-sm rounded-xl">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Invoices</p>
                      <h4 className="text-2xl font-bold">{data?.summary?.TotalInvoices?.toLocaleString() || '0'}</h4>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                 </Card>
                 <Card className="flex-1 p-4 flex items-center justify-between border border-border shadow-sm rounded-xl">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Average Sale</p>
                      <h4 className="text-2xl font-bold">₹{data?.summary?.AverageSale?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</h4>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                      <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                 </Card>
                 <Card className="flex-1 p-4 flex items-center justify-between border border-border shadow-sm rounded-xl">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Highest Sale</p>
                      <h4 className="text-2xl font-bold">₹{data?.summary?.HighestSale?.toLocaleString() || '0'}</h4>
                    </div>
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                      <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                 </Card>
              </div>

              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Sales Summary</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                      <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-medium">Invoice No.</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium text-right">Items</th>
                        <th className="px-4 py-3 font-medium text-right">Qty</th>
                        <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.transactions.length > 0 ? (
                        data.transactions.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-blue-600">{t.InvoiceNo}</td>
                            <td className="px-4 py-3">{new Date(t.TransactionDate).toLocaleString()}</td>
                            <td className="px-4 py-3">{t.CustomerName}</td>
                            <td className="px-4 py-3 text-right">{t.MedicinesSold}</td>
                            <td className="px-4 py-3 text-right">{t.TotalQty}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{t.GrandTotal.toLocaleString()}</td>
                            <td className="px-4 py-3">{t.PaymentMethod}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                t.Status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {t.Status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                            No transactions found for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>

            {/* Right Column: Charts */}
            <div className="space-y-6">
              
              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Sales vs Profit Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" name="Sales" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                      <Line yAxisId="left" type="monotone" name="Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Sales by Payment Method</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.payment_methods || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data?.payment_methods?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Top 5 Best Selling Medicines</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.top_medicines || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                        {data?.top_medicines?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>

          </div>
        </div>
      )}

      {data && activeTab === 'purchases' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Gross Purchases</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalGrossPurchases?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">Returns</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalReturns?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Net Purchases</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">₹{data?.summary?.NetPurchases?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl">
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Total Invoices</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.TotalInvoices?.toLocaleString() || '0'}</div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: Data Table & Additional Stats */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="flex gap-4">
                 <Card className="flex-1 p-4 flex items-center justify-between border border-border shadow-sm rounded-xl">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Average Purchase</p>
                      <h4 className="text-2xl font-bold">₹{data?.summary?.AveragePurchase?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</h4>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                      <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                 </Card>
                 <Card className="flex-1 p-4 flex items-center justify-between border border-border shadow-sm rounded-xl">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Highest Purchase</p>
                      <h4 className="text-2xl font-bold">₹{data?.summary?.HighestPurchase?.toLocaleString() || '0'}</h4>
                    </div>
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                      <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                 </Card>
              </div>

              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Purchase Summary</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                      <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-medium">Invoice No.</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Supplier</th>
                        <th className="px-4 py-3 font-medium text-right">Items</th>
                        <th className="px-4 py-3 font-medium text-right">Qty</th>
                        <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.transactions.length > 0 ? (
                        data.transactions.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-blue-600">{t.InvoiceNo}</td>
                            <td className="px-4 py-3">{new Date(t.PurchaseDate).toLocaleString()}</td>
                            <td className="px-4 py-3">{t.SupplierName}</td>
                            <td className="px-4 py-3 text-right">{t.MedicinesPurchased}</td>
                            <td className="px-4 py-3 text-right">{t.TotalQty}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{t.GrandTotal.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                t.Status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {t.Status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            No transactions found for the selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>

            {/* Right Column: Charts */}
            <div className="space-y-6">
              
              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Purchase Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" name="Purchases" dataKey="purchases" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Purchases by Supplier</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.suppliers || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data?.suppliers?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Top 5 Purchased Medicines</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.top_medicines || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="cost" name="Cost" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                        {data?.top_medicines?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
