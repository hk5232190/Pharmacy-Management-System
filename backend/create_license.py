import argparse
import datetime
from utils.license_engine import generate_test_license

def create_license_file(hwid: str, start_date_str: str = None, end_date_str: str = None):
    """
    Generates a valid signed license key for the given HWID and prints it to the console.
    Allows passing custom start and end dates (YYYY-MM-DD format).
    """
    try:
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
        if end_date_str:
            end_date = datetime.datetime.strptime(end_date_str, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
        
        license_key = generate_test_license(
            hwid, 
            license_type="Professional", 
            start_date=start_date, 
            end_date=end_date
        )
        
        if isinstance(license_key, bytes):
            license_key = license_key.decode('utf-8')
            
        print("Success! License key generated successfully.\n")
        print("--- BEGIN LICENSE KEY ---")
        print(license_key)
        print("--- END LICENSE KEY ---\n")
        
        print(f"This license is locked to HWID: {hwid}")
        if start_date_str:
            print(f"Starts on: {start_date_str}")
        if end_date_str:
            print(f"Expires on: {end_date_str}")
    except ValueError as e:
        print(f"Date format error: Ensure dates are in YYYY-MM-DD format. ({e})")
    except Exception as e:
        print(f"Error generating license: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a secure license key for PMS Software")
    parser.add_argument("hwid", help="The Hardware ID of the target machine")
    parser.add_argument("--start", help="Start date (YYYY-MM-DD)", default=None)
    parser.add_argument("--end", help="End/Expiry date (YYYY-MM-DD)", default=None)
    
    args = parser.parse_args()
    create_license_file(args.hwid, args.start, args.end)
