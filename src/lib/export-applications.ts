/** Client-side CSV / PDF export for applicant contact rows. */
import { format } from "date-fns";

export interface ContactRow {
  application_reference: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  status: string;
  submitted_at: string;
}

const HEADERS = [
  "Reference",
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Vacancy",
  "Status",
  "Submitted",
];

function toCells(r: ContactRow): string[] {
  return [
    r.application_reference,
    r.first_name,
    r.last_name,
    r.email,
    r.phone,
    r.job_title,
    r.status.replace("_", " "),
    format(new Date(r.submitted_at), "yyyy-MM-dd HH:mm"),
  ];
}

/** Quote a CSV cell, and neutralise spreadsheet formula injection (=, +, -, @). */
function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => format(new Date(), "yyyyMMdd-HHmm");

export function exportCsv(rows: ContactRow[]) {
  const lines = [HEADERS, ...rows.map(toCells)].map((r) => r.map(csvCell).join(","));
  // BOM so Excel reads UTF-8 names correctly
  download(
    new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    `applications-${stamp()}.csv`,
  );
}

export async function exportPdf(rows: ContactRow[]) {
  // loaded on demand so the PDF libraries stay out of the main bundle
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Applications", 40, 40);
  doc.setFontSize(9);
  doc.text(
    `${rows.length} contact${rows.length === 1 ? "" : "s"} · exported ${format(new Date(), "d MMM yyyy, HH:mm")}`,
    40,
    56,
  );
  autoTable(doc, {
    startY: 70,
    head: [HEADERS],
    body: rows.map(toCells),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 40, 40] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`applications-${stamp()}.pdf`);
}
