import { Card } from "@/components/ui/card";
import { LayoutDashboard, Users, Pill, ShoppingCart, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 border-0 shadow-sm bg-card text-card-foreground rounded-2xl">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Revenue</h3>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">$45,231.89</div>
          <p className="text-xs text-muted-foreground mt-1">+20.1% from last month</p>
        </Card>
        
        <Card className="p-6 border-0 shadow-sm bg-card text-card-foreground rounded-2xl">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Sales</h3>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">+2350</div>
          <p className="text-xs text-muted-foreground mt-1">+180.1% from last month</p>
        </Card>
        
        <Card className="p-6 border-0 shadow-sm bg-card text-card-foreground rounded-2xl">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Inventory Items</h3>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">12,234</div>
          <p className="text-xs text-muted-foreground mt-1">+19 new items added</p>
        </Card>
        
        <Card className="p-6 border-0 shadow-sm bg-card text-card-foreground rounded-2xl">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Active Customers</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">+573</div>
          <p className="text-xs text-muted-foreground mt-1">+201 since last hour</p>
        </Card>
      </div>
    </div>
  );
}
