import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Export selected archived orders to PDF
export const exportSelectedArchiveToPDF = (orders) => {
  if (!orders || orders.length === 0) {
    console.error('No orders to export');
    return;
  }

  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('FoodiefyCo - Archived Orders Report', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Orders: ${orders.length}`, 14, 34);

  // Calculate totals
  const totalRevenue = orders.reduce((sum, order) => {
    const amount = parseFloat(order.total_amount) || 0;
    return sum + amount;
  }, 0);

  doc.text(`Total Revenue: ₱${totalRevenue.toFixed(2)}`, 14, 40);

  // Table data
  const tableColumn = ['ID', 'Customer', 'Total', 'Status', 'Payment', 'Ordered Date', 'Archived Date'];
  const tableRows = orders.map(order => [
    order.id ? String(order.id).slice(0, 8) : 'N/A',
    order.customer_name || 'N/A',
    `₱${parseFloat(order.total_amount || 0).toFixed(2)}`,
    order.status || 'N/A',
    order.payment_method || 'N/A',
    order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
    order.archived_at ? new Date(order.archived_at).toLocaleDateString() : '-'
  ]);

  // Generate table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 46,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [66, 66, 66], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 20 },
      2: { halign: 'right' },
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  }

  // Save PDF
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`foodiefy_archived_orders_${dateStr}.pdf`);
};

// You can add other export functions here if needed
export const exportOrdersToCSV = (orders) => {
  // Future: CSV export logic
  console.log('CSV export not implemented yet', orders);
};
