# PMS Customizable Thermal Receipt & Printing System

## 1. Objective

Implement a **complete, reliable, and customizable receipt printing
system** for the Pharmacy Management System (PMS).

The system must let the pharmacy control:

-   What information appears on the receipt
-   Receipt layout and formatting
-   Thermal paper size and printable width
-   Font/text scale and item-column sizing
-   Number of copies
-   Printer/destination used for printing
-   Automatic vs manual printing
-   Receipt preview before printing

The printing system must work smoothly with **thermal receipt
printers**, especially common **58 mm and 80 mm** printers, without
changing the underlying sale or creating duplicate transactions.

------------------------------------------------------------------------

## 2. Main Settings Structure

Create/upgrade:

**Settings → Printer & Receipt**

Use two main sections/tabs:

1.  **Printers & Copies**
2.  **Receipt Design**

Keep the UI consistent with the existing PMS design system, including
light/dark mode and responsive behavior.

------------------------------------------------------------------------

# 3. Printers & Copies

## 3.1 Printer Destination

Allow the user to select how a receipt should be printed.

Supported destinations:

-   **Default System Printer**
-   **Specific Installed Printer**
-   **Open Print Window / Print Dialog**
-   **Microsoft Print to PDF** when available
-   **Save/Export as PDF** if already supported by the application

Detect installed printers from the operating system instead of
hard-coding printer names.

If a previously selected printer is disconnected or unavailable, show a
clear warning and safely allow selection of another printer.

Do not silently mark a print as successful if the print job failed.

## 3.2 Printer Configuration

Provide:

-   Default receipt printer
-   Paper width: **58 mm / 80 mm / Custom**
-   Number of copies
-   Auto-print after successful sale: On/Off
-   Open print dialog before printing: On/Off
-   Test Print button

Validate copy count and custom dimensions.

Printer settings must persist after application restart.

------------------------------------------------------------------------

# 4. Receipt Design

Provide a **live receipt preview** that updates immediately when
settings change.

## 4.1 Layout Controls

Allow configuration of:

-   Paper width (mm)
-   Font/Text scale (%)
-   Characters per line: Auto or manual
-   Item/Medicine name column width
-   Receipt title
-   Footer message
-   Line spacing where supported
-   Alignment where appropriate

The generated receipt must always fit within the selected printable
width and must not clip content on the right side.

Long medicine names and other long values must wrap or truncate safely
according to the chosen layout.

------------------------------------------------------------------------

# 5. Customizable Receipt Content

Provide On/Off controls for receipt fields.

## Pharmacy/Header

-   Pharmacy logo
-   Pharmacy name
-   Address
-   Phone number
-   Registration/License/Tax number, if available

Use existing **Pharmacy Information / General Settings** data. Do not
create duplicate pharmacy-profile data.

## Invoice Information

-   Receipt title
-   Invoice number
-   Date
-   Time
-   Customer name
-   Customer phone, if available
-   Cashier/Admin name

## Medicine Items

Recommended columns:

-   Medicine/Item name
-   Quantity
-   Unit price
-   Discount, when applicable
-   Line total

The layout must automatically adapt to 58 mm and 80 mm paper.

## Totals & Payment

Optional/configurable lines:

-   Subtotal
-   Discount
-   Tax
-   Grand Total
-   Amount Paid / Cash Received
-   Change Due
-   Payment Method
-   Previous/Remaining Balance, only if supported by existing PMS
    business logic

**Grand Total must always remain clearly visible and emphasized.**

## Footer

Allow:

-   Custom thank-you/footer message
-   Software/provider information
-   End marker/separator

Do not print empty optional fields.

------------------------------------------------------------------------

# 6. Live Preview

Show a realistic thermal-receipt preview beside the settings.

The preview should:

-   Reflect the selected paper width
-   Reflect font scale
-   Reflect enabled/disabled fields
-   Reflect receipt title/footer
-   Reflect item-column width
-   Use safe sample/preview values only
-   Update without saving first

Preview data must never create or modify a real sale.

------------------------------------------------------------------------

# 7. Printing Flow

Use one centralized receipt rendering/printing flow.

### Manual Print

**Sale/History → Print Receipt → Build Receipt from saved transaction →
Render → Selected Destination → Print**

### Automatic Print

**Successfully Complete Sale → Commit Transaction → Build Receipt →
Print**

Important:

-   Printing must happen **after the sale is successfully committed**.
-   Printing/reprinting must **never create another sale, payment, stock
    movement, invoice number, or transaction**.
-   Reprint must use the already saved invoice data.
-   A printer failure must not roll back or duplicate an already
    completed sale.
-   Provide a clear **Retry Print** option after print failure.

------------------------------------------------------------------------

# 8. Thermal Printer Requirements

Optimize output for common thermal printers.

The system must:

-   Support **58 mm and 80 mm** paper
-   Respect printable margins
-   Prevent horizontal clipping
-   Wrap long medicine/pharmacy/customer names correctly
-   Keep quantity, price, and totals readable
-   Keep monetary values aligned
-   Avoid unnecessary blank paper
-   Minimize excessive bottom feed
-   Produce clean separators
-   Produce consistent output between preview and actual print as far as
    the printer/driver allows

Use the existing OS printer/driver integration where practical. Do not
hard-code one printer brand or model.

------------------------------------------------------------------------

# 9. Settings Persistence

Persist printer and receipt settings using the existing application
settings architecture/database.

Settings should include at minimum:

-   Selected printer/destination
-   Paper width
-   Custom width if used
-   Copies
-   Auto-print preference
-   Print-dialog preference
-   Font scale
-   Characters per line
-   Item name width
-   Receipt title
-   Footer message
-   All content visibility toggles

Do not introduce duplicate settings storage if equivalent settings
already exist.

------------------------------------------------------------------------

# 10. Safety & Architecture Rules

-   First inspect the existing PMS printing, receipt, Sales/POS,
    Settings, Pharmacy Information, and database flow.
-   Reuse existing working components and data.
-   Create **one shared receipt renderer** used by POS printing, Sales
    History reprints, preview, and other receipt-print actions.
-   Create **one shared printer service** for destination/printer
    handling.
-   Do not duplicate receipt calculations in the UI.
-   Receipt totals must come from the saved transaction/business logic.
-   Preserve existing sales, stock, return, payment, licensing, and
    reporting behavior.
-   Do not rewrite unrelated modules.
-   Do not add restaurant-specific features such as KOT, tables,
    dine-in, order taker, or delivery receipts.
-   Never test destructive/data-changing print scenarios against live
    pharmacy records.

------------------------------------------------------------------------

# 11. Error Handling

Handle gracefully:

-   No printer installed
-   Selected printer unavailable/offline
-   Invalid paper width
-   Invalid copies
-   Print job failure
-   PDF destination unavailable
-   Missing optional pharmacy/customer data
-   Receipt content wider than printable area

Errors should be clear and actionable. A print failure must not corrupt
transaction data.

------------------------------------------------------------------------

# 12. Testing Checklist

Test at minimum:

-   58 mm thermal receipt
-   80 mm thermal receipt
-   Custom width
-   Default printer
-   Specific installed printer
-   Print dialog
-   PDF destination when available
-   One and multiple copies
-   Test Print
-   Auto-print after successful sale
-   Manual print from Sales History
-   Reprint the same invoice multiple times without duplicating data
-   Printer disconnected/unavailable
-   Long medicine names
-   Large prices/totals
-   Optional fields On/Off
-   Logo On/Off
-   Receipt title/footer changes
-   Light/Dark settings UI
-   Save settings → restart app → settings remain
-   Preview vs actual receipt layout
-   Print failure → Retry Print
-   Verify sales, payments, stock, dashboard and reports remain
    unchanged by reprinting

------------------------------------------------------------------------

# 13. Definition of Done

The feature is complete when:

1.  Printer and receipt settings are fully configurable and persistent.
2.  58 mm and 80 mm thermal receipts print cleanly without clipping.
3.  Users can choose an available print destination/printer.
4.  Receipt content can be enabled/disabled and customized.
5.  Live preview accurately reflects receipt settings.
6.  Auto-print, manual print, test print, and reprint work reliably.
7.  Reprinting never duplicates or changes transaction data.
8.  Printer failures are handled safely.
9.  Existing PMS business logic and approved UI remain intact.
10. All relevant tests/checks pass, with any unverified
    hardware-specific behavior clearly reported.

------------------------------------------------------------------------

## Agent Implementation Instruction

**First inspect the existing implementation and reuse it wherever
possible. Implement this system incrementally with the smallest safe
changes. Preserve existing PMS functionality and UI. Do not add
unrelated features. After implementation, report what was changed,
tests/checks passed or failed, and any thermal-printer behavior that
still requires testing on physical hardware.**
