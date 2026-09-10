"use client";

import React, { useCallback } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChallanData } from "./ChallanTemplate";

interface ChallanPrintProps {
  data: ChallanData;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

function buildChallanHtml(data: ChallanData): string {
  const title =
    data.type === "sale" ? "SALES DELIVERY CHALLAN" : "PURCHASE RECEIPT CHALLAN";

  const rows = data.Items.map(
    (item) => `
      <tr>
        <td style="padding:3px 0;border-bottom:1px dotted #ddd;vertical-align:top;">
          <strong>${item.MedicineName}</strong><br/>
          <span style="font-size:9px;color:#555;">Batch: ${item.BatchCode}${item.ExpiryDate ? ` | Exp: ${item.ExpiryDate}` : ""}</span>
        </td>
        <td style="padding:3px 0;border-bottom:1px dotted #ddd;text-align:center;vertical-align:top;">${item.Quantity}</td>
        <td style="padding:3px 0;border-bottom:1px dotted #ddd;text-align:right;vertical-align:top;">${item.UnitPrice.toFixed(2)}</td>
        <td style="padding:3px 0;border-bottom:1px dotted #ddd;text-align:right;vertical-align:top;"><strong>${item.LineTotal.toFixed(2)}</strong></td>
      </tr>`
  ).join("");

  const discountRow =
    data.DiscountAmount > 0
      ? `<tr><td colspan="3" style="padding:2px 0;">Discount</td><td style="padding:2px 0;text-align:right;">- ${data.DiscountAmount.toFixed(2)}</td></tr>`
      : "";

  const taxRow =
    data.TaxAmount > 0
      ? `<tr><td colspan="3" style="padding:2px 0;">Tax</td><td style="padding:2px 0;text-align:right;">+ ${data.TaxAmount.toFixed(2)}</td></tr>`
      : "";

  const paymentSection =
    data.PaidAmount !== undefined
      ? `
    <table style="width:100%;border-collapse:collapse;margin-top:4px;">
      <tr><td style="padding:2px 0;">Paid Amount</td><td style="padding:2px 0;text-align:right;">${data.PaidAmount.toFixed(2)}</td></tr>
      <tr><td style="padding:2px 0;">Payment Method</td><td style="padding:2px 0;text-align:right;">${data.PaymentMethod || "N/A"}</td></tr>
      <tr><td style="padding:2px 0;font-weight:bold;">Balance Due</td><td style="padding:2px 0;text-align:right;font-weight:bold;">${Math.max(0, data.GrandTotal - data.PaidAmount).toFixed(2)}</td></tr>
    </table>`
      : "";

  const notesSection = data.Notes
    ? `<div style="border-top:1px dashed #000;padding-top:2px;margin-bottom:4px;font-size:10px;">Notes: ${data.Notes}</div>`
    : "";

  return `
    <div style="text-align:center;margin-bottom:4px;">
      <div style="font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${data.FromName}</div>
      ${data.FromAddress ? `<div style="font-size:10px;">${data.FromAddress}</div>` : ""}
      ${data.FromPhone ? `<div style="font-size:10px;">Ph: ${data.FromPhone}</div>` : ""}
      ${data.FromLicense ? `<div style="font-size:9px;">License: ${data.FromLicense}</div>` : ""}
    </div>

    <div style="text-align:center;border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;padding:3px 0;margin:4px 0;">
      <div style="font-size:12px;font-weight:bold;letter-spacing:1px;">${title}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      <tr><td style="padding:1px 0;width:35%;">Challan No:</td><td style="padding:1px 0;font-weight:bold;">${data.ChallanNumber}</td></tr>
      <tr><td style="padding:1px 0;">Date:</td><td style="padding:1px 0;">${data.Date}</td></tr>
      <tr><td style="padding:1px 0;">${data.type === "sale" ? "Customer:" : "Supplier:"}</td><td style="padding:1px 0;font-weight:bold;">${data.ToName}</td></tr>
      ${data.ToPhone ? `<tr><td style="padding:1px 0;">Phone:</td><td style="padding:1px 0;">${data.ToPhone}</td></tr>` : ""}
      ${data.ToAddress ? `<tr><td style="padding:1px 0;">Address:</td><td style="padding:1px 0;">${data.ToAddress}</td></tr>` : ""}
    </table>

    <table style="width:100%;border-collapse:collapse;border-top:1.5px dashed #000;border-bottom:1.5px dashed #000;padding:2px 0;margin-bottom:2px;">
      <tr style="font-weight:bold;font-size:10px;">
        <td style="padding:1px 0;">Item</td>
        <td style="padding:1px 0;text-align:center;">Qty</td>
        <td style="padding:1px 0;text-align:right;">Price</td>
        <td style="padding:1px 0;text-align:right;">Total</td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
      ${rows}
    </table>

    <table style="width:100%;border-collapse:collapse;border-top:1.5px dashed #000;padding-top:2px;">
      <tr><td style="padding:2px 0;">Subtotal</td><td style="padding:2px 0;text-align:right;">${data.SubTotal.toFixed(2)}</td></tr>
      ${discountRow}
      ${taxRow}
      <tr style="font-weight:bold;font-size:12px;">
        <td style="padding:3px 0;border-top:1.5px dashed #000;">GRAND TOTAL</td>
        <td style="padding:3px 0;text-align:right;border-top:1.5px dashed #000;">${data.GrandTotal.toFixed(2)}</td>
      </tr>
    </table>

    ${paymentSection}
    ${notesSection}

    <div style="display:flex;justify-content:space-between;margin-top:10px;">
      <div style="width:42%;text-align:center;">
        <div style="border-top:1px solid #000;margin-top:20px;padding-top:2px;font-size:9px;">Authorized Signature</div>
      </div>
      <div style="width:42%;text-align:center;">
        <div style="border-top:1px solid #000;margin-top:20px;padding-top:2px;font-size:9px;">Receiver's Signature</div>
      </div>
    </div>

    <div style="text-align:center;margin-top:6px;font-size:8px;color:#666;">
      Thank you for your business!
    </div>
  `;
}

export default function ChallanPrint({
  data,
  variant = "ghost",
  size = "icon",
  className,
  label,
}: ChallanPrintProps) {
  const handlePrint = useCallback(() => {
    const printArea = document.getElementById("challan-print-area");
    if (!printArea) return;

    // Set the challan HTML into the hidden div
    printArea.innerHTML = buildChallanHtml(data);

    // Trigger print on the main window
    window.print();

    // Clean up after print dialog closes
    setTimeout(() => {
      printArea.innerHTML = "";
    }, 1000);
  }, [data]);

  if (label) {
    return (
      <Button variant={variant} size={size} className={className} onClick={handlePrint} title="Print Challan">
        <FileText className="w-4 h-4" />
        <span className="ml-1">{label}</span>
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handlePrint} title="Print Challan">
      <FileText className="w-4 h-4" />
    </Button>
  );
}
