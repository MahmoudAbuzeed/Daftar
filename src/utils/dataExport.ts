import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { formatCurrency } from './balance';

export type ExportFormat = 'csv' | 'pdf';

interface ExpenseRow {
  id: string;
  description: string;
  total_amount: number;
  currency: string;
  category: string | null;
  created_at: string;
  group_id: string;
  paid_by_user?: { display_name: string } | null;
  group?: { name: string } | null;
}

interface SettlementRow {
  id: string;
  amount: number;
  currency: string;
  method: string;
  created_at: string;
  paid_by_user?: { display_name: string } | null;
  paid_to_user?: { display_name: string } | null;
  group?: { name: string } | null;
}

export interface ExportData {
  generatedAt: string;
  userName: string;
  expenses: ExpenseRow[];
  settlements: SettlementRow[];
  totalSpent: number;
  totalSettled: number;
  byCategory: { name: string; amount: number }[];
}

/**
 * Fetch all data needed for an export, scoped to the user's groups.
 */
export async function fetchExportData(userId: string, userName: string): Promise<ExportData> {
  // Get all groups the user belongs to
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  const groupIds = (memberships || []).map((m: any) => m.group_id);

  if (groupIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      userName,
      expenses: [],
      settlements: [],
      totalSpent: 0,
      totalSettled: 0,
      byCategory: [],
    };
  }

  const [{ data: expenses }, { data: settlements }] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, description, total_amount, currency, category, created_at, group_id, paid_by_user:users!expenses_paid_by_fkey(display_name), group:groups(name)')
      .in('group_id', groupIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('id, amount, currency, method, created_at, paid_by_user:users!settlements_paid_by_fkey(display_name), paid_to_user:users!settlements_paid_to_fkey(display_name), group:groups(name)')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false }),
  ]);

  const exps = (expenses || []) as unknown as ExpenseRow[];
  const setts = (settlements || []) as unknown as SettlementRow[];

  const totalSpent = exps.reduce((sum, e) => sum + e.total_amount, 0);
  const totalSettled = setts.reduce((sum, s) => sum + s.amount, 0);

  const catMap = new Map<string, number>();
  for (const e of exps) {
    const cat = e.category || 'other';
    catMap.set(cat, (catMap.get(cat) || 0) + e.total_amount);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    generatedAt: new Date().toISOString(),
    userName,
    expenses: exps,
    settlements: setts,
    totalSpent,
    totalSettled,
    byCategory,
  };
}

/**
 * Escape a value for CSV.
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV document from the export data.
 */
export function buildCsv(data: ExportData): string {
  const lines: string[] = [];

  // Header section
  lines.push('Fifti Data Export');
  lines.push(`Generated,${csvEscape(new Date(data.generatedAt).toLocaleString())}`);
  lines.push(`User,${csvEscape(data.userName)}`);
  lines.push('');

  // Expenses
  lines.push('EXPENSES');
  lines.push(['Date', 'Group', 'Description', 'Category', 'Paid By', 'Amount', 'Currency'].join(','));
  for (const e of data.expenses) {
    lines.push(
      [
        csvEscape(new Date(e.created_at).toLocaleDateString()),
        csvEscape(e.group?.name || ''),
        csvEscape(e.description),
        csvEscape(e.category || ''),
        csvEscape(e.paid_by_user?.display_name || ''),
        csvEscape(e.total_amount.toFixed(2)),
        csvEscape(e.currency),
      ].join(','),
    );
  }
  lines.push('');

  // Settlements
  lines.push('SETTLEMENTS');
  lines.push(['Date', 'Group', 'From', 'To', 'Method', 'Amount', 'Currency'].join(','));
  for (const s of data.settlements) {
    lines.push(
      [
        csvEscape(new Date(s.created_at).toLocaleDateString()),
        csvEscape(s.group?.name || ''),
        csvEscape(s.paid_by_user?.display_name || ''),
        csvEscape(s.paid_to_user?.display_name || ''),
        csvEscape(s.method),
        csvEscape(s.amount.toFixed(2)),
        csvEscape(s.currency),
      ].join(','),
    );
  }
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push(`Total Spent,${data.totalSpent.toFixed(2)}`);
  lines.push(`Total Settled,${data.totalSettled.toFixed(2)}`);
  lines.push('');
  lines.push('BY CATEGORY');
  lines.push(['Category', 'Amount'].join(','));
  for (const c of data.byCategory) {
    lines.push([csvEscape(c.name), csvEscape(c.amount.toFixed(2))].join(','));
  }

  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build an HTML document for PDF rendering.
 */
export function buildPdfHtml(data: ExportData): string {
  const fmt = (n: number, c: string) => formatCurrency(n, c);
  const generatedDate = new Date(data.generatedAt).toLocaleString();

  const expenseRows = data.expenses
    .map(
      (e) => `
        <tr>
          <td>${escapeHtml(new Date(e.created_at).toLocaleDateString())}</td>
          <td>${escapeHtml(e.group?.name || '')}</td>
          <td>${escapeHtml(e.description)}</td>
          <td>${escapeHtml(e.category || '—')}</td>
          <td>${escapeHtml(e.paid_by_user?.display_name || '')}</td>
          <td class="amount">${escapeHtml(fmt(e.total_amount, e.currency))}</td>
        </tr>`,
    )
    .join('');

  const settlementRows = data.settlements
    .map(
      (s) => `
        <tr>
          <td>${escapeHtml(new Date(s.created_at).toLocaleDateString())}</td>
          <td>${escapeHtml(s.group?.name || '')}</td>
          <td>${escapeHtml(s.paid_by_user?.display_name || '')}</td>
          <td>${escapeHtml(s.paid_to_user?.display_name || '')}</td>
          <td>${escapeHtml(s.method)}</td>
          <td class="amount">${escapeHtml(fmt(s.amount, s.currency))}</td>
        </tr>`,
    )
    .join('');

  const categoryRows = data.byCategory
    .map(
      (c) => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td class="amount">${escapeHtml(c.amount.toFixed(2))}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 32px; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    font-size: 11px;
    line-height: 1.4;
  }
  h1 {
    font-size: 28px;
    margin: 0 0 4px 0;
    color: #0D9488;
    letter-spacing: -0.5px;
  }
  .meta {
    color: #6B7280;
    font-size: 11px;
    margin-bottom: 24px;
  }
  h2 {
    font-size: 14px;
    margin: 24px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #A67C00;
    border-bottom: 1px solid #E5E7EB;
    padding-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  th {
    text-align: left;
    background: #F9FAFB;
    padding: 8px 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6B7280;
    border-bottom: 1px solid #E5E7EB;
  }
  td {
    padding: 8px 6px;
    border-bottom: 1px solid #F3F4F6;
  }
  td.amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .summary {
    background: #F9FAFB;
    border-radius: 8px;
    padding: 16px;
    margin-top: 8px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 12px;
  }
  .summary-row strong {
    color: #0D9488;
  }
  .empty {
    color: #9CA3AF;
    font-style: italic;
    padding: 8px 0;
  }
</style>
</head>
<body>
  <h1>Fifti Data Export</h1>
  <div class="meta">
    Generated for <strong>${escapeHtml(data.userName)}</strong> on ${escapeHtml(generatedDate)}
  </div>

  <h2>Summary</h2>
  <div class="summary">
    <div class="summary-row"><span>Total expenses</span><strong>${escapeHtml(data.expenses.length.toString())}</strong></div>
    <div class="summary-row"><span>Total spent</span><strong>${escapeHtml(data.totalSpent.toFixed(2))}</strong></div>
    <div class="summary-row"><span>Total settled</span><strong>${escapeHtml(data.totalSettled.toFixed(2))}</strong></div>
  </div>

  <h2>Expenses (${data.expenses.length})</h2>
  ${
    data.expenses.length === 0
      ? '<div class="empty">No expenses found.</div>'
      : `<table>
          <thead>
            <tr>
              <th>Date</th><th>Group</th><th>Description</th><th>Category</th><th>Paid By</th><th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>${expenseRows}</tbody>
        </table>`
  }

  <h2>Settlements (${data.settlements.length})</h2>
  ${
    data.settlements.length === 0
      ? '<div class="empty">No settlements found.</div>'
      : `<table>
          <thead>
            <tr>
              <th>Date</th><th>Group</th><th>From</th><th>To</th><th>Method</th><th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>${settlementRows}</tbody>
        </table>`
  }

  ${
    data.byCategory.length > 0
      ? `<h2>By Category</h2>
         <table>
           <thead><tr><th>Category</th><th class="amount">Amount</th></tr></thead>
           <tbody>${categoryRows}</tbody>
         </table>`
      : ''
  }
</body>
</html>`;
}

/**
 * Generate a file from export data and open the share sheet.
 * Returns the URI of the generated file.
 */
export async function exportAndShare(
  data: ExportData,
  format: ExportFormat,
): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csv = buildCsv(data);
    const file = new File(Paths.cache, `fifti-export-${stamp}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Fifti Data Export',
        UTI: 'public.comma-separated-values-text',
      });
    }
    return file.uri;
  }

  // PDF
  const html = buildPdfHtml(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Fifti Data Export',
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}
