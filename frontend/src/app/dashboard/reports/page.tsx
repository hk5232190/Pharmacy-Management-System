"use client";

import html2canvas from "html2canvas-pro";
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
  TrendingUp, PackageSearch, FileText, FileSpreadsheet,
  AlertTriangle, Activity, PackageMinus, DollarSign
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
  const [activeMedicineTab, setActiveMedicineTab] = useState("expiry");

  useEffect(() => {
    // Don't fetch if custom is selected but no date range has been applied yet
    if (timeframe === 'custom' && !dateRange) return;

    if (activeTab === "sales") {
      fetchSalesReports();
    } else if (activeTab === "purchases") {
      fetchPurchaseReports();
    } else if (activeTab === "inventory") {
      fetchInventoryReports();
    } else if (activeTab === "medicine") {
      fetchMedicineReports();
    } else if (activeTab === "financial") {
      fetchFinancialReports();
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

  const fetchFinancialReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/financial?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load financial report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicineReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/medicine?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load medicine report");
      } else {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Error fetching reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryReports = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = `/reports/inventory?timeframe=${timeframe}`;
      if (timeframe === 'custom' && dateRange) {
        url += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const res = await apiClient.get(url);
      if (res.success === false) {
        toast.error(res.error || "Failed to load inventory report");
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
      setStartDate("");
      setEndDate("");
      setTimeframe(tf);
    }
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      setDateRange({ start: startDate, end: endDate });
    }
  };

  const exportReport = async (type: 'csv' | 'excel' | 'pdf') => {
    let endpoint = activeTab === 'sales' ? '/reports/sales/export/' + type : activeTab === 'purchases' ? '/reports/purchases/export/' + type : activeTab === 'inventory' ? '/reports/inventory/export/' + type : activeTab === 'financial' ? '/reports/financial/export/' + type : '/reports/medicine/export/' + type;
    
    let url = `http://127.0.0.1:8000/api/v1${endpoint}`;
    
    let params = `?timeframe=${timeframe}`;
    if (activeTab === 'medicine') {
      params += `&report_type=${activeMedicineTab}`;
    }
    if (timeframe === 'custom' && dateRange) {
      params += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
    }
    
    if (type === 'pdf') {
      try {
        setLoading(true);
        toast.info('Generating PDF with charts... please wait.');
        let chartImageBase64 = null;
        const chartEl = document.getElementById('report-charts');
        if (chartEl) {
          const canvas = await html2canvas(chartEl, { scale: 2 });
          chartImageBase64 = canvas.toDataURL('image/png');
        }
        
        const payload = {
          timeframe: timeframe,
          start_date: dateRange?.start,
          end_date: dateRange?.end,
          chart_image: chartImageBase64,
          report_type: activeTab === 'medicine' ? activeMedicineTab : undefined
        };
        
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + params.replace('?', ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('PDF Generation failed');
        
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${activeTab}_report_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast.success('PDF Downloaded successfully');
      } catch (err: any) {
        toast.error(err.message || 'Error generating PDF');
      } finally {
        setLoading(false);
      }
    } else {
      window.open(url + params, '_blank');
    }
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
          <Button variant="outline" onClick={() => activeTab === 'sales' ? fetchSalesReports() : activeTab === 'purchases' ? fetchPurchaseReports() : activeTab === 'inventory' ? fetchInventoryReports() : activeTab === 'financial' ? fetchFinancialReports() : fetchMedicineReports()} className="rounded-full bg-white dark:bg-card print:hidden">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex bg-white dark:bg-card rounded-full border border-border print:hidden overflow-hidden">

            <Button variant="ghost" onClick={() => exportReport('excel')} className="rounded-none border-r border-border hover:bg-emerald-50 text-emerald-700">
              Excel
            </Button>
            <Button variant="ghost" onClick={() => exportReport('pdf')} className="rounded-none border-r border-border hover:bg-rose-50 text-rose-700">
              PDF
            </Button>
            <Button variant="ghost" onClick={() => window.print()} className="rounded-none hover:bg-slate-100">
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border pb-2 overflow-x-auto print:hidden">
        <Button 
          variant={activeTab === 'sales' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => { setData(null); setActiveTab('sales'); }}
        >
          <TrendingUp className="w-4 h-4 mr-2" /> Sales Reports
        </Button>
        <Button 
          variant={activeTab === 'purchases' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => { setData(null); setActiveTab('purchases'); }}
        >
          <PackageSearch className="w-4 h-4 mr-2" /> Purchase Reports
        </Button>
        <Button 
          variant={activeTab === 'inventory' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => { setData(null); setActiveTab('inventory'); }}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Inventory Reports
        </Button>
        <Button 
          variant={activeTab === 'medicine' ? 'default' : 'ghost'} 
          className="rounded-full"
          onClick={() => { setData(null); setActiveTab('medicine'); }}
        >
          <Activity className="w-4 h-4 mr-2" /> Medicine Reports
        </Button>
        <Button 
          variant={activeTab === 'financial' ? 'default' : 'ghost'} 
          className="rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 dark:bg-amber-950/30 dark:text-amber-500"
          onClick={() => { setData(null); setActiveTab('financial'); }}
        >
          <DollarSign className="w-4 h-4 mr-2" /> Financial Reports
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border w-full justify-between print:hidden">
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
            <div className="flex items-center gap-2 ml-4 animate-in fade-in duration-200">
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">to</span>
              <input 
                type="date" 
                className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Button 
                size="sm" 
                onClick={handleApplyCustom}
                disabled={!startDate || !endDate}
                className="bg-primary text-primary-foreground"
              >
                Apply
              </Button>
              {dateRange && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  ✓ Applied
                </span>
              )}
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
                      {data?.transactions?.length > 0 ? (
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
            <div id="report-charts" className="space-y-6">
              
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

      {data && activeTab === 'inventory' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Total Cost Value</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalCostValue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</div>
            </Card>
            <Card className="p-4 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Potential Retail Value</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">₹{data?.summary?.TotalRetailValue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</div>
            </Card>
            <Card className="p-4 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">Expired/Written-Off</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.ExpiredWrittenOffValuation?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</div>
            </Card>
            <Card className="p-4 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl">
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Total Items in Stock</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.TotalItemsInStock?.toLocaleString() || '0'}</div>
            </Card>
            <Card className="p-4 border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl">
              <div className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Low/Out of Stock</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.LowStockCount || '0'} / {data?.summary?.OutOfStockCount || '0'}</div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: Data Table */}
            <div className="lg:col-span-2 space-y-6">
              
              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Current Stock Valuation</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>

                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-medium">Medicine</th>
                        <th className="px-4 py-3 font-medium">Batch</th>
                        <th className="px-4 py-3 font-medium text-right">Qty</th>
                        <th className="px-4 py-3 font-medium text-right">Cost</th>
                        <th className="px-4 py-3 font-medium text-right">Retail</th>
                        <th className="px-4 py-3 font-medium text-right">Total Cost</th>
                        <th className="px-4 py-3 font-medium text-right">Total Retail</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.stock_items && data.stock_items.length > 0 ? (
                        data.stock_items.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-foreground">{t.MedicineName}</td>
                            <td className="px-4 py-3">{t.BatchCode}</td>
                            <td className="px-4 py-3 text-right">{t.Quantity}</td>
                            <td className="px-4 py-3 text-right">₹{t.CostPrice}</td>
                            <td className="px-4 py-3 text-right">₹{t.SellingPrice}</td>
                            <td className="px-4 py-3 text-right font-medium">₹{t.TotalCostValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">₹{t.TotalRetailValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                t.Status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {t.Status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                            No stock found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {data.movement_items && (
                <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Stock Movement Details (Period)</h3>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium">Medicine</th>
                          <th className="px-4 py-3 font-medium text-right">Start Stock</th>
                          <th className="px-4 py-3 font-medium text-right text-emerald-600">Purchased</th>
                          <th className="px-4 py-3 font-medium text-right text-blue-600">Sold</th>
                          <th className="px-4 py-3 font-medium text-right text-purple-600">Adjusted</th>
                          <th className="px-4 py-3 font-medium text-right text-rose-600">Expired</th>
                          <th className="px-4 py-3 font-medium text-right">Close Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.movement_items.length > 0 ? (
                          data.movement_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-foreground">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{t.StartingStock}</td>
                              <td className="px-4 py-3 text-right text-emerald-600">+{t.PurchasedQty}</td>
                              <td className="px-4 py-3 text-right text-blue-600">-{t.SoldQty}</td>
                              <td className="px-4 py-3 text-right text-purple-600">{t.AdjustedQty > 0 ? `+${t.AdjustedQty}` : t.AdjustedQty}</td>
                              <td className="px-4 py-3 text-right text-rose-600">-{t.ExpiredQty}</td>
                              <td className="px-4 py-3 text-right font-medium">{t.ClosingStock}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              No movement found for the selected period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

            </div>

            {/* Right Column: Charts */}
            <div id="report-charts" className="space-y-6">
              
              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4">Valuation by Category</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.category_valuation || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data?.category_valuation?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {data.movement_summary && (
                <Card className="p-4 border border-border shadow-sm rounded-xl">
                  <h3 className="font-semibold mb-4">Movement Summary</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={[
                          { name: 'Purchased', value: data.movement_summary.PurchasedQty },
                          { name: 'Sold', value: data.movement_summary.SoldQty },
                          { name: 'Adjusted', value: data.movement_summary.ManualAdjustmentsQty },
                          { name: 'Expired', value: data.movement_summary.ExpiredWrittenOffQty }
                        ]} 
                        layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Quantity" radius={[0, 4, 4, 0]} barSize={20}>
                          {
                            [
                              { name: 'Purchased', value: data.movement_summary.PurchasedQty },
                              { name: 'Sold', value: data.movement_summary.SoldQty },
                              { name: 'Adjusted', value: data.movement_summary.ManualAdjustmentsQty },
                              { name: 'Expired', value: data.movement_summary.ExpiredWrittenOffQty }
                            ].map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={
                                entry.name === 'Purchased' ? '#10b981' : 
                                entry.name === 'Sold' ? '#3b82f6' : 
                                entry.name === 'Adjusted' ? '#8b5cf6' : 
                                '#f43f5e'
                              } />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

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
                      {data?.transactions?.length > 0 ? (
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
            <div id="report-charts" className="space-y-6">
              
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

      {data && activeTab === 'medicine' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">Total Expired Batches</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.TotalExpiredBatches || 0}</div>
            </Card>
            <Card className="p-4 border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl">
              <div className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Expiring Soon (90d)</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.ExpiringSoonBatches || 0}</div>
            </Card>
            <Card className="p-4 border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl">
              <div className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Low Stock Medicines</div>
              <div className="text-2xl font-bold text-foreground">{data?.summary?.LowStockMedicines || 0}</div>
            </Card>
            <Card className="p-4 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Fast Moving</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">{data?.summary?.FastMovingCount || 0}</div>
            </Card>
            <Card className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Dead Stock</div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{data?.summary?.DeadStockCount || 0}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <Button variant={activeMedicineTab === 'expiry' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveMedicineTab('expiry')}>
                    <AlertTriangle className="w-4 h-4 mr-2" /> Expiry Alerts
                  </Button>
                  <Button variant={activeMedicineTab === 'low_stock' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveMedicineTab('low_stock')}>
                    <PackageMinus className="w-4 h-4 mr-2" /> Low Stock
                  </Button>
                  <Button variant={activeMedicineTab === 'moving' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveMedicineTab('moving')}>
                    <Activity className="w-4 h-4 mr-2" /> Performance (Moving)
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </Button>

                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                  
                  {activeMedicineTab === 'expiry' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium">Medicine</th>
                          <th className="px-4 py-3 font-medium">Batch</th>
                          <th className="px-4 py-3 font-medium text-right">Qty</th>
                          <th className="px-4 py-3 font-medium">Expiry Date</th>
                          <th className="px-4 py-3 font-medium text-right">Days Left</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.expiry_items && data.expiry_items.length > 0 ? (
                          data.expiry_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-foreground">{t.MedicineName}</td>
                              <td className="px-4 py-3">{t.BatchCode}</td>
                              <td className="px-4 py-3 text-right">{t.Quantity}</td>
                              <td className="px-4 py-3">{new Date(t.ExpiryDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right font-medium">{t.DaysToExpiry}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.Status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {t.Status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No expiry alerts found.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {activeMedicineTab === 'low_stock' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium">Medicine</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium text-right text-rose-600">Current Stock</th>
                          <th className="px-4 py-3 font-medium text-right">Reorder Level</th>
                          <th className="px-4 py-3 font-medium text-right">Deficit</th>
                          <th className="px-4 py-3 font-medium text-right text-emerald-600">Suggested Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.low_stock_items && data.low_stock_items.length > 0 ? (
                          data.low_stock_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-foreground">{t.MedicineName}</td>
                              <td className="px-4 py-3">{t.Category}</td>
                              <td className="px-4 py-3 text-right font-bold text-rose-600">{t.CurrentStock}</td>
                              <td className="px-4 py-3 text-right">{t.ReorderLevel}</td>
                              <td className="px-4 py-3 text-right">{t.Deficit}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600">{t.SuggestedReorderQty}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No low stock items found.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                  {activeMedicineTab === 'moving' && (
                    <>
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-medium">Medicine</th>
                          <th className="px-4 py-3 font-medium text-right">Sold Quantity</th>
                          <th className="px-4 py-3 font-medium text-right">Velocity (Units/Day)</th>
                          <th className="px-4 py-3 font-medium text-right">Revenue</th>
                          <th className="px-4 py-3 font-medium">Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.movement_items && data.movement_items.length > 0 ? (
                          data.movement_items.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-foreground">{t.MedicineName}</td>
                              <td className="px-4 py-3 text-right font-medium">{t.SoldQuantity}</td>
                              <td className="px-4 py-3 text-right">{t.SalesVelocity}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">₹{t.Revenue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.Classification === 'Fast Moving' ? 'bg-emerald-100 text-emerald-700' : 
                                  t.Classification === 'Slow Moving' ? 'bg-amber-100 text-amber-700' : 
                                  t.Classification === 'Dead Stock' ? 'bg-slate-200 text-slate-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {t.Classification}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No movement data found for the selected period.</td></tr>
                        )}
                      </tbody>
                    </>
                  )}

                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {data && activeTab === 'financial' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Total Net Revenue</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalRevenue?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</div>
            </Card>
            <Card className="p-4 border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <div className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">Cost of Goods Sold (COGS)</div>
              <div className="text-2xl font-bold text-foreground">₹{data?.summary?.TotalCOGS?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}</div>
            </Card>
            <Card className="p-4 border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Net Profit</div>
              <div className={`text-2xl font-bold ${data?.summary?.NetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                ₹{data?.summary?.NetProfit?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}
              </div>
            </Card>
            <Card className="p-4 border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl">
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Profit Margin</div>
              <div className={`text-2xl font-bold ${data?.summary?.ProfitMargin >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                {data?.summary?.ProfitMargin?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '0'}%
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: P&L Statement */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                  <h3 className="font-semibold text-lg flex items-center">
                    <FileSpreadsheet className="w-5 h-5 mr-2 text-primary" />
                    Profit & Loss Statement
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" /> Print P&L
                    </Button>
                  </div>
                </div>
                
                <div className="p-0">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-border">
                      {/* Income Section */}
                      <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                        <td colSpan={2} className="px-6 py-3 font-semibold text-blue-700 dark:text-blue-400">Income</td>
                      </tr>
                      {data?.income_breakdown?.map((item: any, idx: number) => (
                        <tr key={`inc-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 text-muted-foreground">{item.Category}</td>
                          <td className="px-6 py-3 text-right font-medium">₹{item.Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/50">
                        <td className="px-6 py-3 font-semibold text-right">Total Net Revenue</td>
                        <td className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-500">₹{data?.summary?.TotalRevenue?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      </tr>

                      {/* Expenses Section */}
                      <tr className="bg-rose-50/30 dark:bg-rose-900/10">
                        <td colSpan={2} className="px-6 py-3 font-semibold text-rose-700 dark:text-rose-400">Expenses & Losses</td>
                      </tr>
                      {data?.expense_breakdown?.map((item: any, idx: number) => (
                        <tr key={`exp-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 text-muted-foreground">{item.Category}</td>
                          <td className="px-6 py-3 text-right font-medium text-rose-600/80 dark:text-rose-400/80">- ₹{item.Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/50">
                        <td className="px-6 py-3 font-semibold text-right">Total Expenses & Deductions</td>
                        <td className="px-6 py-3 text-right font-bold text-rose-600 dark:text-rose-500">- ₹{((data?.summary?.TotalCOGS || 0) + (data?.summary?.InventoryLoss || 0) + (data?.summary?.TotalExpenses || 0) + (data?.summary?.DiscountsApplied || 0) + (data?.summary?.SalesReturns || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      </tr>

                      {/* Net Profit Section */}
                      <tr className="bg-emerald-50/30 dark:bg-emerald-900/10 border-t border-border">
                        <td className="px-6 py-4 font-bold text-lg text-right">NET PROFIT / LOSS</td>
                        <td className={`px-6 py-4 text-right font-bold text-xl ${data?.summary?.NetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                          ₹{data?.summary?.NetProfit?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Right Column: Charts */}
            <div id="report-charts" className="space-y-6">
              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4 text-center">Net Profit Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.trend_data || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" name="Net Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border border-border shadow-sm rounded-xl">
                <h3 className="font-semibold mb-4 text-center">Revenue vs COGS vs Deductions</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Gross Profit', value: Math.max(0, data?.summary?.GrossProfit || 0) },
                          { name: 'COGS', value: data?.summary?.TotalCOGS || 0 },
                          { name: 'Inventory Loss', value: data?.summary?.InventoryLoss || 0 },
                          { name: 'Discounts & Returns', value: (data?.summary?.DiscountsApplied || 0) + (data?.summary?.SalesReturns || 0) }
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[0, 1, 2, 3].map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
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
