import re
import os
from pathlib import Path

base_dir = Path(__file__).resolve().parent / 'src' / 'app' / 'dashboard'

# 1. reports/page.tsx: Payment -> Center
with open(base_dir / 'reports' / 'page.tsx', 'r', encoding='utf-8') as f:
    reports = f.read()
reports = reports.replace('<th className="px-4 py-3 font-medium text-left">Payment</th>', '<th className="px-4 py-3 font-medium text-center">Payment</th>')
reports = reports.replace('<td className="px-4 py-3 text-left">{t.PaymentMethod}</td>', '<td className="px-4 py-3 text-center">{t.PaymentMethod}</td>')
with open(base_dir / 'reports' / 'page.tsx', 'w', encoding='utf-8') as f:
    f.write(reports)


# 2. inventory/page.tsx: Adjusted Qty -> Center
with open(base_dir / 'inventory' / 'page.tsx', 'r', encoding='utf-8') as f:
    inv = f.read()

# Adjusted Qty header might currently be text-left (if my script forced it to left because it wasn't in the list). 
# Wait, my previous script put `text-center` for 'Qty'. 'Adjusted Qty' has 'Qty' in it!
# Wait! `\b(Qty|Quantity...)\b` matched 'Adjusted Qty'. So it should be `text-center`!
# Let's check what it actually is right now in inventory/page.tsx.

# We will just ensure all QTY related headers are centered.
inv = re.sub(r'<th className="px-4 py-3 font-semibold text-left">Adjusted Qty</th>', r'<th className="px-4 py-3 font-semibold text-center">Adjusted Qty</th>', inv)
inv = re.sub(r'<th className="px-4 py-3 font-semibold text-left">Previous Qty</th>', r'<th className="px-4 py-3 font-semibold text-center">Previous Qty</th>', inv)
inv = re.sub(r'<th className="px-4 py-3 font-semibold text-left">New Qty</th>', r'<th className="px-4 py-3 font-semibold text-center">New Qty</th>', inv)

# The cell for Adjusted Qty has `cn(...)`
# <td className={cn("px-4 py-3 text-left font-bold", adj.AdjustmentType === "Increase" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
inv = re.sub(r'px-4 py-3 text-left font-bold', 'px-4 py-3 text-center font-bold', inv)

with open(base_dir / 'inventory' / 'page.tsx', 'w', encoding='utf-8') as f:
    f.write(inv)


# 3. sales/page.tsx: Customer -> Left, Refund Mode -> Center, Balance Due -> Center
with open(base_dir / 'sales' / 'page.tsx', 'r', encoding='utf-8') as f:
    sales = f.read()
    
# Customer Name to Left
sales = sales.replace('<th className="px-3 py-3 font-semibold text-center">Customer</th>', '<th className="px-3 py-3 font-semibold text-left">Customer</th>')
sales = sales.replace('<td className="px-3 py-3 text-center font-medium text-foreground">{ret.CustomerName}</td>', '<td className="px-3 py-3 text-left font-medium text-foreground">{ret.CustomerName}</td>')
sales = sales.replace('<td className="px-3 py-3 text-center">{item.CustomerName}</td>', '<td className="px-3 py-3 text-left">{item.CustomerName}</td>')

# Refund Mode to Center
sales = sales.replace('<th className="px-3 py-3 font-semibold text-left">Refund Mode</th>', '<th className="px-3 py-3 font-semibold text-center">Refund Mode</th>')

# The Refund Mode cell has `text-left` right now?
# <td className="px-3 py-3 text-left">
#   <span className={cn(
#     "text-xs font-medium px-2 py-1 rounded-full",
# Let's regex it
sales = re.sub(
    r'<td className="px-3 py-3 text-left">(\s*<span className=\{cn\(\s*"text-xs font-medium px-2 py-1 rounded-full")', 
    r'<td className="px-3 py-3 text-center">\1', 
    sales
)

# Balance Due Header
sales = sales.replace('<th className="px-3 py-3 font-semibold text-left">Balance Due</th>', '<th className="px-3 py-3 font-semibold text-center">Balance Due</th>')

# Balance Due Cell
sales = re.sub(r'px-3 py-3 text-left font-bold", balanceDue > 0', 'px-3 py-3 text-center font-bold", balanceDue > 0', sales)

with open(base_dir / 'sales' / 'page.tsx', 'w', encoding='utf-8') as f:
    f.write(sales)

print("Done fixing specific columns.")
