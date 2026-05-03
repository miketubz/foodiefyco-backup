import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import AdminThemeSwitcher from '../components/AdminThemeSwitcher';

const STORAGE_KEY = 'foodiefy-expense-tracker-v1';
const MAX_EXPENSE_ROWS = 50;

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

export default function ExpenseTrackerPage() {
  const [currentFundsInput, setCurrentFundsInput] = useState('');
  const [savedFunds, setSavedFunds] = useState(0);
  const [expenseItem, setExpenseItem] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatDateInput(new Date()));
  const [expenses, setExpenses] = useState([]);
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
      setSavedFunds(loadedFunds);
      setCurrentFundsInput(loadedFunds ? String(loadedFunds) : '');
      setExpenses(loadedExpenses);
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
      })
    );
  }, [savedFunds, expenses]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses]
  );

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

  const handleClearAll = () => {
    setCurrentFundsInput('');
    setSavedFunds(0);
    setExpenseItem('');
    setExpenseAmount('');
    setExpenseDate(formatDateInput(new Date()));
    setExpenses([]);
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

    setExpenses((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        item,
        amount,
        date: expenseDate || formatDateInput(new Date()),
      },
    ]);

    setExpenseItem('');
    setExpenseAmount('');
    setError('');
    setMessage('Expense added.');
  };

  const handleRemoveExpense = (id) => {
    setExpenses((prev) => prev.filter((row) => row.id !== id));
  };

  const handleExportCsv = () => {
    if (!expenses.length) {
      setError('No expense rows to export.');
      setMessage('');
      return;
    }

    const lines = [
      ['Date', 'Item', 'Amount'],
      ...expenses.map((row) => [
        row.date,
        row.item,
        Number(row.amount).toFixed(2),
      ]),
      ['', 'Total Expenses', totalExpenses.toFixed(2)],
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
    if (!expenses.length) {
      setError('No expense rows to export.');
      setMessage('');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.text('FoodiefyCo - Expense Tracker', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    doc.text(`Rows: ${expenses.length}`, 14, 25);

    doc.autoTable({
      startY: 30,
      head: [['Date', 'Item', 'Amount']],
      body: expenses.map((row) => [
        row.date,
        row.item,
        formatCurrency(row.amount),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 100 },
        2: { halign: 'right', cellWidth: 40 },
      },
    });

    const lastY = doc.lastAutoTable?.finalY || 30;
    doc.setFontSize(10);
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 14, lastY + 8);
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
              Clear Expenses
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
              <p className="mt-1 text-sm text-slate-500">Current funds minus total expenses.</p>
              <p className="mt-4 text-3xl font-bold text-slate-900">{formatCurrency(remainingFunds)}</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
              <p className="mt-1 text-sm text-slate-500">Add up to {MAX_EXPENSE_ROWS} expense rows.</p>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_170px_auto]">
                <input
                  type="text"
                  value={expenseItem}
                  onChange={(e) => setExpenseItem(e.target.value)}
                  placeholder="Expense item"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
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
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((row) => (
                          <tr key={row.id} className="border-t border-slate-200">
                            <td className="px-3 py-2 text-slate-700">{row.date}</td>
                            <td className="max-w-[280px] break-words px-3 py-2 text-slate-900">{row.item}</td>
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
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Expenses</p>
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
          </section>
        </div>
      </div>
    </div>
  );
}
