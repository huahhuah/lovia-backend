async function generateInvoiceNumber(invoiceRepo, invoice) {
  if (!invoice || !invoice.id) throw new Error("無效的 invoice");

  // 產生 LV-000001 格式流水號
  const newInvoiceNo = `LV-${String(invoice.id).padStart(6, "0")}`;
  invoice.invoice_no = newInvoiceNo;

  await invoiceRepo.save(invoice);
  return newInvoiceNo;
}

module.exports = { generateInvoiceNumber };
