"use client";

import React, { forwardRef } from "react";

export interface ChallanItem {
  MedicineName: string;
  BatchCode: string;
  ExpiryDate?: string;
  Quantity: number;
  UnitPrice: number;
  Discount?: number;
  Tax?: number;
  LineTotal: number;
}

export interface ChallanData {
  type: "sale" | "purchase";
  ChallanNumber: string;
  Date: string;
  FromName: string;
  FromAddress: string;
  FromPhone: string;
  FromLicense?: string;
  ToName: string;
  ToAddress?: string;
  ToPhone?: string;
  Items: ChallanItem[];
  SubTotal: number;
  DiscountAmount: number;
  TaxAmount: number;
  GrandTotal: number;
  PaidAmount?: number;
  PaymentMethod?: string;
  Notes?: string;
}

interface ChallanTemplateProps {
  data: ChallanData;
}

const ChallanTemplate = forwardRef<HTMLDivElement, ChallanTemplateProps>(
  ({ data }, ref) => {
    const title =
      data.type === "sale" ? "SALES DELIVERY CHALLAN" : "PURCHASE RECEIPT CHALLAN";

    return (
      <div
        ref={ref}
        className="challan-printable"
        style={{
          width: "80mm",
          fontFamily: "monospace",
          fontSize: "11px",
          lineHeight: "1.4",
          color: "#000",
          background: "#fff",
          padding: "4mm",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4mm" }}>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              margin: "0 0 2mm 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {data.FromName}
          </h2>
          {data.FromAddress && (
            <p style={{ margin: "0.5mm 0", fontSize: "10px" }}>
              {data.FromAddress}
            </p>
          )}
          {data.FromPhone && (
            <p style={{ margin: "0.5mm 0", fontSize: "10px" }}>
              Ph: {data.FromPhone}
            </p>
          )}
          {data.FromLicense && (
            <p style={{ margin: "0.5mm 0", fontSize: "9px" }}>
              License: {data.FromLicense}
            </p>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            textAlign: "center",
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "2mm 0",
            margin: "3mm 0",
          }}
        >
          <h3
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              margin: 0,
              letterSpacing: "1px",
            }}
          >
            {title}
          </h3>
        </div>

        {/* Challan Info */}
        <div style={{ marginBottom: "3mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Challan No:</span>
            <span style={{ fontWeight: "bold" }}>{data.ChallanNumber}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Date:</span>
            <span>{data.Date}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{data.type === "sale" ? "Customer:" : "Supplier:"}</span>
            <span style={{ fontWeight: "bold" }}>{data.ToName}</span>
          </div>
          {data.ToPhone && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Phone:</span>
              <span>{data.ToPhone}</span>
            </div>
          )}
          {data.ToAddress && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Address:</span>
              <span>{data.ToAddress}</span>
            </div>
          )}
        </div>

        {/* Items Header */}
        <div
          style={{
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "1.5mm 0",
            marginBottom: "1mm",
            display: "flex",
            fontWeight: "bold",
            fontSize: "10px",
          }}
        >
          <span style={{ flex: 3 }}>Item</span>
          <span style={{ flex: 1, textAlign: "center" }}>Qty</span>
          <span style={{ flex: 1.5, textAlign: "right" }}>Price</span>
          <span style={{ flex: 2, textAlign: "right" }}>Total</span>
        </div>

        {/* Items */}
        <div style={{ marginBottom: "3mm" }}>
          {data.Items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                padding: "1mm 0",
                borderBottom: "0.5px dotted #ccc",
                fontSize: "10px",
              }}
            >
              <div style={{ flex: 3, paddingRight: "2mm" }}>
                <div style={{ fontWeight: "bold", wordBreak: "break-word" }}>
                  {item.MedicineName}
                </div>
                <div style={{ fontSize: "9px", color: "#555" }}>
                  Batch: {item.BatchCode}
                  {item.ExpiryDate && ` | Exp: ${item.ExpiryDate}`}
                </div>
              </div>
              <span style={{ flex: 1, textAlign: "center" }}>
                {item.Quantity}
              </span>
              <span style={{ flex: 1.5, textAlign: "right" }}>
                {item.UnitPrice.toFixed(2)}
              </span>
              <span style={{ flex: 2, textAlign: "right", fontWeight: "bold" }}>
                {item.LineTotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div
          style={{
            borderTop: "1px dashed #000",
            paddingTop: "2mm",
            marginBottom: "3mm",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1mm",
            }}
          >
            <span>Subtotal:</span>
            <span>{data.SubTotal.toFixed(2)}</span>
          </div>
          {data.DiscountAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1mm",
              }}
            >
              <span>Discount:</span>
              <span>- {data.DiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {data.TaxAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1mm",
              }}
            >
              <span>Tax:</span>
              <span>+ {data.TaxAmount.toFixed(2)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "12px",
              borderTop: "1px dashed #000",
              paddingTop: "2mm",
              marginTop: "2mm",
            }}
          >
            <span>GRAND TOTAL:</span>
            <span>{data.GrandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        {data.PaidAmount !== undefined && (
          <div
            style={{
              borderTop: "1px dashed #000",
              paddingTop: "2mm",
              marginBottom: "3mm",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1mm",
              }}
            >
              <span>Paid Amount:</span>
              <span>{data.PaidAmount.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1mm",
              }}
            >
              <span>Payment Method:</span>
              <span>{data.PaymentMethod || "N/A"}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
              }}
            >
              <span>Balance Due:</span>
              <span>
                {Math.max(0, data.GrandTotal - data.PaidAmount).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        {data.Notes && (
          <div
            style={{
              borderTop: "1px dashed #000",
              paddingTop: "2mm",
              marginBottom: "3mm",
            }}
          >
            <p style={{ margin: 0, fontSize: "10px" }}>Notes: {data.Notes}</p>
          </div>
        )}

        {/* Signature Lines */}
        <div
          style={{
            borderTop: "1px dashed #000",
            paddingTop: "3mm",
            marginTop: "4mm",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ textAlign: "center", width: "40%" }}>
            <div
              style={{
                borderTop: "1px solid #000",
                marginTop: "12mm",
                paddingTop: "1mm",
                fontSize: "9px",
              }}
            >
              Authorized Signature (Issuer)
            </div>
          </div>
          <div style={{ textAlign: "center", width: "40%" }}>
            <div
              style={{
                borderTop: "1px solid #000",
                marginTop: "12mm",
                paddingTop: "1mm",
                fontSize: "9px",
              }}
            >
              Receiver&apos;s Signature
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "5mm",
            fontSize: "8px",
            color: "#666",
          }}
        >
          <p style={{ margin: "0.5mm 0" }}>Thank you for your business!</p>
          <p style={{ margin: "0.5mm 0" }}>
            Generated by Pharmacy Management System
          </p>
        </div>
      </div>
    );
  }
);

ChallanTemplate.displayName = "ChallanTemplate";

export default ChallanTemplate;
