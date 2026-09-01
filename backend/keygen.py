import os
import sys

# Ensure backend folder is in path so we can import utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.license_engine import generate_test_license

def main():
    print("\n==================================")
    print("   PMS LICENSE GENERATOR SCRIPT   ")
    print("==================================\n")
    
    hwid = input("Enter Client Hardware ID: ").strip()
    if not hwid:
        print("Error: Hardware ID is required.")
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
        # Generate the RSA-signed license payload
        token = generate_test_license(hwid, license_type, days_valid, client_name=client_name)
        
        # Save it to a new folder called "generated_licenses"
        output_dir = "generated_licenses"
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(token.encode("utf-8"))
            
        print(f"\n[SUCCESS] License generated securely!")
        print(f"File saved at: {os.path.abspath(filepath)}")
        print("You can now email or WhatsApp this .lic file to the client.\n")
    except Exception as e:
        print(f"\n[ERROR] Failed to generate license: {e}\n")

if __name__ == "__main__":
    main()
