import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '../lib/supabaseClient.js';

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoStart = (date) => new Date(`${date}T00:00:00`).toISOString();
const toIsoNextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const buildArchiveReportHtml = (orders, filters) => {
  const rows = orders
    .map(
      (order) => `
        <tr>
          <td>${order.orderId}</td>
          <td>${order.customerName || '—'}</td>
          <td>${formatCurrency(order.totalAmount)}</td>
          <td>${order.status}</td>
          <td>${order.paymentMethod || '—'}</td>
          <td>${formatDateTime(order.createdAt)}</td>
          <td>${formatDateTime(order.archivedAt)}</td>
          <td>${order.archiveReason || '—'}</td>
        </tr>
      `
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>Archived Orders Report</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
          .report { max-width: 1120px; margin: 0 auto; }
          h1 { margin: 0; font-size: 28px; }
          .subtitle { margin: 6px 0 0; color: #475569; font-size: 14px; }
          .meta { margin: 18px 0 20px; color: #334155; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
          .meta-item { font-size: 13px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; word-break: break-word; }
          th { background: #f8fafc; }
          td:nth-child(3), th:nth-child(3) { text-align: right; }
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { padding: 0; }
            .report { max-width: none; }
            th, td { font-size: 11px; padding: 6px; }
          }
          @media (max-width: 768px) {
            body { padding: 12px; }
            h1 { font-size: 22px; }
            .meta { grid-template-columns: 1fr; }
            th, td { font-size: 11px; }
          }
        </style>
      </head>
      <body>
        <div class="report">
          <h1>Archived Orders Report</h1>
          <p class="subtitle">FoodiefyCo Archive Summary</p>
          <div class="meta">
            <div class="meta-item"><strong>Start Date:</strong> ${filters.startDate || '—'}</div>
            <div class="meta-item"><strong>End Date:</strong> ${filters.endDate || '—'}</div>
            <div class="meta-item"><strong>Status:</strong> ${filters.status || 'all'}</div>
            <div class="meta-item"><strong>Date Type:</strong> ${filters.dateType === 'created' ? 'Ordered Date' : 'Archived Date'}</div>
            <div class="meta-item"><strong>Total Rows:</strong> ${orders.length}</div>
            <div class="meta-item"><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Ordered</th>
                <th>Archived</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="8">No archived orders found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

const buildArchiveCsv = (orders) => {
  const header = [
    'Order ID',
    'Customer',
    'Total',
    'Status',
    'Payment Method',
    'Payment Status',
    'Ordered Date',
    'Archived Date',
    'Reason',
  ];

  const escapeCsv = (value) => {
    const text = String(value ?? '');
    const escaped = text.replaceAll('"', '""');
    return `"${escaped}"`;
  };

  const lines = orders.map((order) => [
    order.orderId,
    order.customerName || '',
    Number(order.totalAmount || 0).toFixed(2),
    order.status || '',
    order.paymentMethod || '',
    order.paymentStatus || '',
    formatDateTime(order.createdAt),
    formatDateTime(order.archivedAt),
    order.archiveReason || '',
  ]);

  return [header, ...lines]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
};

export default function ArchivePage() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    dateType: 'archived',
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchArchivedOrders = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          customer_name,
          total_amount,
          status,
          payment_method,
          payment_status,
          payment_proof_path,
          payment_proof_option,
          archived_at,
          archived_by,
          archive_reason,
          is_archived
        `)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      const dateColumn = activeFilters.dateType === 'created' ? 'created_at' : 'archived_at';

      if (activeFilters.startDate) {
        query = query.gte(dateColumn, toIsoStart(activeFilters.startDate));
      }

      if (activeFilters.endDate) {
        query = query.lt(dateColumn, toIsoNextDay(activeFilters.endDate));
      }

      if (activeFilters.status !== 'all') {
        query = query.eq('status', activeFilters.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const normalized = (data || []).map((order) => ({
        orderId: order.id,
        createdAt: order.created_at,
        archivedAt: order.archived_at,
        archivedBy: order.archived_by || '',
        archiveReason: order.archive_reason || '',
        customerName: order.customer_name || '',
        totalAmount: Number(order.total_amount || 0),
        status: String(order.status || 'pending').toLowerCase(),
        paymentMethod: order.payment_method || '',
        paymentStatus: order.payment_status || '',
        paymentProofPath: order.payment_proof_path || '',
        paymentProofOption: order.payment_proof_option || '',
      }));

      setOrders(normalized);
    } catch (err) {
      setOrders([]);
      setError(err?.message || 'Failed to fetch archived orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = formatDateInput(new Date());
    const initialFilters = {
      startDate: '',
      endDate: '',
      status: 'all',
      dateType: 'archived',
    };
    setFilters(initialFilters);
    fetchArchivedOrders(initialFilters);
  }, []);

  useEffect(() => {
    const validIds = new Set(orders.map((order) => order.orderId));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [orders]);

  const allVisibleSelected = useMemo(
    () => orders.length > 0 && orders.every((order) => selectedIds.includes(order.orderId)),
    [orders, selectedIds]
  );

  const selectedVisibleCount = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.orderId)).length,
    [orders, selectedIds]
  );

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleFetch = async () => {
    await fetchArchivedOrders(filters);
  };

  const toggleSelected = (orderId) => {
    setSelectedIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !orders.some((order) => order.orderId === id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...orders.map((order) => order.orderId)])));
  };

  const unarchiveByIds = async (ids) => {
    if (!ids.length) {
      setError('No archived orders selected.');
      return;
    }

    setWorking(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .in('id', ids);

      if (updateError) throw updateError;

      setSuccessMessage(`${ids.length} archived order(s) restored.`);
      setSelectedIds([]);
      await fetchArchivedOrders(filters);
    } catch (err) {
      setError(err?.message || 'Failed to restore archived orders.');
    } finally {
      setWorking(false);
    }
  };

  const clearArchiveByIds = async (ids, label) => {
    if (!ids.length) {
      setError(`No archived orders found for ${label}.`);
      return;
    }

    const confirmed = window.confirm(
      `This will permanently delete ${ids.length} archived order(s). This cannot be undone. Continue?`
    );
    if (!confirmed) return;

    setWorking(true);
    setError('');
    setSuccessMessage('');

    try {
      // Delete dependent order_items first if they exist.
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', ids);

      if (itemsError) {
        throw itemsError;
      }

      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;

      setSuccessMessage(`${ids.length} archived order(s) permanently deleted.`);
      setSelectedIds([]);
      await fetchArchivedOrders(filters);
    } catch (err) {
      setError(err?.message || 'Failed to clear archived orders.');
    } finally {
      setWorking(false);
    }
  };

  const handleUnarchiveSelected = async () => {
    await unarchiveByIds(selectedIds);
  };

  const handleUnarchiveSingle = async (orderId) => {
    await unarchiveByIds([orderId]);
  };

  const handleClearSelected = async () => {
    await clearArchiveByIds(selectedIds, 'selected rows');
  };

  const handleClearFiltered = async () => {
    await clearArchiveByIds(orders.map((order) => order.orderId), 'the current filtered result');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1300,height=900');
    if (!printWindow) return;

    printWindow.document.write(buildArchiveReportHtml(orders, filters));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.text('FoodiefyCo - Archived Orders Report', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    doc.text(`Rows: ${orders.length}`, 14, 25);
    doc.text(`Date Type: ${filters.dateType === 'created' ? 'Ordered Date' : 'Archived Date'}`, 60, 25);

    const head = [['ID', 'Customer', 'Total', 'Status', 'Payment', 'Ordered', 'Archived', 'Reason']];
    const body = orders.map((order) => [
      order.orderId,
      order.customerName || '—',
      formatCurrency(order.totalAmount),
      order.status,
      order.paymentMethod || '—',
      formatDateTime(order.createdAt),
      formatDateTime(order.archivedAt),
      order.archiveReason || '—',
    ]);

    doc.autoTable({
      head,
      body,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 30 },
        2: { halign: 'right', cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 35 },
        6: { cellWidth: 35 },
        7: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 5);
      },
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    doc.save(`archived-orders-${dateStamp}.pdf`);
  };

  const handleExportExcel = () => {
    if (!orders.length) {
      setError('No archived orders to export.');
      return;
    }

    const csv = buildArchiveCsv(orders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `archived-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:px-0">
      <div className="mx-auto max-w-7xl print:max-w-none">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Archive - Orders</h1>
            <p className="mt-1 text-slate-600">
              Manage archived completed and cancelled orders.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              Back to Admin
            </Link>
            <button
              onClick={handlePrint}
              className="rounded-lg bg-slate-700 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
            >
              Print
            </button>
            <Link
              to="/"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Front Store
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 print:hidden">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-green-700 print:hidden">
            {successMessage}
          </div>
        )}

        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Date Type</label>
              <select
                value={filters.dateType}
                onChange={(e) => handleFilterChange('dateType', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="archived">Archived Date</option>
                <option value="created">Ordered Date</option>
              </select>
            </div>

            <button
              onClick={handleFetch}
              className="self-end rounded-lg bg-slate-800 px-4 py-2.5 font-semibold text-white hover:bg-slate-900"
            >
              Refresh
            </button>

            <button
              onClick={toggleSelectAllVisible}
              className="self-end rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
            >
              {allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleUnarchiveSelected}
              disabled={!selectedIds.length || working}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Unarchive Selected ({selectedIds.length})
            </button>

            <button
              onClick={handleClearSelected}
              disabled={!selectedIds.length || working}
              className="rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Clear Selected ({selectedIds.length})
            </button>

            <button
              onClick={handleClearFiltered}
              disabled={!orders.length || working}
              className="rounded-lg bg-red-800 px-4 py-2.5 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Clear Filtered ({orders.length})
            </button>

            <button
              onClick={handleExportPdf}
              className="rounded-lg bg-fuchsia-600 px-4 py-2.5 font-semibold text-white hover:bg-fuchsia-700"
            >
              Export to PDF
            </button>

            <button
              onClick={handleExportExcel}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
            >
              Export Excel/CSV
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-600 print:hidden">
          Showing <strong>{orders.length}</strong> archived order(s). Selected visible rows: <strong>{selectedVisibleCount}</strong>.
        </div>

        <div className="space-y-4 lg:hidden print:hidden">
          {loading ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">Loading archived orders...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
              No archived orders found.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.orderId} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Archived Order
                    </p>
                    <p className="mt-1 break-all font-semibold text-slate-900">{order.orderId}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.orderId)}
                    onChange={() => toggleSelected(order.orderId)}
                    className="mt-1 h-4 w-4"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                    <p className="mt-1 font-semibold text-slate-900">{order.customerName || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                    <p className="mt-1 font-semibold capitalize text-slate-900">{order.status}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
                    <p className="mt-1 font-semibold text-slate-900">{order.paymentMethod || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Ordered</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Archived</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDateTime(order.archivedAt)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Reason</p>
                    <p className="mt-1 font-semibold text-slate-900">{order.archiveReason || '—'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUnarchiveSingle(order.orderId)}
                    disabled={working}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    Unarchive
                  </button>
                  <button
                    onClick={() => clearArchiveByIds([order.orderId], 'this row')}
                    disabled={working}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:bg-slate-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm lg:block print:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th className="px-3 py-3 text-center print:hidden">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Total</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Payment</th>
                <th className="px-3 py-3 text-left">Proof / QR</th>
                <th className="px-3 py-3 text-left">Ordered</th>
                <th className="px-3 py-3 text-left">Archived</th>
                <th className="px-3 py-3 text-left">Reason</th>
                <th className="px-3 py-3 text-left print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-slate-500">
                    Loading archived orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-slate-500">
                    No archived orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.orderId} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3 print:hidden">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.orderId)}
                        onChange={() => toggleSelected(order.orderId)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-3 break-all">{order.orderId}</td>
                    <td className="px-3 py-3">{order.customerName || '—'}</td>
                    <td className="px-3 py-3">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded bg-rose-50 px-2 py-1 capitalize text-rose-700">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{order.paymentMethod || '—'}</td>
                    <td className="px-3 py-3">
                      {order.paymentProofPath ? (
                        <a
                          href={order.paymentProofPath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View proof
                        </a>
                      ) : (
                        <span className="text-slate-400">
                          {order.paymentMethod?.toUpperCase() === 'COD' ? 'None' : 'None'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">{formatDateTime(order.createdAt)}</td>
                    <td className="px-3 py-3">{formatDateTime(order.archivedAt)}</td>
                    <td className="px-3 py-3">{order.archiveReason || '—'}</td>
                    <td className="px-3 py-3 print:hidden">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleUnarchiveSingle(order.orderId)}
                          disabled={working}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                        >
                          Unarchive
                        </button>
                        <button
                          onClick={() => clearArchiveByIds([order.orderId], 'this row')}
                          disabled={working}
                          className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:bg-slate-300"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
