import type { Bill, CompanySettings, InventoryItem, UserRole } from '../types.ts';
import { generateItemBarcode } from './barcode.ts';

function sanitizeSpreadsheetText(val: unknown): string {
  const str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function escapeXml(val: unknown): string {
  return sanitizeSpreadsheetText(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRowXml(cells: Array<{ value: string | number; type?: 'String' | 'Number'; style?: string }>): string {
  const cellXml = cells
    .map((c) => {
      const t = c.type ?? (typeof c.value === 'number' ? 'Number' : 'String');
      const styleAttr = c.style ? ` ss:StyleID="${c.style}"` : '';
      const content = t === 'Number' ? String(Number.isFinite(Number(c.value)) ? c.value : 0) : escapeXml(c.value);
      return `<Cell${styleAttr}><Data ss:Type="${t}">${content}</Data></Cell>`;
    })
    .join('');
  return `<Row>${cellXml}</Row>`;
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportDaybookToExcel(
  bills: Bill[],
  company: CompanySettings,
  userRole: UserRole,
  dateRangeLabel: string
): void {
  const isPrivileged = userRole !== 'cashier';
  const summaryHeaders = [
    { value: 'Bill No', style: 'header' },
    { value: 'Date & Time', style: 'header' },
    { value: 'Customer', style: 'header' },
    { value: 'Phone', style: 'header' },
    { value: 'Payment', style: 'header' },
    { value: 'Cashier', style: 'header' },
    { value: 'Subtotal', style: 'header' },
    { value: 'Tax / GST', style: 'header' },
    { value: 'Discount', style: 'header' },
    { value: 'Grand Total', style: 'header' },
    ...(isPrivileged
      ? [
          { value: 'Total Cost', style: 'header' },
          { value: 'Net Profit', style: 'header' },
        ]
      : []),
  ];

  const billRows = bills.map((b) =>
    buildRowXml([
      { value: b.bill_number },
      { value: b.created_at },
      { value: b.customer_name },
      { value: b.customer_phone },
      { value: b.payment_method },
      { value: b.created_by_name },
      { value: Number(b.subtotal.toFixed(2)), type: 'Number' },
      { value: Number(b.tax_amount.toFixed(2)), type: 'Number' },
      { value: Number(b.discount_amount.toFixed(2)), type: 'Number' },
      { value: Number(b.total_amount.toFixed(2)), type: 'Number' },
      ...(isPrivileged
        ? [
            { value: Number((b.total_cost ?? 0).toFixed(2)), type: 'Number' as const },
            {
              value: Number((b.total_amount - (b.total_cost ?? 0)).toFixed(2)),
              type: 'Number' as const,
            },
          ]
        : []),
    ])
  );

  const totalRev = bills.reduce((s, b) => s + b.total_amount, 0);
  const totalTax = bills.reduce((s, b) => s + b.tax_amount, 0);
  const totalDisc = bills.reduce((s, b) => s + b.discount_amount, 0);
  const totalCost = bills.reduce((s, b) => s + (b.total_cost ?? 0), 0);

  const totalsRow = buildRowXml([
    { value: 'TOTAL', style: 'bold' },
    { value: `${bills.length} Bills`, style: 'bold' },
    { value: dateRangeLabel, style: 'bold' },
    { value: '' },
    { value: '' },
    { value: '' },
    { value: '' },
    { value: Number(totalTax.toFixed(2)), type: 'Number', style: 'bold' },
    { value: Number(totalDisc.toFixed(2)), type: 'Number', style: 'bold' },
    { value: Number(totalRev.toFixed(2)), type: 'Number', style: 'bold' },
    ...(isPrivileged
      ? [
          { value: Number(totalCost.toFixed(2)), type: 'Number' as const, style: 'bold' },
          { value: Number((totalRev - totalCost).toFixed(2)), type: 'Number' as const, style: 'bold' },
        ]
      : []),
  ]);

  const itemHeaders = [
    { value: 'Bill No', style: 'header' },
    { value: 'Date & Time', style: 'header' },
    { value: 'Customer', style: 'header' },
    { value: 'Item Name', style: 'header' },
    { value: 'Barcode', style: 'header' },
    { value: 'Qty', style: 'header' },
    { value: 'MRP', style: 'header' },
    { value: 'Selling Rate', style: 'header' },
    { value: 'Tax %', style: 'header' },
    { value: 'Line Total', style: 'header' },
  ];

  const lineRows: string[] = [];
  for (const b of bills) {
    for (const line of b.items || []) {
      lineRows.push(
        buildRowXml([
          { value: b.bill_number },
          { value: b.created_at },
          { value: b.customer_name },
          { value: line.item_name },
          { value: line.barcode },
          { value: line.qty, type: 'Number' },
          { value: Number(line.mrp.toFixed(2)), type: 'Number' },
          { value: Number(line.unit_price.toFixed(2)), type: 'Number' },
          { value: Number(line.tax_rate.toFixed(2)), type: 'Number' },
          { value: Number(line.line_total.toFixed(2)), type: 'Number' },
        ])
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>
  <Style ss:ID="bold"><Font ss:Bold="1"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="13"/></Style>
 </Styles>
 <Worksheet ss:Name="Sales Daybook">
  <Table>
   ${buildRowXml([{ value: `${company.company_name} — Sales Daybook (${dateRangeLabel})`, style: 'title' }])}
   ${buildRowXml(summaryHeaders)}
   ${billRows.join('\n')}
   ${totalsRow}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Itemized Sales">
  <Table>
   ${buildRowXml(itemHeaders)}
   ${lineRows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

  const safeSlug = (dateRangeLabel || 'all').replace(/[^a-zA-Z0-9_-]/g, '-');
  downloadBlob(xml, 'application/vnd.ms-excel;charset=utf-8;', `sales-daybook-${safeSlug}.xls`);
}

export function exportInventoryToExcel(
  items: InventoryItem[],
  company: CompanySettings,
  userRole: UserRole
): void {
  const isPrivileged = userRole !== 'cashier';
  const headers = [
    { value: 'Item Name', style: 'header' },
    { value: 'SKU', style: 'header' },
    { value: 'Barcode', style: 'header' },
    { value: 'Category', style: 'header' },
    { value: 'Unit', style: 'header' },
    { value: 'MRP', style: 'header' },
    { value: 'Selling Price', style: 'header' },
    ...(isPrivileged ? [{ value: 'Buying Price', style: 'header' }] : []),
    { value: 'Tax %', style: 'header' },
    { value: 'Stock Qty', style: 'header' },
    { value: 'Low Stock Alert', style: 'header' },
    { value: 'Retail Valuation', style: 'header' },
  ];

  const rows = items.map((item) =>
    buildRowXml([
      { value: item.name },
      { value: item.sku },
      { value: item.barcode },
      { value: item.category },
      { value: item.unit },
      { value: Number(item.mrp.toFixed(2)), type: 'Number' },
      { value: Number(item.selling_price.toFixed(2)), type: 'Number' },
      ...(isPrivileged
        ? [{ value: Number((item.buying_price ?? 0).toFixed(2)), type: 'Number' as const }]
        : []),
      { value: Number(item.tax_rate.toFixed(2)), type: 'Number' },
      { value: item.stock_qty, type: 'Number' },
      { value: item.low_stock_threshold, type: 'Number' },
      { value: Number((item.stock_qty * item.selling_price).toFixed(2)), type: 'Number' },
    ])
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="13"/></Style>
 </Styles>
 <Worksheet ss:Name="Inventory Catalog">
  <Table>
   ${buildRowXml([{ value: `${company.company_name} — Inventory Stock Sheet`, style: 'title' }])}
   ${buildRowXml(headers)}
   ${rows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(xml, 'application/vnd.ms-excel;charset=utf-8;', 'inventory-stock-details.xls');
}

export function downloadInventoryImportTemplate(): void {
  const csv = [
    'name,category,unit,mrp,selling_price,buying_price,tax_rate,stock_qty,low_stock_threshold,barcode',
    'Organic Brown Sugar 1kg,Grains & Staples,pack,160,135,98,5,30,10,',
    'Filter Coffee Powder 500g,Beverages,pack,320,285,215,5,25,8,',
  ].join('\n');
  downloadBlob(csv, 'text/csv;charset=utf-8;', 'inventory-import-template.csv');
}

export interface ParsedImportItem {
  name: string;
  category: string;
  unit: string;
  mrp: number;
  selling_price: number;
  buying_price: number;
  tax_rate: number;
  stock_qty: number;
  low_stock_threshold: number;
  barcode: string;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseImportSpreadsheetText(rawText: string): ParsedImportItem[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  let matrix: string[][] = [];

  // Support SpreadsheetML XML (.xls exported from Excel)
  if (trimmed.startsWith('<?xml') || trimmed.includes('<Workbook') || trimmed.includes('<Row>')) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/xml');
    const rowNodes = Array.from(doc.getElementsByTagName('Row'));
    for (const rowNode of rowNodes) {
      const cells = Array.from(rowNode.getElementsByTagName('Data')).map((d) =>
        (d.textContent || '').trim()
      );
      if (cells.some(Boolean)) {
        matrix.push(cells);
      }
    }
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    matrix = lines.map((line) => splitCsvLine(line, delimiter));
  }

  if (matrix.length === 0) return [];

  // Detect header row
  const firstRowLower = matrix[0].map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const hasHeader =
    firstRowLower.includes('name') ||
    firstRowLower.includes('itemname') ||
    firstRowLower.includes('mrp') ||
    firstRowLower.includes('sellingprice');

  const headerMap: Record<string, number> = {};
  if (hasHeader) {
    firstRowLower.forEach((h, idx) => {
      headerMap[h] = idx;
    });
  }

  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  const findCol = (aliases: string[], fallbackIndex: number): number => {
    if (!hasHeader) return fallbackIndex;
    for (const alias of aliases) {
      if (typeof headerMap[alias] === 'number') return headerMap[alias];
    }
    return -1;
  };

  const nameIdx = findCol(['name', 'itemname', 'product', 'productname', 'item'], 0);
  const catIdx = findCol(['category', 'cat'], 1);
  const unitIdx = findCol(['unit', 'uom'], 2);
  const mrpIdx = findCol(['mrp'], 3);
  const sellIdx = findCol(['sellingprice', 'selling', 'price', 'rate'], 4);
  const buyIdx = findCol(['buyingprice', 'buying', 'cost', 'costprice'], 5);
  const taxIdx = findCol(['taxrate', 'tax', 'gst'], 6);
  const stockIdx = findCol(['stockqty', 'stock', 'qty', 'quantity'], 7);
  const alertIdx = findCol(['lowstockthreshold', 'lowstockalert', 'lowstock', 'minstock'], 8);
  const barcodeIdx = findCol(['barcode', 'code'], 9);

  const parsed: ParsedImportItem[] = [];
  for (const row of dataRows) {
    const rawName = (nameIdx >= 0 ? row[nameIdx] : row[0] || '').trim();
    if (!rawName) continue;

    const rawBarcode = (barcodeIdx >= 0 ? row[barcodeIdx] : '').trim().toUpperCase();
    const numMrp = Math.max(0, Number(mrpIdx >= 0 ? row[mrpIdx] : 0) || 0);
    const numSell = Math.max(0, Number(sellIdx >= 0 ? row[sellIdx] : numMrp) || 0);
    const numBuy = Math.max(0, Number(buyIdx >= 0 ? row[buyIdx] : 0) || 0);

    parsed.push({
      name: rawName,
      category: (catIdx >= 0 ? row[catIdx] : '').trim() || 'General',
      unit: (unitIdx >= 0 ? row[unitIdx] : '').trim() || 'pcs',
      mrp: numMrp,
      selling_price: numSell,
      buying_price: numBuy,
      tax_rate: Math.max(0, Math.min(100, Number(taxIdx >= 0 ? row[taxIdx] : 5) || 0)),
      stock_qty: Math.max(0, Math.floor(Number(stockIdx >= 0 ? row[stockIdx] : 10) || 0)),
      low_stock_threshold: Math.max(
        0,
        Math.floor(Number(alertIdx >= 0 ? row[alertIdx] : 10) || 10)
      ),
      barcode: rawBarcode || generateItemBarcode(rawName, 'letters'),
    });
  }

  return parsed;
}
