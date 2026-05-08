import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { generateOrdersCSV, downloadCSV } from '../utils/csvExport';
import AdminThemeSwitcher from './AdminThemeSwitcher';

const ARCHIVEABLE_STATUSES = new Set(['completed', 'cancelled']);

const PAYMENT_QR_MAP = {
  gcash: '/pix/gcash-qr.jpg',
  gotyme: '/pix/gotyme-qr.jpg',
  unionbank: '/pix/unionbank-qr.jpg',
};

const DEFAULT_PROMO_FORM = {
  code: '',
  discountType: 'fixed',
  discountValue: '',
  isActive: true,
  startsAt: '',
  endsAt: '',
};

const DELIVERY_RECEIPT_PRESETS = ['0', '40', '60', '80', '100'];
const ORDER_NOTES_STORAGE_KEY = 'foodiefy-admin-order-notes-v1';
const SALES_RANGE_DEFAULT_STORAGE_KEY = 'foodiefy-admin-sales-range-default-v1';
const SALES_RANGE_CUSTOM_STORAGE_KEY = 'foodiefy-admin-sales-range-custom-v1';
const SALES_RANGE_DEFAULT_KEY = 'admin_sales_range_default';
const SALES_RANGE_CUSTOM_KEY = 'admin_sales_range_custom';
const THANK_YOU_TITLE_KEY = 'thank_you_modal_title';
const THANK_YOU_BODY_KEY = 'thank_you_modal_body';
const LOCAL_THANK_YOU_TITLE_KEY = 'foodiefy-thankyou-title';
const LOCAL_THANK_YOU_BODY_KEY = 'foodiefy-thankyou-body';
const DEFAULT_THANK_YOU_CONTENT = {
  title: 'Thank you! We have received your order.',
  body: 'If you enjoyed our food, feel free to provide feedback on our page, and get a chance to win a promo code.',
};


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


const formatCurrency = (value) => `₱${Number(value || 0).toFixed(2)}`;

const isOrderTotalModified = (order) => {
  const itemTotal = (order.orderItems || []).reduce(
    (sum, item) => sum + Number(item.subtotal || Number(item.quantity || 0) * Number(item.price || 0)),
    0
  );

  const subtotal = itemTotal || Number(order.totalAmount || 0) + Number(order.discountAmount || 0);
  const expectedTotal = Math.max(0, subtotal - Number(order.discountAmount || 0));
  const currentTotal = Number(order.totalAmount || 0);

  return Math.abs(currentTotal - expectedTotal) > 0.009;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildReceiptHtml = (order, options = {}) => {
  const deliveryCharge = Math.max(0, Number(options.deliveryCharge || 0));
  const itemRows = (order.orderItems || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name || 'Item')}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(item.quantity || 0)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.subtotal)}</td>
        </tr>
      `
    )
    .join('');

  const itemTotal = (order.orderItems || []).reduce(
    (sum, item) => sum + Number(item.subtotal || Number(item.quantity || 0) * Number(item.price || 0)),
    0
  );

  const subtotal = itemTotal || Number(order.totalAmount || 0) + Number(order.discountAmount || 0);
  const sellerTotal = Number(order.totalAmount || 0);
  const receiptGrandTotal = sellerTotal + deliveryCharge;
  const isModifiedTotal = isOrderTotalModified(order);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${escapeHtml(order.orderId)}</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 24px;
            background: #ffffff;
          }
          .receipt {
            max-width: 760px;
            margin: 0 auto;
          }
          .muted {
            color: #6b7280;
          }
          .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 20px;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            text-align: left;
            background: #f3f4f6;
            padding: 10px 8px;
            border-bottom: 1px solid #d1d5db;
          }
          .totals {
            margin-left: auto;
            max-width: 320px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
          }
          .totals-row.total {
            border-top: 2px solid #111827;
            margin-top: 8px;
            padding-top: 10px;
            font-weight: 700;
            font-size: 18px;
          }
          .toolbar {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-bottom: 16px;
          }
          .toolbar button {
            border: 0;
            border-radius: 999px;
            background: #111827;
            color: #ffffff;
            padding: 10px 16px;
            font-weight: 600;
            cursor: pointer;
          }
          .toolbar button.secondary {
            background: #e5e7eb;
            color: #111827;
          }
          @media print {
            body {
              padding: 0;
            }
            .toolbar {
              display: none;
            }
          }
          @media (max-width: 640px) {
            body {
              padding: 16px;
            }
            .meta-grid {
              grid-template-columns: 1fr;
            }
            th, td {
              font-size: 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="toolbar">
            <button type="button" onclick="window.print()">Print / Save PDF</button>
            <button type="button" class="secondary" onclick="window.close()">Close</button>
          </div>

          <div class="header">
            <h1 style="margin:0 0 8px;">FoodiefyCo Receipt</h1>
            <p class="muted" style="margin:0;">Customer order summary</p>
          </div>

          <div class="meta-grid">
            <div><strong>Order ID:</strong> ${escapeHtml(order.orderId)}</div>
            <div><strong>Date Ordered:</strong> ${escapeHtml(order.orderDate)}</div>
            <div><strong>Customer Name:</strong> ${escapeHtml(order.customerName)}</div>
            <div><strong>Contact Number:</strong> ${escapeHtml(order.phoneNumber)}</div>
            <div><strong>Payment Method:</strong> ${escapeHtml(order.paymentMethod)}</div>
            <div><strong>Payment Status:</strong> ${escapeHtml(order.paymentStatus)}</div>
            <div><strong>Source:</strong> ${escapeHtml(order.orderSource)}</div>
            <div><strong>Status:</strong> ${escapeHtml(order.status)}</div>
            <div><strong>Delivery Address:</strong> ${escapeHtml(order.deliveryAddress)}</div>
            <div><strong>Promo Code:</strong> ${escapeHtml(order.promoCode || 'None')}</div>
          </div>

          <div class="section">
            <h2 style="margin:0 0 10px;">Items Ordered</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Unit Price</th>
                  <th style="text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || '<tr><td colspan="4" style="padding:12px 8px;color:#6b7280;">No items found.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section totals">
            <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="totals-row"><span>Discount</span><span>-${formatCurrency(order.discountAmount)}</span></div>
            ${isModifiedTotal ? `<div class="totals-row"><span>Seller Price Total</span><span>${formatCurrency(sellerTotal)}</span></div>` : ''}
            ${deliveryCharge > 0 ? `<div class="totals-row"><span>Delivery Charge (3rd party)</span><span>${formatCurrency(deliveryCharge)}</span></div>` : ''}
            ${isModifiedTotal ? '<div class="totals-row"><span class="muted">Adjusted by seller</span><span class="muted">Yes</span></div>' : ''}
            <div class="totals-row total"><span>${deliveryCharge > 0 ? 'Amount Due' : (isModifiedTotal ? 'Seller Price Total' : 'Total')}</span><span>${formatCurrency(receiptGrandTotal)}</span></div>
          </div>

          <div class="section">
            <h2 style="margin:0 0 8px;">Special Instructions</h2>
            <p style="margin:0;line-height:1.6;">${escapeHtml(order.specialInstructions || 'None')}</p>
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
              }, 150);
            };
          </script>
        </div>
      </body>
    </html>
  `;
};

const normalizeSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source || source === 'website' || source === 'internal') return 'internal';
  if (source === 'external') return 'external';
  return source;
};

const normalizeText = (value, fallback = 'N/A') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const isArchiveSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('is_archived') || message.includes('archived_at') || message.includes('archive_reason') || message.includes('archived_by');
};

const isAppSettingsMissingError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('could not find the table') && message.includes('app_settings');
};

const SALES_RANGE_ALLOWED = new Set(['all', 'today', 'yesterday', 'week', 'lastMonth', 'custom']);

const getPublicProofUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('payment-proofs').getPublicUrl(path).data?.publicUrl || '';
};

const getPaymentQrPath = (method) => PAYMENT_QR_MAP[String(method || '').trim().toLowerCase()] || '';

const buildOrdersQuery = (activeFilters, withArchiveFields) => {
  const fields = withArchiveFields
    ? 'id, created_at, total_amount, status, payment_status, promo_code, discount_amount, order_source, payment_proof_option, payment_proof_path, customer_name, phone_number, delivery_address, special_instructions, payment_method, is_archived, archived_at, archived_by, archive_reason'
    : 'id, created_at, total_amount, status, payment_status, promo_code, discount_amount, order_source, payment_proof_option, payment_proof_path, customer_name, phone_number, delivery_address, special_instructions, payment_method';

  let query = supabase
    .from('orders')
    .select(fields)
    .order('created_at', { ascending: false });

  if (activeFilters.startDate) query = query.gte('created_at', toIsoStart(activeFilters.startDate));
  if (activeFilters.endDate) query = query.lt('created_at', toIsoNextDay(activeFilters.endDate));
  if (activeFilters.status !== 'all') query = query.eq('status', activeFilters.status);
  if (activeFilters.paymentStatus !== 'all') query = query.eq('payment_status', activeFilters.paymentStatus);

  if (activeFilters.source !== 'all') {
    if (activeFilters.source === 'external') {
      query = query.eq('order_source', 'external');
    } else {
      query = query.or('order_source.is.null,order_source.eq.internal,order_source.eq.website');
    }
  }

  if (withArchiveFields) {
    query = query.or('is_archived.is.null,is_archived.eq.false');
  }

  return query;
};

export const AdminPanel2 = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    paymentStatus: 'all',
    source: 'all',
  });
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [archiveSchemaReady, setArchiveSchemaReady] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [showPromoManager, setShowPromoManager] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [promoForm, setPromoForm] = useState(DEFAULT_PROMO_FORM);
  const [editingPromoId, setEditingPromoId] = useState(null);
  const [todaySalesSummary, setTodaySalesSummary] = useState({
    paidSales: 0,
    expectedSales: 0,
    paidCount: 0,
    expectedCount: 0,
  });
  const [salesRange, setSalesRange] = useState(() => {
    try {
      const raw = localStorage.getItem(SALES_RANGE_DEFAULT_STORAGE_KEY);
      return SALES_RANGE_ALLOWED.has(raw) ? raw : 'all';
    } catch {
      return 'all';
    }
  });
  const [customSalesRange, setCustomSalesRange] = useState(() => {
    try {
      const raw = localStorage.getItem(SALES_RANGE_CUSTOM_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        return {
          startDate: String(parsed.startDate || ''),
          endDate: String(parsed.endDate || ''),
        };
      }
    } catch {
      // Ignore invalid local storage data.
    }
    return { startDate: '', endDate: '' };
  });
  const [showSalesRangeModal, setShowSalesRangeModal] = useState(false);
  const [salesRangeDraft, setSalesRangeDraft] = useState({ startDate: '', endDate: '' });
  const [previousSales, setPreviousSales] = useState(0);
  const [showThankYouEditor, setShowThankYouEditor] = useState(false);
  const [savingThankYou, setSavingThankYou] = useState(false);
  const [thankYouTitleInput, setThankYouTitleInput] = useState(DEFAULT_THANK_YOU_CONTENT.title);
  const [thankYouBodyInput, setThankYouBodyInput] = useState(DEFAULT_THANK_YOU_CONTENT.body);
  const [deliveryReceiptDraft, setDeliveryReceiptDraft] = useState({
    open: false,
    order: null,
    amount: '0',
  });
  const [orderNotes, setOrderNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(ORDER_NOTES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [noteDraft, setNoteDraft] = useState({
    open: false,
    orderId: '',
    customerName: '',
    text: '',
    editing: false,
  });

  useEffect(() => {
    localStorage.setItem(ORDER_NOTES_STORAGE_KEY, JSON.stringify(orderNotes));
  }, [orderNotes]);

  useEffect(() => {
    localStorage.setItem(SALES_RANGE_DEFAULT_STORAGE_KEY, salesRange);
  }, [salesRange]);

  useEffect(() => {
    localStorage.setItem(SALES_RANGE_CUSTOM_STORAGE_KEY, JSON.stringify(customSalesRange));
  }, [customSalesRange]);

  const saveSalesRangePreference = async (nextRange, nextCustomRange) => {
    try {
      const payload = [
        { key: SALES_RANGE_DEFAULT_KEY, value: String(nextRange || 'all') },
        { key: SALES_RANGE_CUSTOM_KEY, value: JSON.stringify(nextCustomRange || { startDate: '', endDate: '' }) },
      ];

      const { error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) throw error;
    } catch (err) {
      if (!isAppSettingsMissingError(err)) {
        console.error('Failed to sync sales range preference:', err);
      }
    }
  };

  const loadSalesRangePreference = async () => {
    let localRange = 'all';
    let localCustom = { startDate: '', endDate: '' };

    try {
      const storedRange = localStorage.getItem(SALES_RANGE_DEFAULT_STORAGE_KEY);
      if (SALES_RANGE_ALLOWED.has(storedRange)) {
        localRange = storedRange;
      }

      const storedCustom = localStorage.getItem(SALES_RANGE_CUSTOM_STORAGE_KEY);
      const parsedCustom = storedCustom ? JSON.parse(storedCustom) : null;
      if (parsedCustom && typeof parsedCustom === 'object') {
        localCustom = {
          startDate: String(parsedCustom.startDate || ''),
          endDate: String(parsedCustom.endDate || ''),
        };
      }
    } catch {
      // Keep safe defaults if local parsing fails.
    }

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [SALES_RANGE_DEFAULT_KEY, SALES_RANGE_CUSTOM_KEY]);

      if (error) throw error;

      const settingsMap = Object.fromEntries((data || []).map((row) => [row.key, row.value]));

      const dbRangeRaw = String(settingsMap[SALES_RANGE_DEFAULT_KEY] || '').trim();
      const hasDbRange = SALES_RANGE_ALLOWED.has(dbRangeRaw);

      let dbCustom = localCustom;
      if (settingsMap[SALES_RANGE_CUSTOM_KEY]) {
        try {
          const parsed = JSON.parse(settingsMap[SALES_RANGE_CUSTOM_KEY]);
          if (parsed && typeof parsed === 'object') {
            dbCustom = {
              startDate: String(parsed.startDate || ''),
              endDate: String(parsed.endDate || ''),
            };
          }
        } catch {
          // Ignore malformed custom range setting.
        }
      }

      if (hasDbRange) {
        setCustomSalesRange(dbCustom);
        setSalesRange(dbRangeRaw);
        return;
      }

      setCustomSalesRange(localCustom);
      setSalesRange(localRange);

      if (SALES_RANGE_ALLOWED.has(localRange)) {
        await saveSalesRangePreference(localRange, localCustom);
      }
    } catch (err) {
      setCustomSalesRange(localCustom);
      setSalesRange(localRange);

      if (!isAppSettingsMissingError(err)) {
        console.error('Failed to load sales range preference:', err);
      }
    }
  };

  const handleSetSalesRange = (nextRange) => {
    setSalesRange(nextRange);
    void saveSalesRangePreference(nextRange, customSalesRange);
  };

  const loadThankYouContent = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [THANK_YOU_TITLE_KEY, THANK_YOU_BODY_KEY]);

      if (error) throw error;

      const settingsMap = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
      const title = settingsMap[THANK_YOU_TITLE_KEY] || localStorage.getItem(LOCAL_THANK_YOU_TITLE_KEY) || DEFAULT_THANK_YOU_CONTENT.title;
      const body = settingsMap[THANK_YOU_BODY_KEY] || localStorage.getItem(LOCAL_THANK_YOU_BODY_KEY) || DEFAULT_THANK_YOU_CONTENT.body;

      localStorage.setItem(LOCAL_THANK_YOU_TITLE_KEY, title);
      localStorage.setItem(LOCAL_THANK_YOU_BODY_KEY, body);
      setThankYouTitleInput(title);
      setThankYouBodyInput(body);
    } catch (err) {
      const title = localStorage.getItem(LOCAL_THANK_YOU_TITLE_KEY) || DEFAULT_THANK_YOU_CONTENT.title;
      const body = localStorage.getItem(LOCAL_THANK_YOU_BODY_KEY) || DEFAULT_THANK_YOU_CONTENT.body;
      setThankYouTitleInput(title);
      setThankYouBodyInput(body);

      if (!isAppSettingsMissingError(err) && err?.message) {
        setActionError(`Failed to load thank-you text from DB: ${err.message}`);
      }
    }
  };

  const handleSaveThankYouContent = async () => {
    const title = String(thankYouTitleInput || '').trim();
    const body = String(thankYouBodyInput || '').trim();

    if (!title || !body) {
      setActionError('Both thank-you title and body are required.');
      return;
    }

    setSavingThankYou(true);
    setActionError('');
    setSuccessMessage('');

    try {
      const payload = [
        { key: THANK_YOU_TITLE_KEY, value: title },
        { key: THANK_YOU_BODY_KEY, value: body },
      ];

      const { error } = await supabase
        .from('app_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) throw error;

      localStorage.setItem(LOCAL_THANK_YOU_TITLE_KEY, title);
      localStorage.setItem(LOCAL_THANK_YOU_BODY_KEY, body);
      setSuccessMessage('Thank-you modal text updated successfully.');
      setShowThankYouEditor(false);
    } catch (err) {
      localStorage.setItem(LOCAL_THANK_YOU_TITLE_KEY, title);
      localStorage.setItem(LOCAL_THANK_YOU_BODY_KEY, body);
      setSuccessMessage('Saved locally. Cloud sync is unavailable until the app_settings table is restored.');
      setShowThankYouEditor(false);
      if (err?.message && !isAppSettingsMissingError(err)) {
        setActionError(`DB settings save failed: ${err.message}`);
      }
    } finally {
      setSavingThankYou(false);
    }
  };

  useEffect(() => {
    const loadAdmin = async () => {
      const { data } = await supabase.auth.getUser();
      setAdminEmail(data?.user?.email || '');
    };

    loadAdmin();
    loadPromoCodes();
    loadSalesSummary();
    loadSalesRangePreference();
    loadThankYouContent();
  }, []);

  useEffect(() => {
    loadSalesSummary();
  }, [salesRange, customSalesRange.startDate, customSalesRange.endDate]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-sales-summary-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadSalesSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salesRange, customSalesRange.startDate, customSalesRange.endDate]);

  const loadPromoCodes = async () => {
    setPromoLoading(true);
    setPromoError('');

    try {
      const { data, error: promoLoadError } = await supabase
        .from('promo_codes')
        .select('id, code, discount_type, discount_value, is_active, starts_at, ends_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (promoLoadError) throw promoLoadError;
      setPromoCodes(data || []);
    } catch (err) {
      setPromoError(err?.message || 'Failed to load promo codes.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePromoInputChange = (field, value) => {
    setPromoForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetPromoForm = () => {
    setPromoForm(DEFAULT_PROMO_FORM);
    setEditingPromoId(null);
  };

  const loadSalesSummary = async () => {
    try {
      const { data, error: summaryError } = await supabase
        .from('orders')
        .select('total_amount, discount_amount, payment_status, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (summaryError) throw summaryError;

      const rows = (data || []).filter(
        (order) => String(order.status || '').toLowerCase() !== 'cancelled'
      );

      const today = new Date();
      const todayKey = formatDateInput(today);

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayKey = formatDateInput(yesterday);

      const currentRangeRows = rows.filter((order) => {
        const orderDateKey = formatDateInput(new Date(order.created_at));

        if (salesRange === 'all') {
          return true;
        }

        if (salesRange === 'custom') {
          if (!customSalesRange.startDate || !customSalesRange.endDate) return false;
          return orderDateKey >= customSalesRange.startDate && orderDateKey <= customSalesRange.endDate;
        }

        if (salesRange === 'today') {
          return orderDateKey === todayKey;
        }

        if (salesRange === 'yesterday') {
          return orderDateKey === yesterdayKey;
        }

        if (salesRange === 'lastMonth') {
          const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          const firstDayLastMonthKey = formatDateInput(firstDayLastMonth);
          const lastDayLastMonthKey = formatDateInput(lastDayLastMonth);
          return orderDateKey >= firstDayLastMonthKey && orderDateKey <= lastDayLastMonthKey;
        }

        const sevenDayStart = new Date();
        sevenDayStart.setDate(today.getDate() - 6);
        const sevenDayStartKey = formatDateInput(sevenDayStart);

        return orderDateKey >= sevenDayStartKey && orderDateKey <= todayKey;
      });

      const previousRangeRows = rows.filter((order) => {
        const orderDateKey = formatDateInput(new Date(order.created_at));

        if (salesRange === 'all') {
          return false;
        }

        if (salesRange === 'custom') {
          return false;
        }

        if (salesRange === 'today') {
          return orderDateKey === yesterdayKey;
        }

        if (salesRange === 'yesterday') {
          const previousDay = new Date();
          previousDay.setDate(today.getDate() - 2);
          const previousDayKey = formatDateInput(previousDay);
          return orderDateKey === previousDayKey;
        }

        if (salesRange === 'lastMonth') {
          const firstDayPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);
          const lastDayPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 0);
          const firstDayPreviousMonthKey = formatDateInput(firstDayPreviousMonth);
          const lastDayPreviousMonthKey = formatDateInput(lastDayPreviousMonth);
          return orderDateKey >= firstDayPreviousMonthKey && orderDateKey <= lastDayPreviousMonthKey;
        }

        const previousRangeEnd = new Date();
        previousRangeEnd.setDate(today.getDate() - 7);
        const previousRangeStart = new Date();
        previousRangeStart.setDate(today.getDate() - 13);

        const previousRangeStartKey = formatDateInput(previousRangeStart);
        const previousRangeEndKey = formatDateInput(previousRangeEnd);

        return orderDateKey >= previousRangeStartKey && orderDateKey <= previousRangeEndKey;
      });

      const paidRows = currentRangeRows.filter(
        (order) => String(order.payment_status || '').toLowerCase() === 'paid'
      );

      // `total_amount` is already the final payable amount in the orders table.
      // Do not subtract discount again, or summary cards will be lower than table totals.
      const getNetSales = (order) => Math.max(0, Number(order.total_amount || 0));

      const paidSales = paidRows.reduce(
        (sum, order) => sum + getNetSales(order),
        0
      );

      const expectedSales = currentRangeRows.reduce(
        (sum, order) => sum + getNetSales(order),
        0
      );

      const previousExpectedSales = previousRangeRows.reduce(
        (sum, order) => sum + getNetSales(order),
        0
      );

      const normalizedPreviousSales =
        salesRange === 'all' || salesRange === 'custom' ? expectedSales : previousExpectedSales;

      setTodaySalesSummary({
        paidSales,
        expectedSales,
        paidCount: paidRows.length,
        expectedCount: currentRangeRows.length,
      });

      setPreviousSales(normalizedPreviousSales);
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    }
  };

  const handleCreatePromoCode = async (e) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess('');

    const normalizedCode = String(promoForm.code || '').trim().toUpperCase();
    const discountValue = Number(promoForm.discountValue || 0);

    if (!normalizedCode) {
      setPromoError('Promo code is required.');
      return;
    }

    if (!discountValue || discountValue <= 0) {
      setPromoError('Discount value must be greater than zero.');
      return;
    }

    if (promoForm.discountType === 'percent' && discountValue > 100) {
      setPromoError('Percent discount cannot be more than 100.');
      return;
    }

    if (promoForm.startsAt && promoForm.endsAt && promoForm.startsAt > promoForm.endsAt) {
      setPromoError('End date must be on or after start date.');
      return;
    }

    setPromoSaving(true);

    try {
      const payload = {
        code: normalizedCode,
        discount_type: promoForm.discountType,
        discount_value: discountValue,
        is_active: Boolean(promoForm.isActive),
        starts_at: promoForm.startsAt ? new Date(`${promoForm.startsAt}T00:00:00`).toISOString() : null,
        ends_at: promoForm.endsAt ? new Date(`${promoForm.endsAt}T23:59:59`).toISOString() : null,
      };

      let dbError = null;

      if (editingPromoId) {
        const { error: updateError } = await supabase
          .from('promo_codes')
          .update(payload)
          .eq('id', editingPromoId);
        dbError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('promo_codes')
          .insert([payload]);
        dbError = insertError;
      }

      if (dbError) throw dbError;

      setPromoSuccess(
        editingPromoId
          ? `Promo code ${normalizedCode} updated successfully.`
          : `Promo code ${normalizedCode} created successfully.`
      );
      resetPromoForm();
      await loadPromoCodes();
    } catch (err) {
      setPromoError(err?.message || `Failed to ${editingPromoId ? 'update' : 'create'} promo code.`);
    } finally {
      setPromoSaving(false);
    }
  };

  const handleEditPromoCode = (promo) => {
    setPromoError('');
    setPromoSuccess('');
    setEditingPromoId(promo.id);
    setPromoForm({
      code: promo.code || '',
      discountType: promo.discount_type || 'fixed',
      discountValue: String(promo.discount_value ?? ''),
      isActive: Boolean(promo.is_active),
      startsAt: promo.starts_at ? String(promo.starts_at).slice(0, 10) : '',
      endsAt: promo.ends_at ? String(promo.ends_at).slice(0, 10) : '',
    });
    setShowPromoManager(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePromoCode = async (promo) => {
    const confirmed = window.confirm(`Delete promo code ${promo.code}? This cannot be undone.`);
    if (!confirmed) return;

    setPromoSaving(true);
    setPromoError('');
    setPromoSuccess('');

    try {
      const { error: deleteError } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', promo.id);

      if (deleteError) throw deleteError;

      if (editingPromoId === promo.id) {
        resetPromoForm();
      }

      setPromoSuccess(`Promo code ${promo.code} deleted successfully.`);
      await loadPromoCodes();
    } catch (err) {
      setPromoError(err?.message || 'Failed to delete promo code.');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleTogglePromoActive = async (promo) => {

    setPromoError('');
    setPromoSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('promo_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (updateError) throw updateError;

      setPromoSuccess(`Promo code ${promo.code} ${promo.is_active ? 'disabled' : 'enabled'}.`);
      await loadPromoCodes();
    } catch (err) {
      setPromoError(err?.message || 'Failed to update promo code.');
    }
  };

  const normalizeOrders = async (ordersData) => {
    const orderIds = (ordersData || []).map((o) => o.id);
    let itemsByOrder = {};

    if (orderIds.length > 0) {
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id, quantity, price, menu_item_id')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      const menuItemIds = [...new Set((orderItemsData || []).map((item) => item.menu_item_id).filter(Boolean))];
      let menuMap = {};

      if (menuItemIds.length > 0) {
        const { data: menuItemsData, error: menuError } = await supabase
          .from('menu_item')
          .select('id, name')
          .in('id', menuItemIds);

        if (menuError) throw menuError;
        menuMap = Object.fromEntries((menuItemsData || []).map((item) => [item.id, item.name]));
      }

      itemsByOrder = (orderItemsData || []).reduce((acc, item) => {
        const mapped = {
          name: menuMap[item.menu_item_id] || 'Unknown Item',
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
          subtotal: Number(item.quantity || 0) * Number(item.price || 0),
        };
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(mapped);
        return acc;
      }, {});
    }

    return (ordersData || []).map((order) => {
      const orderItems = itemsByOrder[order.id] || [];
      const paymentProofPath = order.payment_proof_path || '';

      return {
        orderId: order.id,
        id: order.id,
        createdAt: order.created_at,
        orderDate: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
        customerName: normalizeText(order.customer_name),
        phoneNumber: normalizeText(order.phone_number),
        deliveryAddress: normalizeText(order.delivery_address),
        specialInstructions: normalizeText(order.special_instructions, 'None'),
        paymentMethod: normalizeText(order.payment_method, 'N/A'),
        paymentStatus: String(order.payment_status || 'unpaid').toLowerCase(),
        orderSource: normalizeSource(order.order_source),
        promoCode: order.promo_code || '',
        discountAmount: Number(order.discount_amount || 0),
        totalAmount: Number(order.total_amount || 0),
        paymentProofOption: order.payment_proof_option || '',
        paymentProofPath,
        paymentProofUrl: getPublicProofUrl(paymentProofPath),
        status: String(order.status || 'pending').toLowerCase(),
        isArchived: Boolean(order.is_archived),
        archivedAt: order.archived_at || null,
        archivedBy: order.archived_by || '',
        archiveReason: order.archive_reason || '',
        orderItems,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        itemsSummary: orderItems.length ? orderItems.map((item) => `${item.name} x${item.quantity}`).join(', ') : 'No items',
      };
    });
  };

  const fetchOrders = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setActionError('');
    setSuccessMessage('');

    try {
      const { data: primaryData, error: primaryError } = await buildOrdersQuery(activeFilters, true);

      if (primaryError) {
        if (!isArchiveSchemaError(primaryError)) {
          throw primaryError;
        }

        setArchiveSchemaReady(false);
        const { data: fallbackData, error: fallbackError } = await buildOrdersQuery(activeFilters, false);
        if (fallbackError) throw fallbackError;

        const normalizedFallback = await normalizeOrders(fallbackData || []);
        setOrders(normalizedFallback.map((order) => ({ ...order, isArchived: false, archivedAt: null, archivedBy: '', archiveReason: '' })));
        return;
      }

      setArchiveSchemaReady(true);
      const normalized = await normalizeOrders(primaryData || []);
      setOrders(normalized);
    } catch (err) {
      setOrders([]);
      setError(err?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      loadSalesSummary();
    }
  };

  useEffect(() => {
    fetchOrders(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const validIds = new Set(orders.map((order) => order.orderId));
    setSelectedOrderIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [orders]);

  const handleFetchOrders = async () => {
    await fetchOrders(filters);
  };

  const handleQuickRange = async (type) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (type === 'today') {
      startDate = formatDateInput(now);
      endDate = formatDateInput(now);
    } else if (type === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = formatDateInput(yesterday);
      endDate = formatDateInput(yesterday);
    } else if (type === 'last7') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    } else if (type === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatDateInput(start);
      endDate = formatDateInput(now);
    } else if (type === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = formatDateInput(start);
      endDate = formatDateInput(end);
    }

    const nextFilters = { ...filters, startDate, endDate };
    if (type === 'all') {
      nextFilters.startDate = '';
      nextFilters.endDate = '';
    }
    setFilters(nextFilters);
    await fetchOrders(nextFilters);
  };

  const handleOpenSalesRangeModal = () => {
    setSalesRangeDraft({
      startDate: customSalesRange.startDate || filters.startDate || '',
      endDate: customSalesRange.endDate || filters.endDate || '',
    });
    setShowSalesRangeModal(true);
  };

  const handleApplySalesDateRange = () => {
    const { startDate, endDate } = salesRangeDraft;
    if (!startDate || !endDate) {
      setActionError('Please select both start and end date for sales summary range.');
      return;
    }
    if (startDate > endDate) {
      setActionError('Start date cannot be after end date for sales summary range.');
      return;
    }
    const nextCustomRange = { startDate, endDate };
    setCustomSalesRange(nextCustomRange);
    setSalesRange('custom');
    void saveSalesRangePreference('custom', nextCustomRange);
    setActionError('');
    setShowSalesRangeModal(false);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) return setActionError(updateError.message);
    setSuccessMessage('Order status updated.');
    await fetchOrders(filters);
  };

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    setSavingOrderId(orderId);
    const { error: updateError } = await supabase.from('orders').update({ payment_status: newPaymentStatus }).eq('id', orderId);
    setSavingOrderId(null);
    if (updateError) return setActionError(updateError.message);
    setSuccessMessage('Payment status updated.');
    await fetchOrders(filters);
  };

  const handleEditTotalAmount = async (order) => {
    const hasDiscountApplied = Boolean(String(order.promoCode || '').trim()) || Number(order.discountAmount || 0) > 0;
    if (hasDiscountApplied) {
      setActionError('Total amount can only be edited when no promo code or discount is applied.');
      return;
    }

    const currentValue = Number(order.totalAmount || 0).toFixed(2);
    const inputValue = window.prompt(`Edit total amount for order ${order.orderId}:`, currentValue);
    if (inputValue === null) return;

    const normalized = String(inputValue).trim();
    if (!normalized) {
      setActionError('Total amount is required.');
      return;
    }

    const nextAmount = Number(normalized);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setActionError('Please enter a valid total amount (0 or higher).');
      return;
    }

    setSavingOrderId(order.orderId);
    const { error: updateError } = await supabase
      .from('orders')
      .update({ total_amount: Number(nextAmount.toFixed(2)) })
      .eq('id', order.orderId);
    setSavingOrderId(null);

    if (updateError) {
      setActionError(updateError.message || 'Failed to update total amount.');
      return;
    }

    setSuccessMessage('Total amount updated.');
    await fetchOrders(filters);
  };

  const archiveOrdersByIds = async (orderIds, archiveReason) => {
    if (!archiveSchemaReady) {
      setActionError('Archive columns are not available yet. Run the SQL migration in supabase/migrations.');
      return;
    }

    if (!orderIds.length) {
      setActionError('No archiveable orders found for this action.');
      return;
    }

    setBulkArchiving(true);
    setActionError('');

    const payload = {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: archiveReason,
      archived_by: adminEmail || null,
    };

    const { error: archiveError } = await supabase
      .from('orders')
      .update(payload)
      .in('id', orderIds);

    setBulkArchiving(false);

    if (archiveError) {
      if (isArchiveSchemaError(archiveError)) {
        setArchiveSchemaReady(false);
      }
      setActionError(archiveError.message);
      return;
    }

    setSelectedOrderIds([]);
    setSuccessMessage(`${orderIds.length} order(s) archived.`);
    await fetchOrders(filters);
  };

  const handleArchiveSelected = async () => {
    await archiveOrdersByIds(selectedOrderIds, 'bulk_selected');
  };

  const handleArchiveByStatus = async (status) => {
    const statusIds = filteredOrders
      .filter((order) => !order.isArchived && order.status === status)
      .map((order) => order.orderId);

    await archiveOrdersByIds(statusIds, status === 'completed' ? 'bulk_completed' : 'bulk_cancelled');
  };

  const handleArchiveByDateRange = async () => {
    if (!filters.startDate || !filters.endDate) {
      setActionError('Set both start and end date first to archive by date range.');
      return;
    }

    const start = new Date(`${filters.startDate}T00:00:00`);
    const end = new Date(`${filters.endDate}T23:59:59`);
    const rangeIds = filteredOrders
      .filter((order) => {
        if (order.isArchived || !ARCHIVEABLE_STATUSES.has(order.status)) return false;
        const createdDate = new Date(order.createdAt);
        return createdDate >= start && createdDate <= end;
      })
      .map((order) => order.orderId);

    await archiveOrdersByIds(rangeIds, 'bulk_date_range');
  };

  const handleArchiveSingle = async (order) => {
    if (!ARCHIVEABLE_STATUSES.has(order.status)) {
      setActionError('Only completed or cancelled orders can be archived.');
      return;
    }

    await archiveOrdersByIds([order.orderId], `single_${order.status}`);
  };

  const handleExportCSV = () => {
    if (!orders.length) return;
    const csvContent = generateOrdersCSV(orders);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `orders_${timestamp}.csv`);
  };


  const openReceiptWindow = (order, options = {}) => {
    const receiptWindow = window.open('', '_blank', 'width=900,height=900');

    if (!receiptWindow) {
      window.alert('Please allow popups so the receipt can open.');
      return;
    }

    receiptWindow.document.write(buildReceiptHtml(order, options));
    receiptWindow.document.close();
  };

  const printReceiptInline = (order, options = {}) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', `Receipt ${order.orderId}`);
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const frameDocument = iframe.contentWindow?.document;
    if (!frameDocument) {
      document.body.removeChild(iframe);
      window.alert('Unable to open the receipt preview. Please try again.');
      return;
    }

    frameDocument.open();
    frameDocument.write(buildReceiptHtml(order, options));
    frameDocument.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 150);
    };
  };

  const handlePrintReceipt = (order) => {
    openReceiptWindow(order);
  };

  const handleDeliveryReceipt = (order) => {
    setDeliveryReceiptDraft({
      open: true,
      order,
      amount: '0',
    });
  };

  const handleOpenNoteModal = (order) => {
    const existingText = String(orderNotes[order.orderId] || '');
    setNoteDraft({
      open: true,
      orderId: order.orderId,
      customerName: order.customerName,
      text: existingText,
      editing: !existingText,
    });
  };

  const handleCloseNoteModal = () => {
    setNoteDraft({
      open: false,
      orderId: '',
      customerName: '',
      text: '',
      editing: false,
    });
  };

  const handleSaveNote = () => {
    const orderId = noteDraft.orderId;
    if (!orderId) return;

    const trimmedText = String(noteDraft.text || '').trim();
    setOrderNotes((prev) => {
      const next = { ...prev };
      if (!trimmedText) {
        delete next[orderId];
      } else {
        next[orderId] = trimmedText;
      }
      return next;
    });

    setSuccessMessage('Order note saved.');
    setNoteDraft((prev) => ({ ...prev, text: trimmedText, editing: false }));
  };

  const closeDeliveryReceiptModal = () => {
    setDeliveryReceiptDraft({
      open: false,
      order: null,
      amount: '0',
    });
  };

  const handleConfirmDeliveryReceipt = (e) => {
    e.preventDefault();

    const normalizedValue = String(deliveryReceiptDraft.amount || '').replace(/[^0-9.]/g, '');
    const deliveryCharge = Number(normalizedValue || '0');

    if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
      window.alert('Enter a valid delivery charge amount.');
      return;
    }

    const targetOrder = deliveryReceiptDraft.order;
    closeDeliveryReceiptModal();

    if (targetOrder) {
      printReceiptInline(targetOrder, { deliveryCharge });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => [
      order.orderDate,
      order.customerName,
      order.phoneNumber,
      order.deliveryAddress,
      order.paymentMethod,
      order.paymentStatus,
      order.orderSource,
      order.specialInstructions,
      order.promoCode,
      order.itemsSummary,
      order.status,
    ].join(' ').toLowerCase().includes(term));
  }, [orders, searchTerm]);

  const archiveableFilteredOrders = useMemo(
    () => filteredOrders.filter((order) => ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived),
    [filteredOrders]
  );

  const allArchiveableSelected = archiveableFilteredOrders.length > 0
    && archiveableFilteredOrders.every((order) => selectedOrderIds.includes(order.orderId));

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds((prev) => (
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    ));
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds(archiveableFilteredOrders.map((order) => order.orderId));
  };

  const renderProofContent = (order) => {
    if (order.orderSource === 'external') {
      return <span className="text-xs text-gray-500">Not required</span>;
    }

    if (order.paymentProofUrl) {
      return (
        <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          <span className="block">View proof</span>
          <img src={order.paymentProofUrl} alt={`Payment proof for ${order.customerName}`} className="mt-1 h-14 w-14 rounded border object-cover" />
        </a>
      );
    }

    const qrImage = getPaymentQrPath(order.paymentMethod);
    if (qrImage && order.paymentMethod !== 'COD') {
      return (
        <div className="text-xs text-gray-600">
          <span className="block">QR available</span>
          <img src={qrImage} alt={`${order.paymentMethod} QR`} className="mt-1 h-14 w-14 rounded border object-cover" />
        </div>
      );
    }

    if (order.paymentMethod === 'COD') return <span className="text-xs text-gray-500">Not required</span>;
    if (order.paymentProofOption === 'scan_on_delivery') return <span className="text-xs text-gray-500">Scan on delivery</span>;
    return <span className="text-xs text-gray-500">No upload yet</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ADMIN DASHBOARD</h1>
            <p className="mt-1 text-sm text-gray-600">Archived orders are hidden from this active list by default.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Front Store</Link>
            <Link to="/admin/external" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Admin Orders</Link>
            <Link to="/admin/profit-calculator" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Sales Management</Link>
            <Link to="/admin/expense-tracker" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Expense Tracker</Link>
            <Link to="/admin/archive" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">View Archive</Link>
            <Link to="/admin/menu" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Manage Menu</Link>
             <Link to="/admin/help" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Help</Link>
            <Link to="/admin/gallery" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Gallery</Link>
            <button onClick={() => setShowPromoManager((prev) => !prev)} className="rounded-md bg-amber-500 px-4 py-2 text-white shadow hover:bg-amber-600">
              {showPromoManager ? 'Hide Promo Codes' : 'Manage Promo Codes'}
            </button>
            <button
              type="button"
              onClick={() => setShowThankYouEditor(true)}
              className="rounded-md bg-sky-600 px-4 py-2 text-white shadow hover:bg-sky-700"
            >
              Thank You Message
            </button>
            <AdminThemeSwitcher />
            <button onClick={handleSignOut} className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">Sign Out</button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Dates' },
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'lastMonth', label: 'Last Month' },
            ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleSetSalesRange(option.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition inline-flex items-center gap-2 ${
                    salesRange === option.key
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      salesRange === option.key
                        ? 'border-white bg-white'
                        : 'border-orange-500 bg-transparent'
                    }`}
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
            ))}
            <button
              type="button"
              onClick={handleOpenSalesRangeModal}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition inline-flex items-center gap-2 ${
                salesRange === 'custom'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full border ${
                  salesRange === 'custom'
                    ? 'border-white bg-white'
                    : 'border-orange-500 bg-transparent'
                }`}
                aria-hidden="true"
              />
              Date Range
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Paid Sales
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {formatCurrency(todaySalesSummary.paidSales)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {todaySalesSummary.paidCount} paid order(s)
              </p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
                Expected Sales
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {formatCurrency(todaySalesSummary.expectedSales)}
              </p>
              <p className={`mt-2 text-sm font-medium ${
                todaySalesSummary.expectedSales - previousSales >= 0
                  ? 'text-emerald-700'
                  : 'text-red-600'
              }`}>
                {todaySalesSummary.expectedSales - previousSales >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(todaySalesSummary.expectedSales - previousSales))} vs previous {salesRange === 'week' ? '7 days' : salesRange === 'lastMonth' ? 'month' : salesRange === 'custom' ? 'selected range' : 'period'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {todaySalesSummary.expectedCount} non-cancelled order(s)
              </p>
            </div>
          </div>
        </div>

        {showPromoManager && (
          <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
            <section className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">{editingPromoId ? 'Edit Promo Code' : 'Promo Code Generator'}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {editingPromoId ? 'Modify the selected promo code, then save your changes.' : 'Create a promo code manually, choose fixed or percent discount, then save it to Supabase.'}
                </p>
              </div>

              {promoError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {promoError}
                </div>
              )}

              {promoSuccess && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {promoSuccess}
                </div>
              )}

              <form onSubmit={handleCreatePromoCode} className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Promo Code</label>
                  <input
                    type="text"
                    value={promoForm.code}
                    onChange={(e) => handlePromoInputChange('code', e.target.value.toUpperCase())}
                    placeholder="e.g. FOODIE20"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 uppercase"
                    disabled={promoSaving}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Discount Type</label>
                    <select
                      value={promoForm.discountType}
                      onChange={(e) => handlePromoInputChange('discountType', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      disabled={promoSaving}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="percent">Percent</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Discount Value</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={promoForm.discountValue}
                      onChange={(e) => handlePromoInputChange('discountValue', e.target.value)}
                      placeholder={promoForm.discountType === 'percent' ? 'e.g. 10' : 'e.g. 20'}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      disabled={promoSaving}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Starts At</label>
                    <input
                      type="date"
                      value={promoForm.startsAt}
                      onChange={(e) => handlePromoInputChange('startsAt', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      disabled={promoSaving}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Ends At</label>
                    <input
                      type="date"
                      value={promoForm.endsAt}
                      onChange={(e) => handlePromoInputChange('endsAt', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      disabled={promoSaving}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={promoForm.isActive}
                    onChange={(e) => handlePromoInputChange('isActive', e.target.checked)}
                    disabled={promoSaving}
                  />
                  Active immediately
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={promoSaving}
                    className="rounded-md bg-amber-500 px-4 py-2 text-white shadow hover:bg-amber-600 disabled:bg-gray-300"
                  >
                    {promoSaving ? (editingPromoId ? 'Updating...' : 'Saving...') : (editingPromoId ? 'Update Promo Code' : 'Save Promo Code')}
                  </button>
                  <button
                    type="button"
                    onClick={resetPromoForm}
                    disabled={promoSaving}
                    className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 shadow hover:bg-gray-200 disabled:bg-gray-100"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-lg bg-white p-4 shadow sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Existing Promo Codes</h2>
                  <p className="mt-1 text-sm text-gray-500">These codes are saved in the promo_codes table and can be typed during checkout.</p>
                </div>
                <button
                  onClick={loadPromoCodes}
                  disabled={promoLoading}
                  className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 shadow hover:bg-gray-200 disabled:bg-gray-100 sm:w-auto"
                >
                  {promoLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {promoCodes.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  {promoLoading ? 'Loading promo codes...' : 'No promo codes found yet.'}
                </div>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {promoCodes.map((promo) => (
                      <div key={promo.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-all text-lg font-semibold text-gray-900">{promo.code}</p>
                            <p className="mt-1 text-sm text-gray-500 capitalize">{promo.discount_type} discount</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {promo.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-gray-50 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Value</p>
                            <p className="mt-1 font-semibold text-gray-900">
                              {promo.discount_type === 'percent'
                                ? `${Number(promo.discount_value || 0).toFixed(2)}%`
                                : `₱${Number(promo.discount_value || 0).toFixed(2)}`}
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-50 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
                            <p className="mt-1 font-semibold text-gray-900 capitalize">{promo.discount_type}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Starts</p>
                            <p className="mt-1 font-semibold text-gray-900">{promo.starts_at ? new Date(promo.starts_at).toLocaleDateString() : '—'}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Ends</p>
                            <p className="mt-1 font-semibold text-gray-900">{promo.ends_at ? new Date(promo.ends_at).toLocaleDateString() : '—'}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditPromoCode(promo)}
                            className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePromoActive(promo)}
                            className="rounded-md bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-900"
                          >
                            {promo.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromoCode(promo)}
                            className="rounded-md bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left">
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2 text-right">Value</th>
                          <th className="px-3 py-2">Active</th>
                          <th className="px-3 py-2">Starts</th>
                          <th className="px-3 py-2">Ends</th>
                          <th className="px-3 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoCodes.map((promo) => (
                          <tr key={promo.id} className="border-b">
                            <td className="px-3 py-2 font-semibold text-gray-900">{promo.code}</td>
                            <td className="px-3 py-2 capitalize">{promo.discount_type}</td>
                            <td className="px-3 py-2 text-right">
                              {promo.discount_type === 'percent'
                                ? `${Number(promo.discount_value || 0).toFixed(2)}%`
                                : `₱${Number(promo.discount_value || 0).toFixed(2)}`}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {promo.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2">{promo.starts_at ? new Date(promo.starts_at).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2">{promo.ends_at ? new Date(promo.ends_at).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditPromoCode(promo)}
                                  className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePromoActive(promo)}
                                  className="rounded-md bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-900"
                                >
                                  {promo.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePromoCode(promo)}
                                  className="rounded-md bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Fetch Orders</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => handleQuickRange('today')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Today</button>
            <button onClick={() => handleQuickRange('yesterday')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Yesterday</button>
            <button onClick={() => handleQuickRange('last7')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Last 7 Days</button>
            <button onClick={() => handleQuickRange('thisMonth')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">This Month</button>
            <button onClick={() => handleQuickRange('lastMonth')} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Last Month</button>
            <button onClick={() => handleQuickRange('all')} className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">All Dates</button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6">
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2" />
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2" />
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Status</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Payment</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
            </select>
            <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2">
              <option value="all">All Source</option><option value="internal">Internal</option><option value="external">External</option>
            </select>
            <button onClick={handleFetchOrders} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-white">{loading ? 'Loading...' : 'Fetch Orders'}</button>
          </div>

          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search orders" className="w-full rounded-md border border-gray-300 px-3 py-2" />

          {!archiveSchemaReady && (
            <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
              Archive columns are missing in your current DB. Run the SQL migration in <code>supabase/migrations/20260417_add_order_archive_columns.sql</code>.
            </div>
          )}

          {(error || actionError) && <div className="mt-3 rounded border border-red-400 bg-red-100 p-3 text-red-700">{actionError || error}</div>}
          {successMessage && <div className="mt-3 rounded border border-green-400 bg-green-100 p-3 text-green-700">{successMessage}</div>}
        </div>

        <div className="rounded-lg bg-white p-4 md:p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Orders ({filteredOrders.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleArchiveSelected} disabled={bulkArchiving || !selectedOrderIds.length || !archiveSchemaReady} className="rounded-md bg-purple-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Selected ({selectedOrderIds.length})</button>
              <button onClick={() => handleArchiveByStatus('completed')} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Completed</button>
              <button onClick={() => handleArchiveByStatus('cancelled')} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-orange-600 px-4 py-2 text-white disabled:bg-gray-300">Archive Cancelled</button>
              <button onClick={handleArchiveByDateRange} disabled={bulkArchiving || !archiveSchemaReady} className="rounded-md bg-slate-700 px-4 py-2 text-white disabled:bg-gray-300">Archive by Date Range</button>
              <button onClick={handleExportCSV} className="rounded-md bg-green-600 px-4 py-2 text-white">Export CSV</button>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {filteredOrders.map((order) => {
              const canArchive = ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived;
              const isSelected = selectedOrderIds.includes(order.orderId);
              const canEditTotal = !Boolean(String(order.promoCode || '').trim()) && Number(order.discountAmount || 0) <= 0;
              const hasModifiedTotal = isOrderTotalModified(order);
              const hasNote = Boolean(orderNotes[order.orderId]);
              return (
                <div key={order.orderId} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">{order.orderDate}</p>
                      <h3 className="text-base font-semibold text-gray-900">{order.customerName}</h3>
                      <p className="text-sm text-gray-500">{order.phoneNumber}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={isSelected} disabled={!canArchive} onChange={() => toggleSelectOrder(order.orderId)} />
                      Select
                    </label>
                  </div>
                  <p className="text-sm text-gray-700">{order.itemsSummary}</p>
                  <div className="mt-2 text-sm text-gray-600">Payment: {order.paymentMethod} • {order.paymentStatus}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span>Total: ₱{Number(order.totalAmount || 0).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleEditTotalAmount(order)}
                      disabled={savingOrderId === order.orderId || !canEditTotal}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:bg-gray-200"
                      title={canEditTotal ? 'Edit total amount' : 'Disabled because promo/discount is applied'}
                    >
                      {savingOrderId === order.orderId ? 'Saving...' : 'Edit Total'}
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-sm text-gray-600">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Status</span>
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)}
                        disabled={savingOrderId === order.orderId}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    </label>
                    <label className="text-sm text-gray-600">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Order Status</span>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.orderId, e.target.value)}
                        disabled={savingOrderId === order.orderId}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-2">{renderProofContent(order)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)}
                      className="rounded-md bg-indigo-900 px-3 py-2 text-xs text-white hover:bg-indigo-800"
                    >
                      {expandedOrderId === order.orderId ? 'Hide' : 'View'}
                    </button>
                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="rounded-md bg-sky-600 px-3 py-2 text-xs text-white hover:bg-sky-700"
                    >
                      Print
                    </button>
                    {hasModifiedTotal && (
                      <button
                        onClick={() => handlePrintReceipt(order)}
                        className="rounded-md bg-violet-600 px-3 py-2 text-xs text-white hover:bg-violet-700"
                      >
                        Print Modified
                      </button>
                    )}
                    <button
                      onClick={() => handleDeliveryReceipt(order)}
                      className="rounded-md bg-amber-600 px-3 py-2 text-xs text-white hover:bg-amber-700"
                    >
                      With DF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenNoteModal(order)}
                      className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white flex items-center gap-1 hover:bg-gray-700"
                    >
                      {hasNote && <span className="text-white">&#9999;</span>}
                      Notes
                    </button>
                    <button
                      onClick={() => handleArchiveSingle(order)}
                      disabled={!canArchive || !archiveSchemaReady || bulkArchiving}
                      className="rounded-md bg-purple-600 px-3 py-2 text-xs text-white disabled:bg-gray-300"
                    >
                      Archive
                    </button>
                  </div>
                  {expandedOrderId === order.orderId && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                      <p><span className="font-semibold">Address:</span> {order.deliveryAddress}</p>
                      <p className="mt-1"><span className="font-semibold">Instructions:</span> {order.specialInstructions}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[2400px] text-sm">
              <thead className="border-b bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center"><input type="checkbox" checked={allArchiveableSelected} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                  <th className="px-4 py-3 text-left">Date Ordered</th>
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Phone Number</th>
                  <th className="px-4 py-3 text-left">Delivery Address</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-left">Payment Status</th>
                  <th className="px-4 py-3 text-left">Proof / QR</th>
                  <th className="px-4 py-3 text-left">Special Instructions</th>
                  <th className="px-4 py-3 text-left">Promo Code</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-center">Item Count</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.orderId;
                  const canArchive = ARCHIVEABLE_STATUSES.has(order.status) && !order.isArchived;
                  const canEditTotal = !Boolean(String(order.promoCode || '').trim()) && Number(order.discountAmount || 0) <= 0;
                  const hasModifiedTotal = isOrderTotalModified(order);
                  const hasNote = Boolean(orderNotes[order.orderId]);
                  return (
                    <React.Fragment key={order.orderId}>
                      <tr className="border-b align-top hover:bg-gray-50">
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={selectedOrderIds.includes(order.orderId)} disabled={!canArchive} onChange={() => toggleSelectOrder(order.orderId)} />
                        </td>
                        <td className="px-4 py-3">{order.orderDate}</td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">{order.phoneNumber}</td>
                        <td className="px-4 py-3">{order.deliveryAddress}</td>
                        <td className="px-4 py-3">{order.orderSource}</td>
                        <td className="px-4 py-3">{order.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <select value={order.paymentStatus} onChange={(e) => handlePaymentStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">{renderProofContent(order)}</td>
                        <td className="px-4 py-3 max-w-[220px] whitespace-pre-wrap break-words">{order.specialInstructions}</td>
                        <td className="px-4 py-3">{order.promoCode || 'None'}</td>
                        <td className="px-4 py-3 text-right">-₱{Number(order.discountAmount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">{order.itemsSummary}</td>
                        <td className="px-4 py-3 text-center">{order.itemCount}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <span>₱{Number(order.totalAmount || 0).toFixed(2)}</span>
                            <button
                              type="button"
                              onClick={() => handleEditTotalAmount(order)}
                              disabled={savingOrderId === order.orderId || !canEditTotal}
                              className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:bg-gray-200"
                              title={canEditTotal ? 'Edit total amount' : 'Disabled because promo/discount is applied'}
                            >
                              {savingOrderId === order.orderId ? 'Saving...' : 'Edit Total'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select value={order.status} onChange={(e) => handleStatusChange(order.orderId, e.target.value)} disabled={savingOrderId === order.orderId} className="rounded-md border border-gray-300 px-3 py-2">
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-wrap justify-center gap-2">
                            <button onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="rounded-md bg-indigo-900 px-3 py-2 text-sm text-white hover:bg-indigo-800">
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700">
                              Print
                            </button>
                            {hasModifiedTotal && (
                              <button onClick={() => handlePrintReceipt(order)} className="rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700">
                                Print Modified
                              </button>
                            )}
                            <button onClick={() => handleDeliveryReceipt(order)} className="rounded-md bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700">
                              With DF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(order)}
                              className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white flex items-center gap-1 hover:bg-gray-700"
                            >
                              {hasNote && <span className="text-white">&#9999;</span>}
                              Notes
                            </button>
                            <button onClick={() => handleArchiveSingle(order)} disabled={!canArchive || !archiveSchemaReady || bulkArchiving} className="rounded-md bg-purple-600 px-3 py-2 text-sm text-white disabled:bg-gray-300">
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b bg-gray-50">
                          <td colSpan="17" className="px-6 py-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <h3 className="mb-3 font-semibold text-gray-800">Ordered Items</h3>
                              {order.orderItems.length > 0 ? order.orderItems.map((item, index) => (
                                <div key={`${order.orderId}-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{item.name}</p>
                                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                                  </div>
                                  <p className="font-semibold text-gray-800">₱{Number(item.subtotal).toFixed(2)}</p>
                                </div>
                              )) : <p className="text-sm text-gray-500">No items found.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {showThankYouEditor && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowThankYouEditor(false);
            }}
          >
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900">Edit Thank You Modal Text</h2>
              <p className="mt-1 text-sm text-gray-600">
                This controls the customer popup shown right after placing an order.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Title</label>
                  <input
                    type="text"
                    value={thankYouTitleInput}
                    onChange={(e) => setThankYouTitleInput(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                    placeholder="Thank you! We have received your order."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Body Message</label>
                  <textarea
                    value={thankYouBodyInput}
                    onChange={(e) => setThankYouBodyInput(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                    placeholder="If you enjoyed our food..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowThankYouEditor(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  disabled={savingThankYou}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveThankYouContent}
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-gray-300"
                  disabled={savingThankYou}
                >
                  {savingThankYou ? 'Saving...' : 'Save Message'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSalesRangeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSalesRangeModal(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900">Sales Summary Date Range</h2>
              <p className="mt-1 text-sm text-gray-600">
                Select a date range to filter Paid Sales and Expected Sales cards.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date</label>
                  <input
                    type="date"
                    value={salesRangeDraft.startDate}
                    onChange={(e) => setSalesRangeDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">End Date</label>
                  <input
                    type="date"
                    value={salesRangeDraft.endDate}
                    onChange={(e) => setSalesRangeDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSalesRangeModal(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplySalesDateRange}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Apply Range
                </button>
              </div>
            </div>
          </div>
        )}

        {deliveryReceiptDraft.open && deliveryReceiptDraft.order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900">With DF</h2>
              <p className="mt-2 text-sm text-gray-600">
                Enter the 3rd-party delivery charge for receipt printing only. This does not change sales or saved order totals.
              </p>

              <form onSubmit={handleConfirmDeliveryReceipt} className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 block text-sm font-semibold text-gray-700">
                    Quick select
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_RECEIPT_PRESETS.map((preset) => {
                      const isActive = deliveryReceiptDraft.amount === preset;

                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDeliveryReceiptDraft((prev) => ({ ...prev, amount: preset }))}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            isActive
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {formatCurrency(preset)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700" htmlFor="delivery-charge-input">
                    Manual delivery charge
                  </label>
                  <input
                    id="delivery-charge-input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={deliveryReceiptDraft.amount}
                    onChange={(e) => setDeliveryReceiptDraft((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Order: {deliveryReceiptDraft.order.customerName} • {formatCurrency(deliveryReceiptDraft.order.totalAmount)} base total
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDeliveryReceiptModal}
                    className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Print / Save PDF
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {noteDraft.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseNoteModal();
            }}
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-gray-900">Order Note</h2>
              <p className="mt-1 text-sm text-gray-600">
                Order: {noteDraft.customerName || 'N/A'} ({noteDraft.orderId || 'N/A'})
              </p>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Note</label>
                <textarea
                  value={noteDraft.text}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, text: e.target.value }))}
                  rows={6}
                  disabled={!noteDraft.editing}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 disabled:bg-gray-100"
                  placeholder="Type your order note here..."
                />
              </div>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseNoteModal}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Exit
                </button>
                <button
                  type="button"
                  onClick={() => setNoteDraft((prev) => ({ ...prev, editing: true }))}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteDraft.editing}
                  className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:bg-gray-300"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel2;
