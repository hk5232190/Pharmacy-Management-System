import os
import re
import sys

# Ensure backend folder is in path so we can import utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.license_engine import generate_test_license

MAC_RE = re.compile(r'^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$')

def main():
    print("\n==================================")
    print("   PMS LICENSE GENERATOR SCRIPT   ")
    print("==================================\n")

    mac = input("Enter Client MAC Address (e.g. AA:BB:CC:DD:EE:FF): ").strip()
    if not mac:
        print("Error: MAC Address is required.")
        return

    if not MAC_RE.match(mac):
        print(f"Warning: '{mac}' does not look like a standard MAC address (XX:XX:XX:XX:XX:XX).")
        confirm = input("Continue anyway? (yes/no): ").strip().lower()
        if confirm not in ("yes", "y"):
            print("Aborted.")
            return

    days_str = input("Enter validity in days (e.g. 365) or type 'Lifetime': ").strip()

    if days_str.lower() == 'lifetime':
        license_type = "Lifetime"
        days_valid = 0
    else:
        license_type = "Subscription"
        try:
            days_valid = int(days_str)
        except ValueError:
            print("Error: Invalid number of days. Must be a number.")
            return

    client_name = input("Enter Client/Pharmacy Name (for the file name): ").strip()
    if not client_name:
        client_name = "client"

    filename = f"{client_name.replace(' ', '_').lower()}.lic"

    print("\nGenerating License...")
    try:
        # Generate the RSA-signed license payload bound to the client's MAC address
        token = generate_test_license(
            mac=mac,
            license_type=license_type,
            days_valid=days_valid,
            client_name=client_name,
        )

        output_dir = "generated_licenses"
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)

        with open(filepath, "wb") as f:
            f.write(token.encode("utf-8"))

        print(f"\n[SUCCESS] License generated securely!")
        print(f"Bound to MAC: {mac.upper().replace('-', ':')}")
        print(f"File saved at: {os.path.abspath(filepath)}")
        print("You can now email or WhatsApp this .lic file to the client.\n")
    except Exception as e:
        print(f"\n[ERROR] Failed to generate license: {e}\n")

if __name__ == "__main__":
    main()

