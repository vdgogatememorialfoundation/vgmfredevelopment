function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toExcelXml(sheetName: string, headers: string[], rows: (string | number)[][]) {
  const headerRow = `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join("")}</Row>`;
  const body = rows
    .map(
      (row) =>
        `<Row>${row
          .map((value) =>
            typeof value === "number" && Number.isFinite(value)
              ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
              : `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`
          )
          .join("")}</Row>`
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   ${headerRow}
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, `\uFEFF${toCsv(headers, rows)}`, "text/csv;charset=utf-8");
}

export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  downloadBlob(
    filename.endsWith(".xls") ? filename : `${filename}.xls`,
    toExcelXml(sheetName, headers, rows),
    "application/vnd.ms-excel"
  );
}

export function printPdf(title: string, headers: string[], rows: (string | number)[][]) {
  const tableHead = headers.map((header) => `<th>${escapeXml(header)}</th>`).join("");
  const tableBody = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeXml(String(value))}</td>`).join("")}</tr>`)
    .join("");
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${escapeXml(title)}</title>
<style>
  body { font-family: Source Sans 3, Segoe UI, sans-serif; color: #0B1F3A; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 12px; color: #5b6472; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d7dce3; padding: 6px 8px; font-size: 11px; text-align: left; vertical-align: top; }
  th { background: #F7F3EA; }
</style></head><body>
<h1>${escapeXml(title)}</h1>
<p>Vaidya Gogate Memorial Foundation · ${new Date().toLocaleString("en-IN")}</p>
<table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody || `<tr><td colspan="${headers.length}">No rows</td></tr>`}</tbody></table>
</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}
