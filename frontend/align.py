import re
import os
from pathlib import Path

files = [
    'inventory/page.tsx',
    'masters/categories/page.tsx',
    'masters/companies/page.tsx',
    'masters/customers/page.tsx',
    'masters/medicines/page.tsx',
    'masters/suppliers/page.tsx',
    'purchases/page.tsx',
    'reports/page.tsx',
    'sales/page.tsx',
    'settings/backup-restore/page.tsx',
    'settings/users/page.tsx'
]

def process_file(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Rule 1: th and TableHead
    center_headers = r'(?i)\b(Qty|Quantity|Amount|Total|Price|Stock|Actions|#|Status|S\.No|Code|Discount|Tax|Paid|Balance|Size|Role|Items|Free|Margin|Value)\b'
    
    def th_replacer(m):
        tag_open = m.group(1)
        inner = m.group(2)
        tag_close = m.group(3)
        
        # If it's a center header
        if bool(re.search(center_headers, inner)) or inner.strip() == '#':
            if 'text-center' not in tag_open and 'text-right' not in tag_open and 'text-left' not in tag_open:
                if 'className="' in tag_open:
                    tag_open = re.sub(r'(className="[^"]*)(")', r'\1 text-center\2', tag_open)
                elif "className='" in tag_open:
                    tag_open = re.sub(r"(className='[^']*)(')", r"\1 text-center\2", tag_open)
                else:
                    # Insert className before the >
                    tag_open = tag_open.rstrip('>') + ' className="text-center">'
                    
        # Otherwise, force left if no alignment is present
        else:
            if 'text-center' not in tag_open and 'text-right' not in tag_open and 'text-left' not in tag_open:
                if 'className="' in tag_open:
                    tag_open = re.sub(r'(className="[^"]*)(")', r'\1 text-left\2', tag_open)
                elif "className='" in tag_open:
                    tag_open = re.sub(r"(className='[^']*)(')", r"\1 text-left\2", tag_open)
                else:
                    tag_open = tag_open.rstrip('>') + ' className="text-left">'
                    
        return tag_open + inner + tag_close

    # Match <th ...> ... </th> or <TableHead ...> ... </TableHead>
    content = re.sub(r'(<(?:th|TableHead)[^>]*>)(.*?)(</(?:th|TableHead)>)', th_replacer, content, flags=re.DOTALL)
    
    # Rule 2: td and TableCell
    center_td_indicators = [
        r'formatCurrency', r'formatNumber', r'\{idx\s*\+\s*1\}', r'<Trash2', r'<Edit', r'<Eye', r'<Button',
        r'rounded-full', r'tabular-nums', r'\{.*Qty\}', r'\{.*Quantity\}', r'\{.*Stock\}', r'\{.*Amount\}',
        r'\{.*Price\}', r'\{.*Total\}', r'\{.*Balance\}', r'\{.*Paid\}', r'\{.*Discount\}', r'\{.*Tax\}',
        r'\{.*Value\}', r'\{.*Margin\}', r'Status', r'formatBytes', r'Active', r'Inactive', r'Role'
    ]
    center_td_regex = '|'.join(center_td_indicators)

    def td_replacer(m):
        tag_open = m.group(1)
        inner = m.group(2)
        tag_close = m.group(3)
        
        if bool(re.search(center_td_regex, inner)):
            if 'text-center' not in tag_open and 'text-right' not in tag_open and 'text-left' not in tag_open:
                if 'className="' in tag_open:
                    tag_open = re.sub(r'(className="[^"]*)(")', r'\1 text-center\2', tag_open)
                elif "className='" in tag_open:
                    tag_open = re.sub(r"(className='[^']*)(')", r"\1 text-center\2", tag_open)
                else:
                    tag_open = tag_open.rstrip('>') + ' className="text-center">'
        else:
             if 'text-center' not in tag_open and 'text-right' not in tag_open and 'text-left' not in tag_open:
                if 'className="' in tag_open:
                    tag_open = re.sub(r'(className="[^"]*)(")', r'\1 text-left\2', tag_open)
                elif "className='" in tag_open:
                    tag_open = re.sub(r"(className='[^']*)(')", r"\1 text-left\2", tag_open)
                else:
                    tag_open = tag_open.rstrip('>') + ' className="text-left">'
                    
        return tag_open + inner + tag_close

    content = re.sub(r'(<(?:td|TableCell)[^>]*>)(.*?)(</(?:td|TableCell)>)', td_replacer, content, flags=re.DOTALL)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {path}')

base_dir = Path(__file__).resolve().parent / 'src' / 'app' / 'dashboard'
for file in files:
    process_file(str(base_dir / file))
