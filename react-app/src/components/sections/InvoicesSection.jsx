import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, LoaderCircle, RefreshCw, Share2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { getMarketplaceErrorMessage } from '../../utils/marketplaceErrors';

const formatMoney = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

export default function InvoicesSection({ t, lang, user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('brick_orders')
        .select(`
          id,
          invoice_number,
          customer_name,
          customer_phone,
          customer_email,
          quantity,
          unit_price,
          total_amount,
          advance_amount,
          amount_paid,
          payment_method,
          delivery_address,
          delivery_date,
          transport_option,
          transport_amount,
          status,
          paid_at,
          created_at,
          owner:brick_owners!brick_orders_owner_id_fkey(display_name_en, display_name_te),
          listing:brick_listings!brick_orders_listing_id_fkey(name, brick_type)
        `)
        .eq('customer_id', user.id)
        .not('invoice_number', 'is', null)
        .order('paid_at', { ascending: false });

      if (fetchError) {
        setError(getMarketplaceErrorMessage(fetchError, t));
      } else {
        setError('');
        setInvoices(data || []);
      }
    } catch (fetchException) {
      setError(fetchException instanceof Error ? fetchException.message : String(fetchException));
    } finally {
      setLoading(false);
    }
  }, [t, user.id]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const createInvoicePdf = async (invoice) => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    const left = 18;
    const right = 192;
    const date = invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString('en-IN')
      : new Date(invoice.created_at).toLocaleDateString('en-IN');
    const customerName = invoice.customer_name || invoice.customer_phone || invoice.customer_email ||
      user.user_metadata?.full_name || user.phone || user.email || 'Customer';
    const ownerName = invoice.owner?.display_name_en || invoice.owner?.display_name_te || 'Brick owner';

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(23);
    pdf.setTextColor(18, 57, 77);
    pdf.text('BRICKS-LAND', left, 23);
    pdf.setFontSize(10);
    pdf.setTextColor(94, 116, 130);
    pdf.text('Parvathipuram, Andhra Pradesh', left, 30);
    pdf.setFontSize(20);
    pdf.setTextColor(233, 111, 33);
    pdf.text('ORDER INVOICE', right, 23, { align: 'right' });
    pdf.setDrawColor(233, 111, 33);
    pdf.line(left, 38, right, 38);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(94, 116, 130);
    pdf.text('INVOICE NUMBER', left, 51);
    pdf.text('PAID ON', 112, 51);
    pdf.setFontSize(12);
    pdf.setTextColor(20, 50, 67);
    pdf.text(invoice.invoice_number, left, 58);
    pdf.text(date, 112, 58);

    pdf.setFontSize(10);
    pdf.setTextColor(94, 116, 130);
    pdf.text('BILL TO', left, 76);
    pdf.text('BRICK OWNER', 112, 76);
    pdf.setFontSize(12);
    pdf.setTextColor(20, 50, 67);
    pdf.text(pdf.splitTextToSize(customerName, 78), left, 84);
    pdf.text(pdf.splitTextToSize(ownerName, 78), 112, 84);

    pdf.setFillColor(18, 57, 77);
    pdf.rect(left, 105, right - left, 12, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text('ITEM', left + 4, 113);
    pdf.text('QTY', 121, 113, { align: 'right' });
    pdf.text('PRICE / BRICK', 155, 113, { align: 'right' });
    pdf.text('AMOUNT', right - 4, 113, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(20, 50, 67);
    const itemName = invoice.listing?.name || invoice.listing?.brick_type || 'Bricks';
    pdf.text(pdf.splitTextToSize(itemName, 77), left + 4, 128);
    pdf.text(Number(invoice.quantity).toLocaleString('en-IN'), 121, 128, { align: 'right' });
    pdf.text(formatMoney(invoice.unit_price), 155, 128, { align: 'right' });
    pdf.text(formatMoney(invoice.total_amount), right - 4, 128, { align: 'right' });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(left, 143, right, 143);

    const amountPaid = Number(invoice.amount_paid || 0);
    const balance = Math.max(0, Number(invoice.total_amount) - amountPaid);
    pdf.setTextColor(94, 116, 130);
    pdf.text('BRICK ORDER TOTAL', 145, 158, { align: 'right' });
    pdf.text(formatMoney(invoice.total_amount), right, 158, { align: 'right' });
    pdf.text('ADVANCE PAID', 145, 168, { align: 'right' });
    pdf.setTextColor(21, 128, 61);
    pdf.text(formatMoney(amountPaid), right, 168, { align: 'right' });
    pdf.setTextColor(94, 116, 130);
    pdf.text('BALANCE DUE (BRICKS)', 145, 178, { align: 'right' });
    pdf.text(formatMoney(balance), right, 178, { align: 'right' });

    const transportName = {
      self_pickup: 'Self pickup (Rs. 0)',
      tractor: 'Tractor',
      mini_truck: 'Mini truck',
      lorry: 'Lorry'
    }[invoice.transport_option] || 'Delivery';
    const transportDetails = invoice.transport_option === 'self_pickup'
      ? transportName
      : Number(invoice.transport_amount) > 0
        ? `${transportName} - ${formatMoney(invoice.transport_amount)}`
        : `${transportName} - owner quote pending`;
    pdf.text(
      `Transport: ${transportDetails}`,
      left,
      190
    );
    let detailY = 198;
    if (invoice.delivery_date) {
      pdf.text(`Preferred delivery: ${new Date(`${invoice.delivery_date}T00:00:00`).toLocaleDateString('en-IN')}`, left, detailY);
      detailY += 8;
    }
    if (invoice.delivery_address) {
      const addressLines = pdf.splitTextToSize(`Delivery address: ${invoice.delivery_address}`, 174);
      pdf.text(addressLines, left, detailY);
      detailY += addressLines.length * 5 + 3;
    }
    pdf.setTextColor(21, 128, 61);
    pdf.text(`Payment status: ${balance === 0 ? 'PAID' : 'ADVANCE PAID'}`, left, detailY);
    pdf.setTextColor(94, 116, 130);
    pdf.text(`Payment method: ${invoice.payment_method === 'offline' ? 'Offline' : 'Online'}`, left, detailY + 10);
    pdf.text(`Order ID: ${invoice.id}`, left, detailY + 20);
    pdf.text('Transport charges are not included unless confirmed by the owner.', left, detailY + 30);
    pdf.text('Thank you for your order.', left, detailY + 40);

    return pdf;
  };

  const downloadInvoice = async (invoice) => {
    setDownloadingId(invoice.id);
    setError('');
    try {
      const pdf = await createInvoicePdf(invoice);
      pdf.save(`${invoice.invoice_number}.pdf`);
    } catch (downloadError) {
      setError(downloadError.message || 'Could not create the invoice PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const shareInvoice = async (invoice) => {
    setSharingId(invoice.id);
    setError('');
    try {
      const pdf = await createInvoicePdf(invoice);
      if (typeof File === 'undefined') {
        setError(t.invoiceShareNotSupported);
        return;
      }
      const file = new File([pdf.output('blob')], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' });
      const shareData = {
        files: [file],
        title: `${t.invoiceNumber}: ${invoice.invoice_number}`,
        text: `${invoice.listing?.name || 'Bricks'} · ${Number(invoice.quantity).toLocaleString('en-IN')} ${t.ownerBricks}`
      };
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setError(t.invoiceShareNotSupported);
        return;
      }
      await navigator.share(shareData);
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setError(shareError.message || t.invoiceShareFailed);
      }
    } finally {
      setSharingId(null);
    }
  };

  const getShareMessage = (invoice) => {
    const transportName = {
      self_pickup: t.transportSelfPickup,
      tractor: t.transportTractor,
      mini_truck: t.transportMiniTruck,
      lorry: t.transportLorry
    }[invoice.transport_option] || t.transportQuotePending;
    const transportCharge = invoice.transport_option === 'self_pickup'
      ? '₹0'
      : Number(invoice.transport_amount) > 0
        ? formatMoney(invoice.transport_amount)
        : t.transportQuotePending;
    return [
      `${t.invoiceNumber}: ${invoice.invoice_number}`,
      `${invoice.listing?.name || 'Bricks'} · ${Number(invoice.quantity).toLocaleString('en-IN')} ${t.ownerBricks}`,
      `${t.brickSubtotal}: ${formatMoney(invoice.total_amount)}`,
      `${t.invoiceAdvancePaid}: ${formatMoney(invoice.amount_paid)}`,
      `${t.balanceAfterAdvance}: ${formatMoney(Math.max(0, Number(invoice.total_amount) - Number(invoice.amount_paid || 0)))}`,
      `${t.transportOption}: ${transportName} · ${transportCharge}`,
      invoice.delivery_date ? `${t.deliveryDate}: ${new Date(`${invoice.delivery_date}T00:00:00`).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')}` : '',
      invoice.delivery_address ? `${t.deliveryAddress}: ${invoice.delivery_address}` : ''
    ].filter(Boolean).join('\n');
  };

  return (
    <section>
      <div className="section-header invoice-section-heading">
        <div>
          <h1 className="section-title">{t.invoicesTitle}</h1>
          <p className="section-subtitle">{t.invoicesSubtitle}</p>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setLoading(true);
            setError('');
            fetchInvoices();
          }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t.navInvoices}</span>
        </button>
      </div>

      {error && <div className="alert-box alert-error owner-feedback"><AlertCircle size={18} /><span>{error}</span></div>}
      {loading ? (
        <div className="owner-loading"><LoaderCircle className="spin" size={20} />{t.ownerLoading}</div>
      ) : invoices.length > 0 ? (
        <div className="invoice-list">
          {invoices.map((invoice) => (
            <article className="invoice-card" key={invoice.id}>
              <div className="invoice-card-icon"><FileText size={21} /></div>
              <div className="invoice-card-details">
                <strong>{invoice.invoice_number}</strong>
                <span>{invoice.owner?.display_name_en || invoice.owner?.display_name_te} · {invoice.listing?.name}</span>
                <span>{new Date(invoice.paid_at || invoice.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')} · {Number(invoice.quantity).toLocaleString('en-IN')} {t.ownerBricks}</span>
              </div>
              <div className="invoice-card-actions">
                <strong>{formatMoney(invoice.total_amount)}</strong>
                <span className="status-pill status-paid">{Number(invoice.amount_paid) >= Number(invoice.total_amount) ? t.invoicePaid : t.invoiceAdvancePaid}</span>
                <button type="button" className="btn-primary" disabled={downloadingId === invoice.id} onClick={() => downloadInvoice(invoice)}>
                  {downloadingId === invoice.id ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}
                  <span>{t.invoiceDownload}</span>
                </button>
                <button type="button" className="btn-outline" disabled={sharingId === invoice.id} onClick={() => shareInvoice(invoice)}>
                  {sharingId === invoice.id ? <LoaderCircle className="spin" size={15} /> : <Share2 size={15} />}
                  <span>{t.shareInvoice}</span>
                </button>
                <a className="btn-outline" href={`https://wa.me/?text=${encodeURIComponent(getShareMessage(invoice))}`} target="_blank" rel="noreferrer">{t.shareWhatsApp}</a>
                <a className="btn-outline" href={`mailto:${encodeURIComponent(invoice.customer_email || '')}?subject=${encodeURIComponent(`${t.invoiceNumber}: ${invoice.invoice_number}`)}&body=${encodeURIComponent(getShareMessage(invoice))}`}>{t.shareEmail}</a>
              </div>
            </article>
          ))}
        </div>
      ) : error ? null : (
        <div className="owner-empty-state">
          <FileText size={30} aria-hidden="true" />
          <p>{t.invoicesEmpty}</p>
        </div>
      )}
    </section>
  );
}
