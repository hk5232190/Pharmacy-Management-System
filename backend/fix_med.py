import sys

with open(r'e:\Projects\PMS-Software\backend\api\v1\reports.py', 'r') as f:
    content = f.read()

# Fix Excel Expiry
content = content.replace(
    "ws.append([t.MedicineId, t.MedicineName, getattr(t, 'BatchNumber', 'N/A'), getattr(t, 'StockQuantity', 0), getattr(t, 'ExpiryDate', '').strftime('%Y-%m-%d') if getattr(t, 'ExpiryDate', None) else 'N/A', getattr(t, 'DaysToExpiry', 0), getattr(t, 'RiskLevel', 'Unknown')])",
    "ws.append([getattr(t, 'MedicineId', 'N/A'), t.MedicineName, getattr(t, 'BatchCode', 'N/A'), getattr(t, 'Quantity', 0), getattr(t, 'ExpiryDate', '').strftime('%Y-%m-%d') if getattr(t, 'ExpiryDate', None) else 'N/A', getattr(t, 'DaysToExpiry', 0), getattr(t, 'Status', 'Unknown')])"
)

# Fix Excel Low Stock
content = content.replace(
    "ws.append([t.MedicineId, t.MedicineName, getattr(t, 'CurrentStock', 0), getattr(t, 'ReorderLevel', 0), getattr(t, 'SuggestedReorderQty', 0), 'Low Stock'])",
    "ws.append([getattr(t, 'MedicineId', 'N/A'), t.MedicineName, getattr(t, 'CurrentStock', 0), getattr(t, 'ReorderLevel', 0), getattr(t, 'SuggestedReorderQty', 0), 'Low Stock'])"
)

# Fix Excel Movement
content = content.replace(
    "ws.append([t.MedicineId, t.MedicineName, getattr(t, 'SoldQuantity', 0), round(getattr(t, 'Revenue', 0.0), 2), round(getattr(t, 'SalesVelocity', 0.0), 2), 0, getattr(t, 'Classification', 'Unknown')])",
    "ws.append([getattr(t, 'MedicineId', 'N/A'), t.MedicineName, getattr(t, 'SoldQuantity', 0), round(getattr(t, 'Revenue', 0.0), 2), round(getattr(t, 'SalesVelocity', 0.0), 2), 0, getattr(t, 'Classification', 'Unknown')])"
)

# Fix PDF Expiry
content = content.replace(
    "data.append([str(t.MedicineId), t.MedicineName[:15], getattr(t, 'BatchNumber', 'N/A'), str(getattr(t, 'StockQuantity', 0)), getattr(t, 'ExpiryDate', '').strftime('%Y-%m-%d') if getattr(t, 'ExpiryDate', None) else 'N/A', str(getattr(t, 'DaysToExpiry', 0)), getattr(t, 'RiskLevel', 'Unknown')])",
    "data.append([str(getattr(t, 'MedicineId', 'N/A')), t.MedicineName[:15], getattr(t, 'BatchCode', 'N/A'), str(getattr(t, 'Quantity', 0)), getattr(t, 'ExpiryDate', '').strftime('%Y-%m-%d') if getattr(t, 'ExpiryDate', None) else 'N/A', str(getattr(t, 'DaysToExpiry', 0)), getattr(t, 'Status', 'Unknown')])"
)

# Fix PDF Low Stock
content = content.replace(
    "data.append([str(t.MedicineId), t.MedicineName[:15], str(getattr(t, 'CurrentStock', 0)), str(getattr(t, 'ReorderLevel', 0)), str(getattr(t, 'SuggestedReorderQty', 0)), 'Low Stock'])",
    "data.append([str(getattr(t, 'MedicineId', 'N/A')), t.MedicineName[:15], str(getattr(t, 'CurrentStock', 0)), str(getattr(t, 'ReorderLevel', 0)), str(getattr(t, 'SuggestedReorderQty', 0)), 'Low Stock'])"
)

# Fix PDF Movement
content = content.replace(
    "data.append([str(t.MedicineId), t.MedicineName[:15], str(getattr(t, 'SoldQuantity', 0)), str(round(getattr(t, 'Revenue', 0.0), 2)), str(round(getattr(t, 'SalesVelocity', 0.0), 2)), '0', getattr(t, 'Classification', 'Unknown')])",
    "data.append([str(getattr(t, 'MedicineId', 'N/A')), t.MedicineName[:15], str(getattr(t, 'SoldQuantity', 0)), str(round(getattr(t, 'Revenue', 0.0), 2)), str(round(getattr(t, 'SalesVelocity', 0.0), 2)), '0', getattr(t, 'Classification', 'Unknown')])"
)

with open(r'e:\Projects\PMS-Software\backend\api\v1\reports.py', 'w') as f:
    f.write(content)

print('Replaced!')
