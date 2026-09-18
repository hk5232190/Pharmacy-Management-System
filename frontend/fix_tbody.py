import os
import glob
import re
from pathlib import Path

dashboard_path = str(Path(__file__).resolve().parent / 'src' / 'app' / 'dashboard')

for root, dirs, files in os.walk(dashboard_path):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find `<tbody className="...divide-y divide-border..."`
            # If it doesn't have `border-b`, add it.
            
            def replace_tbody(match):
                class_name = match.group(1)
                if 'divide-y' in class_name and 'border-b' not in class_name:
                    return f'<tbody className="{class_name} border-b border-border">'
                return match.group(0)
            
            new_content = re.sub(r'<tbody\s+className="([^"]+)">', replace_tbody, content)

            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated tbody in {filepath}")
