import re

file_path = 'src/app/dashboard/sales/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'import { ReceiptPreview }' not in content:
    content = content.replace('import { toast } from "sonner";', 'import { toast } from "sonner";\nimport { ReceiptPreview } from "@/components/receipt-preview";')

# The block to replace:
# <div id="print-area" className="bg-white p-6 shadow-sm w-full max-w-[80mm] text-black font-mono text-xs mx-auto relative">
# ...
# </div>
# 
# </div>
# 
# {/* Print Buttons Footer */}

pattern = r'<div id="print-area"[\s\S]*?</div>\s*</div>\s*(?=\{\s*/\*\s*Print Buttons Footer)'
replacement = '''{printerSettings ? (
                <ReceiptPreview 
                  settings={printerSettings}
                  currency={currencySymbol}
                  isReprint={isReprintMode}
                  invoiceNumber={completedReceipt.InvoiceNumber}
                  date={completedReceipt.Date?.split('T')[0] || completedReceipt.Date}
                  time={completedReceipt.Date?.split('T')[1]?.substring(0,5) || ""}
                  customerName={completedReceipt.CustomerName || "Walk-in Customer"}
                  cashierName={completedReceipt.Cashier}
                  paymentMethod={completedReceipt.PaymentMethod || "Cash"}
                  items={completedReceipt.Items.map((item: any) => ({
                    name: item.MedicineName,
                    qty: item.Quantity,
                    price: item.UnitPrice,
                    total: item.LineTotal,
                    batch: item.BatchCode,
                    exp: item.ExpiryDate,
                  }))}
                  subtotal={completedReceipt.SubTotal}
                  discount={completedReceipt.Discount}
                  tax={completedReceipt.TaxAmount || 0}
                  grandTotal={completedReceipt.GrandTotal}
                  paidAmount={completedReceipt.PaidAmount}
                  changeDue={completedReceipt.ChangeDue}
                />
              ) : (
                <div className="p-4 text-center text-slate-500">Loading printer configuration...</div>
              )}
            </div>
            '''
content = re.sub(pattern, replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
