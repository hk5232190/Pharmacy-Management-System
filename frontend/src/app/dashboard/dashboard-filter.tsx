"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface DashboardFilterProps {
  timeframe: string;
  setTimeframe: (tf: string) => void;
  dateRange: { start: string; end: string } | null;
  setDateRange: (range: { start: string; end: string } | null) => void;
}

export default function DashboardFilter({ timeframe, setTimeframe, dateRange, setDateRange }: DashboardFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

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
    if (start && end) {
      setDateRange({ start, end });
    }
  };

  const filters = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'custom', label: 'Custom Range' }
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border w-full justify-between">
      <div className="flex items-center gap-2 text-foreground font-semibold">
        <Calendar className="w-5 h-5 text-primary" />
        Global Date Filter
      </div>
      
      <div className="flex flex-wrap gap-2 items-center">
        {filters.map((f) => (
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
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <span className="text-muted-foreground">to</span>
            <input 
              type="date" 
              className="text-sm border border-border rounded-md p-1.5 bg-background text-foreground"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
            <Button size="sm" onClick={handleApplyCustom}>Apply</Button>
          </div>
        )}
      </div>
    </div>
  );
}
