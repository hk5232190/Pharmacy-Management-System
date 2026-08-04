import urllib.request
import json
import urllib.error

url = "http://127.0.0.1:8000/api/v1/suppliers"
data = json.dumps({
    "Name": "Ali",
    "Phone": "436457548",
    "TaxNumber": "",
    "Address": "matta",
    "IsActive": True
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Error Response:", e.read().decode("utf-8"))
