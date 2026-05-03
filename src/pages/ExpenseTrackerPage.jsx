import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import AdminThemeSwitcher from '../components/AdminThemeSwitcher';
import { supabase } from '../lib/supabaseClient.js';

const STORAGE_KEY = 'foodiefy-expense-tracker-v1';
const MAX_EXPENSE_ROWS = 50;
const CATEGORY_OPTIONS = ['ingredients', 'labor', 'packaging', 'utilities', 'delivery', 'misc'];

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value) =>
  `P${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toIsoStart = (date) => new Date(`${date}T00:00:00`).toISOString();
const toIsoNextDay = (date) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const asDate = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00`);

const getWeekRangeFromDate = (yyyyMmDd) => {
  const date = asDate(yyyyMmDd);
  const day = date.getDay();
  const mondayShift = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - mondayShift);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDateInput(start), end: formatDateInput(end) };
};

const getMonthRangeFromDate = (yyyyMmDd) => {
  const date = asDate(yyyyMmDd);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDateInput(start), end: formatDateInput(end) };
};

const inIsoDateRange = (dateKey, start, end) => dateKey >= start && dateKey <= end;

const getMonthGrid = (visibleMonth) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const mondayBasedFirstDay = (firstDay.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < mondayBasedFirstDay; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);
  return cells;
};

export default function ExpenseTrackerPage() {
  const [currentFundsInput, setCurrentFundsInput] = useState('');
  const [savedFunds, setSavedFunds] = useState(0);
  const [expenseItem, setExpenseItem] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDateInput(new Date()));
  const [expenseCategory, setExpenseCategory] = useState('misc');
  const [expenses, setExpenses] = useState([]);
  const [expenseHistory, setExpenseHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pendingClear, setPendingClear] = useState(null);
  const [showSalesFundsModal, setShowSalesFundsModal] = useState(false);
  const [salesFundsRange, setSalesFundsRange] = useState(() => {
    const today = formatDateInput(new Date());
    return { startDate: today, endDate: today };
  });
  const [salesFundsLoading, setSalesFundsLoading] = useState(false);
  const [salesFundsResult, setSalesFundsResult] = useState({ amount: 0, count: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const loadedFunds = Number(parsed?.savedFunds || 0);
      const loadedExpenses = Array.isArray(parsed?.expenses)
        ? parsed.expenses.slice(0, MAX_EXPENSE_ROWS)
        : [];
      const loadedHistory = Array.isArray(parsed?.expenseHistory)
        ? parsed.expenseHistory
        : loadedExpenses;
      const loadedLogs = Array.isArray(parsed?.auditLogs) ? parsed.auditLogs : [];
      setSavedFunds(loadedFunds);
      setCurrentFundsInput(loadedFunds ? String(loadedFunds) : '');
      setExpenses(loadedExpenses);
      setExpenseHistory(loadedHistory);
      setAuditLogs(loadedLogs);
    } catch {
      // Keep defaults when storage is invalid.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedFunds,
        expenses,
        expenseHistory,
        auditLogs,
      })
    );
  }, [savedFunds, expenses, expenseHistory, auditLogs]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses]
  );

  const historyTotal = useMemo(
    () => expenseHistory.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenseHistory]
  );

  const byDateTotal = useMemo(() => {
    const map = {};
    expenseHistory.forEach((row) => {
      map[row.date] = (map[row.date] || 0) + Number(row.amount || 0);
    });
    return map;
  }, [expenseHistory]);

  const selectedDateRows = useMemo(
    () => expenseHistory.filter((row) => row.date === selectedDate),
    [expenseHistory, selectedDate]
  );

  const selectedDateTotal = useMemo(
    () => selectedDateRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [selectedDateRows]
  );

  const weekRange = useMemo(() => getWeekRangeFromDate(selectedDate), [selectedDate]);
  const monthRange = useMemo(() => getMonthRangeFromDate(selectedDate), [selectedDate]);

  const thisWeekTotal = useMemo(
    () =>
      expenseHistory
        .filter((row) => inIsoDateRange(row.date, weekRange.start, weekRange.end))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenseHistory, weekRange.end, weekRange.start]
  );

  const thisMonthTotal = useMemo(
    () =>
      expenseHistory
        .filter((row) => inIsoDateRange(row.date, monthRange.start, monthRange.end))
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenseHistory, monthRange.end, monthRange.start]
  );

  const monthlyRows = useMemo(
    () => expenseHistory.filter((row) => inIsoDateRange(row.date, monthRange.start, monthRange.end)),
    [expenseHistory, monthRange.end, monthRange.start]
  );

  const averagePerDayThisMonth = useMemo(() => {
    if (!monthlyRows.length) return 0;
    const uniqueDays = new Set(monthlyRows.map((row) => row.date)).size;
    return uniqueDays ? thisMonthTotal / uniqueDays : 0;
  }, [monthlyRows, thisMonthTotal]);

  const highestDayThisMonth = useMemo(() => {
    const totals = {};
    monthlyRows.forEach((row) => {
      totals[row.date] = (totals[row.date] || 0) + Number(row.amount || 0);
    });
    let best = { date: '-', total: 0 };
    Object.entries(totals).forEach(([date, total]) => {
      if (total > best.total) best = { date, total };
    });
    return best;
  }, [monthlyRows]);

  const categoryTotalsThisMonth = useMemo(() => {
    const totals = {};
    CATEGORY_OPTIONS.forEach((cat) => {
      totals[cat] = 0;
    });
    monthlyRows.forEach((row) => {
      const category = row.category || 'misc';
      totals[category] = (totals[category] || 0) + Number(row.amount || 0);
    });
    return totals;
  }, [monthlyRows]);

  const calendarCells = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);

  const remainingFunds = savedFunds - totalExpenses;

  const handleSaveFunds = () => {
    const amount = Number(currentFundsInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Please enter a valid fund amount.');
      setMessage('');
      return;
    }
    setSavedFunds(amount);
    setError('');
    setMessage('Current funds saved.');
  };

  const handleComputeSalesFunds = async () => {
    const { startDate, endDate } = salesFundsRange;
    if (!startDate || !endDate) {
      setError('Please select a valid start and end date.');
      setMessage('');
      return;
    }
    if (startDate > endDate) {
      setError('Start date cannot be later than end date.');
      setMessage('');
      return;
    }

    setSalesFundsLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id,total_amount,status,payment_status,created_at')
        .gte('created_at', toIsoStart(startDate))
        .lt('created_at', toIsoNextDay(endDate))
        .ilike('status', 'completed')
        .ilike('payment_status', 'paid');

      if (fetchError) throw fetchError;

      const rows = data || [];
      const amount = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
      setSalesFundsResult({ amount, count: rows.length });
    } catch (err) {
      setSalesFundsResult({ amount: 0, count: 0 });
      setError(err?.message || 'Failed to load paid and completed sales.');
    } finally {
      setSalesFundsLoading(false);
    }
  };

  const handleApplySalesFunds = () => {
    const addAmount = Number(salesFundsResult.amount || 0);
    if (!Number.isFinite(addAmount) || addAmount <= 0) {
      setError('No sales amount to add. Please compute first.');
      setMessage('');
      return;
    }

    const updated = Number(savedFunds || 0) + addAmount;
    setSavedFunds(updated);
    setCurrentFundsInput(String(updated));
    setShowSalesFundsModal(false);
    setError('');
    setMessage(`Added ${formatCurrency(addAmount)} from paid + completed sales and saved current funds.`);
  };

  const handleClearAll = () => {
    setCurrentFundsInput('');
    setSavedFunds(0);
    setExpenseItem('');
    setExpenseAmount('');
    setExpenseDate(formatDateInput(new Date()));
    setExpenseCategory('misc');
    setExpenses([]);
    setExpenseHistory([]);
    setAuditLogs([]);
    setError('');
    setMessage('All tracker data was reset.');
  };

  const handleClearExpenses = () => {
    setExpenses([]);
    setError('');
    setMessage('Expenses list cleared.');
  };

  const handleAddExpense = () => {
    if (expenses.length >= MAX_EXPENSE_ROWS) {
      setError(`Maximum ${MAX_EXPENSE_ROWS} expense rows reached.`);
      setMessage('');
      return;
    }

    const amount = Number(expenseAmount);
    const item = expenseItem.trim();

    if (!item) {
      setError('Please enter an expense item.');
      setMessage('');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid expense amount.');
      setMessage('');
      return;
    }

    const row = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      item,
      amount,
      category: expenseCategory || 'misc',
      date: expenseDate || formatDateInput(new Date()),
      createdAt: new Date().toISOString(),
    };

    setExpenses((prev) => [...prev, row]);
    setExpenseHistory((prev) => [...prev, row]);

    setExpenseItem('');
    setExpenseAmount('');
    setError('');
    setMessage('Expense added.');
  };

  const handleRemoveExpense = (id) => {
    setExpenses((prev) => prev.filter((row) => row.id !== id));
    setMessage('Removed from current list only. History is preserved for calendar tracking.');
  };

  const handleRequestClearHistory = (scope) => {
    const range = scope === 'week' ? weekRange : monthRange;
    const count = expenseHistory.filter((row) => inIsoDateRange(row.date, range.start, range.end)).length;
    setPendingClear({
      scope,
      start: range.start,
      end: range.end,
      count,
    });
  };

  const handleConfirmClearHistory = () => {
    if (!pendingClear) return;

    const { start, end, scope, count } = pendingClear;
    setExpenseHistory((prev) => prev.filter((row) => !inIsoDateRange(row.date, start, end)));
    setExpenses((prev) => prev.filter((row) => !inIsoDateRange(row.date, start, end)));
    setAuditLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        action: `clear_${scope}`,
        start,
        end,
        removedCount: count,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 30));

    setPendingClear(null);
    setError('');
    setMessage(`Cleared ${count} row(s) from ${scope} range (${start} to ${end}).`);
  };

  const handleExportCsv = () => {
    if (!expenseHistory.length) {
      setError('No expense rows to export.');
      setMessage('');
      return;
    }

    const lines = [
      ['Date', 'Item', 'Category', 'Amount'],
      ...expenseHistory.map((row) => [
        row.date,
        row.item,
        row.category || 'misc',
        Number(row.amount).toFixed(2),
      ]),
      ['', 'History Total Expenses', historyTotal.toFixed(2)],
      ['', 'Current Funds', Number(savedFunds || 0).toFixed(2)],
      ['', 'Remaining Funds', Number(remainingFunds || 0).toFixed(2)],
    ];

    const csv = lines
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-tracker-${formatDateInput(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!expenseHistory.length) {
      setError('No expense rows to export.');
      setMessage('');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.text('FoodiefyCo - Expense Tracker', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    doc.text(`Rows: ${expenseHistory.length}`, 14, 25);

    doc.autoTable({
      startY: 30,
      head: [['Date', 'Item', 'Category', 'Amount']],
      body: expenseHistory.map((row) => [
        row.date,
        row.item,
        row.category || 'misc',
        formatCurrency(row.amount),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 80 },
        2: { cellWidth: 30 },
        3: { halign: 'right', cellWidth: 40 },
      },
    });

    const lastY = doc.lastAutoTable?.finalY || 30;
    doc.setFontSize(10);
    doc.text(`History Total Expenses: ${formatCurrency(historyTotal)}`, 14, lastY + 8);
    doc.text(`Current Funds: ${formatCurrency(savedFunds)}`, 14, lastY + 14);
    doc.text(`Remaining Funds: ${formatCurrency(remainingFunds)}`, 14, lastY + 20);

    doc.save(`expense-tracker-${formatDateInput(new Date())}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500">FoodiefyCo Admin</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Expense Tracker</h1>
            <p className="mt-1 text-sm text-slate-600">Track operating expenses and compare against your current funds.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Back to Admin
            </Link>
            <button
              type="button"
              onClick={handleClearExpenses}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Clear Current List
            </button>
            <AdminThemeSwitcher />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Expense Calendar</h2>
                <span className="text-xs font-semibold text-slate-500">
                  {calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Next
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarCells.map((day, idx) => {
                  if (!day) {
                    return <div key={`blank-${idx}`} className="h-12 rounded-md bg-slate-50" />;
                  }

                  const dateKey = formatDateInput(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                  );
                  const amount = byDateTotal[dateKey] || 0;
                  const isSelected = selectedDate === dateKey;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`h-12 rounded-md border text-left text-xs transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="px-1.5 pt-1 font-semibold">{day}</div>
                      {amount > 0 && (
                        <div className="truncate px-1.5 pb-1 text-[10px] font-semibold text-emerald-600">
                          {formatCurrency(amount)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Selected Date
                </p>
                <p className="text-sm font-semibold text-slate-900">{selectedDate}</p>
                <p className="text-sm text-slate-700">
                  Total: <strong>{formatCurrency(selectedDateTotal)}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Shows records from permanent history, even after clearing the current list.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestClearHistory('week')}
                  className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Clear Selected Week
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestClearHistory('month')}
                  className="rounded-lg bg-red-900 px-3 py-2 text-xs font-semibold text-white hover:bg-red-950"
                >
                  Clear Selected Month
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Current Funds</h2>
              <p className="mt-1 text-sm text-slate-500">Save the amount you want to track.</p>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Input Funds</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentFundsInput}
                  onChange={(e) => setCurrentFundsInput(e.target.value)}
                  placeholder="Enter current funds"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveFunds}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = formatDateInput(new Date());
                    setSalesFundsRange({ startDate: today, endDate: today });
                    setSalesFundsResult({ amount: 0, count: 0 });
                    setShowSalesFundsModal(true);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Add Funds from Sales
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Clear / Reset
                </button>
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Saved Current Funds</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(savedFunds)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Remaining Funds</h2>
              <p className="mt-1 text-sm text-slate-500">Current funds minus total from current list.</p>
              <p className="mt-4 text-3xl font-bold text-slate-900">{formatCurrency(remainingFunds)}</p>
              <p className="mt-2 text-sm text-slate-600">History Total: {formatCurrency(historyTotal)}</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent Clear Logs</h2>
              <p className="mt-1 text-sm text-slate-500">Audit trail for week/month clear actions.</p>
              <div className="mt-4 max-h-44 space-y-2 overflow-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">No clear actions yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {log.action === 'clear_week' ? 'Cleared week' : 'Cleared month'}: {log.removedCount} row(s)
                      </p>
                      <p>{log.start} to {log.end}</p>
                      <p>{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">This Week</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(thisWeekTotal)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">This Month</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(thisMonthTotal)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Avg / Active Day</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(averagePerDayThisMonth)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Highest Day</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{highestDayThisMonth.date}</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(highestDayThisMonth.total)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
              <p className="mt-1 text-sm text-slate-500">Add up to {MAX_EXPENSE_ROWS} expense rows.</p>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_170px_auto]">
                <input
                  type="text"
                  value={expenseItem}
                  onChange={(e) => setExpenseItem(e.target.value)}
                  placeholder="Expense item"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200">
                {expenses.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    No expenses yet.
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((row) => (
                          <tr key={row.id} className="border-t border-slate-200">
                            <td className="px-3 py-2 text-slate-700">{row.date}</td>
                            <td className="max-w-[280px] break-words px-3 py-2 text-slate-900">{row.item}</td>
                            <td className="px-3 py-2 capitalize text-slate-700">{row.category || 'misc'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(row.amount)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveExpense(row.id)}
                                className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current List Total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Category Breakdown (Selected Month)</h2>
              <p className="mt-1 text-sm text-slate-500">
                {monthRange.start} to {monthRange.end}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <div key={cat} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="capitalize text-slate-700">{cat}</span>
                    <strong className="text-slate-900">{formatCurrency(categoryTotalsThisMonth[cat] || 0)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Selected Date Records</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedDate} total: <strong>{formatCurrency(selectedDateTotal)}</strong>
              </p>
              <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-200">
                {selectedDateRows.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No expenses on this date.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-3 py-2 text-slate-900">{row.item}</td>
                          <td className="px-3 py-2 capitalize text-slate-700">{row.category || 'misc'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {pendingClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingClear(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirm Clear</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are clearing {pendingClear.count} record(s) from
              {' '}
              <strong>{pendingClear.scope}</strong>
              {' '}
              range.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {pendingClear.start} to {pendingClear.end}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This removes records from history and current list for this range only.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingClear(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearHistory}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Clear {pendingClear.scope}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSalesFundsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSalesFundsModal(false);
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Add Funds from Sales</h3>
            <p className="mt-2 text-sm text-slate-600">
              Select a date or date range, then compute total sales to add.
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Note: Only orders with status = completed and payment status = paid are included.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
                <input
                  type="date"
                  value={salesFundsRange.startDate}
                  onChange={(e) => setSalesFundsRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
                <input
                  type="date"
                  value={salesFundsRange.endDate}
                  onChange={(e) => setSalesFundsRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-600">Matched Orders: <strong>{salesFundsResult.count}</strong></p>
              <p className="mt-1 text-lg font-bold text-slate-900">Amount to Add: {formatCurrency(salesFundsResult.amount)}</p>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSalesFundsModal(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComputeSalesFunds}
                disabled={salesFundsLoading}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {salesFundsLoading ? 'Loading...' : 'Compute Sales'}
              </button>
              <button
                type="button"
                onClick={handleApplySalesFunds}
                disabled={salesFundsResult.amount <= 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add + Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
