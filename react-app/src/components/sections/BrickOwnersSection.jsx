import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, BrickWall, CheckCircle2, CreditCard, LoaderCircle, PackagePlus, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { BRICK_OWNERS } from '../../data/brickOwners';
import { getMarketplaceErrorMessage } from '../../utils/marketplaceErrors';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
const activeOrderStatuses = new Set(['offline_pending', 'paid', 'loading', 'dispatched', 'delivered']);
const advanceAmount = 1000;
const indiaRateWindowStart = (date) => {
  const indiaDate = new Date(date.getTime() + 330 * 60 * 1000);
  const currentHour = indiaDate.getUTCHours();
  const todayAtSixUtc = Date.UTC(
    indiaDate.getUTCFullYear(),
    indiaDate.getUTCMonth(),
    indiaDate.getUTCDate(),
    0,
    30
  );
  return new Date(todayAtSixUtc - (currentHour < 6 ? 24 * 60 * 60 * 1000 : 0));
};
const isFreshSinceSixAm = (timestamp, now) =>
  Boolean(timestamp) && new Date(timestamp).getTime() >= indiaRateWindowStart(now).getTime();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve();
    return;
  }

  const existingScript = document.querySelector('script[data-razorpay-checkout]');
  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      resolve();
      return;
    }
    existingScript.addEventListener('load', resolve, { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Could not load secure Razorpay checkout.')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => {
    script.dataset.loaded = 'true';
    resolve();
  };
  script.onerror = () => {
    script.remove();
    reject(new Error('Could not load secure Razorpay checkout.'));
  };
  document.body.appendChild(script);
});

const getOwnerName = (owner, lang) =>
  lang === 'te' ? owner.display_name_te || owner.nameTe : owner.display_name_en || owner.name;

const getTransportName = (option, t) => ({
  self_pickup: t.transportSelfPickup,
  tractor: t.transportTractor,
  mini_truck: t.transportMiniTruck,
  lorry: t.transportLorry
})[option] || t.transportQuotePending;

const getFunctionErrorMessage = async (error) => {
  if (error?.context instanceof Response) {
    const responseBody = await error.context.clone().json().catch(() => null);
    if (typeof responseBody?.error === 'string') return responseBody.error;
  }
  return error?.message || 'The marketplace request failed.';
};

export default function BrickOwnersSection({
  t,
  lang,
  user,
  onStartCheckout,
  transportSelection,
  onResetCheckoutNavigation
}) {
  const [owners, setOwners] = useState(BRICK_OWNERS);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [listings, setListings] = useState([]);
  const [ownerOrders, setOwnerOrders] = useState([]);
  const [linkedOwner, setLinkedOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checkoutListing, setCheckoutListing] = useState(null);
  const [quantity, setQuantity] = useState('1000');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [transportOption, setTransportOption] = useState('tractor');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [checkoutStep, setCheckoutStep] = useState('quantity');
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [listingBusy, setListingBusy] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [newListing, setNewListing] = useState({ name: '', type: '', stock: '', price: '' });
  const [clock, setClock] = useState(() => new Date());

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId);
  const selectedOwnerName = selectedOwner ? getOwnerName(selectedOwner, lang) : '';
  const activeCheckoutStep = transportSelection
    ? 'payment'
    : checkoutStep === 'transport'
      ? 'quantity'
      : checkoutStep;
  const activeTransportOption = transportSelection || transportOption;
  const ownProfile = linkedOwner?.id === selectedOwnerId;
  const totalStock = listings.reduce((total, listing) => total + Number(listing.available_stock || 0), 0);
  const receivedOrders = ownerOrders.filter((order) => activeOrderStatuses.has(order.status));
  const loadingOrders = ownerOrders.filter((order) => order.status === 'loading');
  const sentOrders = ownerOrders.filter((order) => ['dispatched', 'delivered'].includes(order.status));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadOwners = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('brick_owners')
      .select('id, display_name_en, display_name_te, location')
      .order('display_name_en');

    if (queryError) {
      setError(getMarketplaceErrorMessage(queryError, t));
      return;
    }
    if (data) setOwners(data);
  }, [t]);

  const loadSelectedOwner = useCallback(async () => {
    if (!selectedOwnerId) return;
    setLoading(true);
    setError('');

    try {
      const [listingResult, ownerResult] = await Promise.all([
        supabase
          .from('brick_listings')
          .select('id, owner_id, name, brick_type, available_stock, price_per_brick, is_active, rate_updated_at, stock_updated_at')
          .eq('owner_id', selectedOwnerId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        user
          ? supabase.rpc('get_my_brick_owner')
          : Promise.resolve({ data: null, error: null })
      ]);

      if (listingResult.error) {
        setError(getMarketplaceErrorMessage(listingResult.error, t));
        return;
      }
      setListings(listingResult.data || []);
      const ownerData = Array.isArray(ownerResult.data) ? ownerResult.data[0] : ownerResult.data;
      if (ownerResult.error) {
        setError(getMarketplaceErrorMessage(ownerResult.error, t));
        setLinkedOwner(null);
      } else {
        setLinkedOwner(ownerData || null);
      }

      if (user && ownerData?.id === selectedOwnerId) {
        const { data: orderData, error: orderError } = await supabase
          .from('brick_orders')
          .select('id, quantity, total_amount, advance_amount, amount_paid, payment_method, delivery_date, delivery_address, transport_option, status, created_at, customer_name, customer_phone, delivery_note, listing:brick_listings(name)')
          .eq('owner_id', selectedOwnerId)
          .in('status', ['offline_pending', 'paid', 'loading', 'dispatched', 'delivered'])
          .order('created_at', { ascending: false });
        if (orderError) {
          setError(getMarketplaceErrorMessage(orderError, t));
        } else {
          setOwnerOrders(orderData || []);
        }
      } else {
        setOwnerOrders([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedOwnerId, t, user]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  useEffect(() => {
    loadSelectedOwner();
  }, [loadSelectedOwner]);

  const updateListing = async (listing) => {
    const stock = Number(stockDrafts[listing.id] ?? listing.available_stock);
    const price = Number(priceDrafts[listing.id] ?? listing.price_per_brick);
    if (!Number.isSafeInteger(stock) || stock < 0 || !Number.isFinite(price) || price <= 0) {
      setError(t.ownerInvalidListing);
      return;
    }

    setListingBusy(true);
    setError('');
    const { error: updateError } = await supabase
      .from('brick_listings')
      .update({
        available_stock: stock,
        price_per_brick: price,
        stock_updated_at: new Date().toISOString(),
        rate_updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)
      .eq('owner_id', selectedOwnerId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice(t.ownerListingUpdated);
      await loadSelectedOwner();
    }
    setListingBusy(false);
  };

  const addListing = async (event) => {
    event.preventDefault();
    if (!linkedOwner || !newListing.name.trim() || !Number.isSafeInteger(Number(newListing.stock)) ||
      Number(newListing.stock) < 0 || !Number.isFinite(Number(newListing.price)) || Number(newListing.price) <= 0) {
      setError(t.ownerInvalidListing);
      return;
    }

    setListingBusy(true);
    setError('');
    const { error: insertError } = await supabase.from('brick_listings').insert({
      owner_id: linkedOwner.id,
      name: newListing.name.trim(),
      brick_type: newListing.type.trim(),
      available_stock: Number(newListing.stock),
      price_per_brick: Number(newListing.price)
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setNotice(t.ownerListingAdded);
      setNewListing({ name: '', type: '', stock: '', price: '' });
      await loadSelectedOwner();
    }
    setListingBusy(false);
  };

  const advanceOrder = async (order) => {
    const nextStatus = { paid: 'loading', loading: 'dispatched', dispatched: 'delivered' }[order.status];
    if (!nextStatus) return;
    setError('');
    const { error: updateError } = await supabase.rpc('update_brick_order_status', {
      p_order_id: order.id,
      p_next_status: nextStatus
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      await loadSelectedOwner();
    }
  };

  const cancelPayment = async (orderId) => {
    const { data, error: cancelError } = await supabase.functions.invoke('marketplace-payment', {
      body: { action: 'cancel', order_id: orderId }
    });
    if (cancelError) setError(await getFunctionErrorMessage(cancelError));
    if (data?.paid) {
      setNotice(t.paymentSuccessful);
      setCheckoutListing(null);
      await loadSelectedOwner();
    } else if (data?.cancelled) {
      await loadSelectedOwner();
    }
    return data;
  };

  const confirmOfflineAdvance = async (orderId) => {
    setError('');
    const { data, error: confirmError } = await supabase.rpc('confirm_offline_brick_advance', {
      p_order_id: orderId
    });
    if (confirmError) {
      setError(confirmError.message);
      return;
    }
    setNotice(`${t.offlineAdvanceConfirmed} ${data || ''}`);
    await loadSelectedOwner();
  };

  const buyListing = async (event) => {
    event.preventDefault();
    if (!checkoutListing) return;
    if (Number(quantity) * Number(checkoutListing.price_per_brick) < advanceAmount) {
      setError(t.advanceMinimumOrder);
      return;
    }
    setCheckoutBusy(true);
    setError('');
    setNotice('');
    let orderId;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('marketplace-payment', {
        body: {
          action: 'create',
          listing_id: checkoutListing.id,
          quantity: Number(quantity),
          delivery_note: deliveryNote,
          delivery_address: deliveryAddress.trim(),
          delivery_date: deliveryDate,
          transport_option: activeTransportOption,
          customer_email: customerEmail.trim(),
          payment_method: paymentMethod
        }
      });
      if (invokeError) throw new Error(await getFunctionErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);
      orderId = data.order_id;
      if (paymentMethod === 'offline') {
        setOrderConfirmation({
          id: orderId,
          invoiceNumber: '',
          listingName: checkoutListing.name,
          quantity: Number(quantity),
          totalAmount: Number(data.total_amount),
          amountPaid: 0,
          advanceAmount: Number(data.advance_amount || advanceAmount),
          customerEmail: customerEmail.trim(),
          deliveryDate,
          deliveryAddress: deliveryAddress.trim(),
          transportOption: activeTransportOption,
          status: 'offline_pending'
        });
        setCheckoutListing(null);
        setNotice(t.offlineOrderPending);
        await loadSelectedOwner();
        setCheckoutBusy(false);
        return;
      }
      if (Number(data.unit_price) !== Number(checkoutListing.price_per_brick)) {
        await cancelPayment(orderId);
        await loadSelectedOwner();
        throw new Error(t.ownerPriceChanged);
      }
      await loadRazorpay();

      const checkout = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpay_order_id,
        name: 'Bricks-Land',
        description: `${data.listing_name} · ${formatNumber(quantity)} bricks · Total ₹${Number(data.total_amount).toLocaleString('en-IN')} · Advance ₹${advanceAmount.toLocaleString('en-IN')}`,
        prefill: {
          name: user?.user_metadata?.full_name || '',
          contact: user?.phone || ''
        },
        theme: { color: '#e96f21' },
        handler: async (payment) => {
          const { data: verification, error: verificationError } = await supabase.functions.invoke('marketplace-payment', {
            body: {
              action: 'verify',
              order_id: orderId,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature
            }
          });
          if (verificationError || verification?.error) {
            setError(verification?.error || await getFunctionErrorMessage(verificationError));
          } else {
            setNotice(`${t.paymentSuccessful} ${verification.invoice_number}`);
            setOrderConfirmation({
              id: orderId,
              invoiceNumber: verification.invoice_number,
              listingName: checkoutListing.name,
              quantity: Number(quantity),
              totalAmount: Number(data.total_amount),
              amountPaid: Number(data.advance_amount || advanceAmount),
              advanceAmount: Number(data.advance_amount || advanceAmount),
              customerEmail: customerEmail.trim(),
              deliveryDate,
              deliveryAddress: deliveryAddress.trim(),
              transportOption: activeTransportOption,
              status: 'paid'
            });
            setCheckoutListing(null);
            await loadSelectedOwner();
          }
          setCheckoutBusy(false);
        }
      });

      checkout.on('payment.failed', async (response) => {
        await cancelPayment(orderId);
        setError(response.error?.description || t.paymentFailed);
        setCheckoutBusy(false);
      });
      checkout.on('modal.ondismiss', async () => {
        await cancelPayment(orderId);
        setCheckoutBusy(false);
      });
      checkout.open();
    } catch (checkoutError) {
      if (orderId) await cancelPayment(orderId);
      setError(checkoutError.message || t.paymentFailed);
      setCheckoutBusy(false);
    }
  };

  const profileName = (owner) => getOwnerName(owner, lang);
  const orderShareMessage = orderConfirmation ? [
    `${t.orderReference}: ${orderConfirmation.id}`,
    `${orderConfirmation.listingName} · ${formatNumber(orderConfirmation.quantity)} ${t.ownerBricks}`,
    `${t.brickSubtotal}: ₹${orderConfirmation.totalAmount}`,
    `${orderConfirmation.status === 'paid' ? t.invoiceAdvancePaid : t.advanceDue}: ₹${orderConfirmation.status === 'paid' ? orderConfirmation.amountPaid : orderConfirmation.advanceAmount}`,
    `${t.transportOption}: ${getTransportName(orderConfirmation.transportOption, t)}${orderConfirmation.transportOption === 'self_pickup' ? ' · ₹0' : ` · ${t.transportQuotePending}`}`,
    `${t.deliveryDate}: ${orderConfirmation.deliveryDate}`,
    `${t.deliveryAddress}: ${orderConfirmation.deliveryAddress}`,
    orderConfirmation.invoiceNumber ? `${t.invoiceNumber}: ${orderConfirmation.invoiceNumber}` : t.offlineOrderPending
  ].join('\n') : '';

  if (!selectedOwner) {
    return (
      <section>
        <div className="section-header">
          <h1 className="section-title">{t.ownersTitle}</h1>
          <p className="section-subtitle">{t.ownersSubtitle}</p>
        </div>

        {error && <div className="alert-box alert-error owner-feedback"><AlertCircle size={18} /><span>{error}</span></div>}
        <div className="cards-grid owner-cards-grid">
          {owners.map((owner) => (
            <button
              className="owner-profile-card"
              key={owner.id}
              type="button"
              onClick={() => {
                setError('');
                setNotice('');
                setSelectedOwnerId(owner.id);
              }}
              aria-label={`${profileName(owner)} - ${t.ownerProfile}`}
            >
              <span className="owner-avatar" aria-hidden="true">
                {(getOwnerName(owner, lang) || '?').split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </span>
              <span className="owner-profile-copy">
                <span className="owner-label">{t.ownerProfile}</span>
                <span className="owner-name">{profileName(owner)}</span>
              </span>
              <span className="owner-open-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="owner-detail-page">
      <button type="button" className="btn-outline owner-back-button" onClick={() => {
        setSelectedOwnerId(null);
        setCheckoutListing(null);
        setOrderConfirmation(null);
        setError('');
        setNotice('');
      }}>
        <ArrowLeft size={16} />
        <span>{t.ownerBack}</span>
      </button>

      <div className="owner-detail-banner">
        <div className="owner-detail-heading">
          <div className="owner-avatar owner-avatar-large" aria-hidden="true">
            {(selectedOwnerName || '?').split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <div>
            <span className="owner-label">{t.ownerProfile}</span>
            <h1 className="section-title">{selectedOwnerName}</h1>
            {selectedOwner.location && <p className="owner-location">{selectedOwner.location}</p>}
          </div>
        </div>
      </div>

      {error && <div className="alert-box alert-error owner-feedback"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert-box alert-success owner-feedback"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {ownProfile && (
        <>
          <div className="owner-stats-grid">
            <article className="owner-stat-card"><span>{t.ownerTotalStock}</span><strong>{formatNumber(totalStock)}</strong></article>
            <article className="owner-stat-card"><span>{t.ownerOrdersReceived}</span><strong>{formatNumber(receivedOrders.length)}</strong></article>
            <article className="owner-stat-card"><span>{t.ownerOrdersLoading}</span><strong>{formatNumber(loadingOrders.length)}</strong></article>
            <article className="owner-stat-card"><span>{t.ownerOrdersSent}</span><strong>{formatNumber(sentOrders.length)}</strong></article>
          </div>
          <div className="owner-management-panel">
            <h2>{t.ownerManageStock}</h2>
            <form className="owner-listing-form" onSubmit={addListing}>
              <label>{t.ownerBrickName}<input className="form-input" required maxLength="120" value={newListing.name} onChange={(event) => setNewListing({ ...newListing, name: event.target.value })} /></label>
              <label>{t.ownerBrickType}
                <select className="form-input" value={newListing.type} onChange={(event) => setNewListing({ ...newListing, type: event.target.value })} required>
                  <option value="">{t.ownerChooseBrickType}</option>
                  <option value="nela">{t.ownerNelaBrick}</option>
                  <option value="number">{t.ownerNumberBrick}</option>
                </select>
              </label>
              <label>{t.ownerStock}<input className="form-input" required type="number" min="0" step="1" value={newListing.stock} onChange={(event) => setNewListing({ ...newListing, stock: event.target.value })} /></label>
              <label>{t.ownerPrice}<input className="form-input" required type="number" min="0.01" step="0.01" value={newListing.price} onChange={(event) => setNewListing({ ...newListing, price: event.target.value })} /></label>
              <button className="btn-primary owner-form-action" type="submit" disabled={listingBusy}><PackagePlus size={16} />{t.ownerAddListing}</button>
            </form>
          </div>
        </>
      )}

      {loading ? (
        <div className="owner-loading"><LoaderCircle className="spin" size={20} />{t.ownerLoading}</div>
      ) : listings.length > 0 ? (
        <div className="cards-grid owner-listings-grid">
          {listings.map((listing) => {
            const rateFresh = isFreshSinceSixAm(listing.rate_updated_at, clock);
            const stockFresh = isFreshSinceSixAm(listing.stock_updated_at, clock);
            const listingFresh = rateFresh && stockFresh;
            return (
              <article className="content-card owner-listing-card" key={listing.id}>
              <div className="card-top">
                <div className="owner-listing-icon"><BrickWall size={22} /></div>
                <span className="card-badge">
                  {listing.brick_type === 'nela' ? t.ownerNelaBrick
                    : listing.brick_type === 'number' ? t.ownerNumberBrick
                      : listing.brick_type || t.ownerBrickType}
                </span>
              </div>
              <h2 className="card-title">{listing.name}</h2>
              <p className={`owner-data-freshness${listingFresh ? '' : ' stale'}`} role="status">
                {listingFresh ? t.ownerDataFresh : t.ownerDataStale}
              </p>
              {ownProfile ? (
                <div className="owner-edit-listing">
                  <label>{t.ownerStock}<input className="form-input" type="number" min="0" step="1" value={stockDrafts[listing.id] ?? listing.available_stock} onChange={(event) => setStockDrafts({ ...stockDrafts, [listing.id]: event.target.value })} /></label>
                  <label>{t.ownerPrice}<input className="form-input" type="number" min="0.01" step="0.01" value={priceDrafts[listing.id] ?? listing.price_per_brick} onChange={(event) => setPriceDrafts({ ...priceDrafts, [listing.id]: event.target.value })} /></label>
                  <button className="btn-outline" type="button" disabled={listingBusy} onClick={() => updateListing(listing)}>{t.ownerSaveListing}</button>
                </div>
              ) : (
                <>
                  <ul className="spec-list">
                    <li className="spec-item"><span className="spec-label">{t.ownerStock}</span><span className="spec-value">{formatNumber(listing.available_stock)} {t.ownerBricks}</span></li>
                    <li className="spec-item"><span className="spec-label">{t.ownerPrice}</span><span className="spec-value">₹{Number(listing.price_per_brick).toLocaleString('en-IN')} {t.ownerPerBrick}</span></li>
                  </ul>
                  {!listingFresh && <p className="owner-payment-note">{t.ownerRefreshBeforeOrder}</p>}
                  <button
                    type="button"
                    className="btn-primary owner-buy-button"
                    disabled={Number(listing.available_stock) < 100 || !user || !listingFresh}
                    onClick={() => {
                      onResetCheckoutNavigation();
                      setCheckoutListing(listing);
                      setQuantity(String(Math.min(1000, Math.floor(Number(listing.available_stock) / 100) * 100)));
                      setDeliveryAddress(user?.user_metadata?.delivery_address || '');
                      setCustomerEmail(user?.email || '');
                      setDeliveryDate(today());
                      setTransportOption('tractor');
                      setPaymentMethod('online');
                      setCheckoutStep('quantity');
                      setOrderConfirmation(null);
                      setError('');
                      setNotice('');
                    }}
                  >
                    <ShoppingCart size={16} />
                    <span>
                      {Number(listing.available_stock) <= 0
                        ? t.ownerOutOfStock
                        : Number(listing.available_stock) < 100
                          ? t.ownerMinimumStock
                          : t.ownerBuyNow}
                    </span>
                  </button>
                </>
              )}
              </article>
            );
          })}
        </div>
      ) : error ? null : (
        <div className="owner-empty-state">
          <BrickWall size={30} aria-hidden="true" />
          <p>{t.ownerNoListings}</p>
        </div>
      )}

      {checkoutListing && !ownProfile && (
        <form className="owner-checkout-panel" onSubmit={buyListing}>
          <div className="owner-checkout-heading">
            <div>
              <h2>{t.ownerPlaceOrder}</h2>
              <p>{checkoutListing.name} · ₹{Number(checkoutListing.price_per_brick).toLocaleString('en-IN')} {t.ownerPerBrick}</p>
            </div>
            <button type="button" className="owner-checkout-close" onClick={() => {
              setCheckoutListing(null);
              onResetCheckoutNavigation();
            }} aria-label={t.modalCancel}>×</button>
          </div>
          <div className="checkout-steps" aria-label={t.checkoutProgress}>
            <span className={activeCheckoutStep === 'quantity' ? 'active' : ''}>1. {t.ownerQuantity.split(' (')[0]}</span>
            <span className={activeCheckoutStep === 'transport' ? 'active' : ''}>2. {t.transportOption}</span>
            <span className={activeCheckoutStep === 'payment' ? 'active' : ''}>3. {t.paymentMethod}</span>
          </div>

          {activeCheckoutStep === 'quantity' && (
            <>
              <label>{t.ownerQuantity}<input className="form-input" type="number" min="100" step="100" max={checkoutListing.available_stock} value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
              <p className="owner-order-total">{t.brickSubtotal}: ₹{(Number(quantity || 0) * Number(checkoutListing.price_per_brick)).toLocaleString('en-IN')}</p>
              <button type="button" className="btn-primary" disabled={Number(quantity) < 100 || Number(quantity) > Number(checkoutListing.available_stock)} onClick={() => {
                setError('');
                setCheckoutStep('transport');
                onStartCheckout({
                  ownerName: selectedOwnerName,
                  listingName: checkoutListing.name,
                  quantity: Number(quantity),
                  totalAmount: Number(quantity) * Number(checkoutListing.price_per_brick),
                  transportOption
                });
              }}>{t.continueToTransport}</button>
            </>
          )}

          {activeCheckoutStep === 'payment' && (
            <>
              {Number(quantity) * Number(checkoutListing.price_per_brick) < advanceAmount && (
                <p className="owner-payment-note">{t.advanceMinimumOrder}</p>
              )}
              <label>{t.deliveryAddress}<textarea className="form-input" rows="2" maxLength="400" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} required minLength="8" /></label>
              <label>{t.deliveryDate}<input className="form-input" type="date" min={today()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} required /></label>
              <label>{t.customerEmail}<input className="form-input" type="email" maxLength="254" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
              <label>{t.ownerDeliveryNote}<textarea className="form-input" rows="2" maxLength="1000" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} /></label>
              <div className="checkout-summary">
                <div><span>{t.ownerQuantity}</span><strong>{formatNumber(quantity)} {t.ownerBricks}</strong></div>
                <div><span>{t.brickSubtotal}</span><strong>₹{(Number(quantity || 0) * Number(checkoutListing.price_per_brick)).toLocaleString('en-IN')}</strong></div>
                <div><span>{t.transportCharge}</span><strong>{activeTransportOption === 'self_pickup' ? '₹0' : t.transportQuotePending}</strong></div>
                <div><span>{t.advanceDue}</span><strong>₹{advanceAmount.toLocaleString('en-IN')}</strong></div>
                <div><span>{t.balanceAfterAdvance}</span><strong>₹{Math.max(0, Number(quantity || 0) * Number(checkoutListing.price_per_brick) - advanceAmount).toLocaleString('en-IN')}</strong></div>
              </div>
              <p className="owner-payment-note">
                {activeTransportOption === 'self_pickup' ? t.transportOwnArrangementNote : t.transportQuoteNotice}
              </p>
              <p className="owner-payment-note">{t.advanceRequiredNote}</p>
              <label>{t.paymentMethod}
                <select className="form-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="online">{t.onlinePayment}</option>
                  <option value="offline">{t.offlinePayment}</option>
                </select>
              </label>
              <p className="owner-payment-note">{paymentMethod === 'offline' ? t.offlinePaymentNote : t.advancePaymentNote}</p>
              <div className="checkout-step-actions">
                <button type="button" className="btn-outline" onClick={() => {
                  setCheckoutStep('transport');
                  onStartCheckout({
                    ownerName: selectedOwnerName,
                    listingName: checkoutListing.name,
                    quantity: Number(quantity),
                    totalAmount: Number(quantity) * Number(checkoutListing.price_per_brick),
                    transportOption: activeTransportOption
                  });
                }}>{t.back}</button>
                <button className="btn-primary" type="submit" disabled={checkoutBusy || Number(quantity) < 100 || Number(quantity) > Number(checkoutListing.available_stock) || Number(quantity) * Number(checkoutListing.price_per_brick) < advanceAmount}>
                  {checkoutBusy ? <LoaderCircle className="spin" size={16} /> : paymentMethod === 'online' ? <CreditCard size={16} /> : <Truck size={16} />}
                  <span>{checkoutBusy ? t.paymentProcessing : paymentMethod === 'online' ? t.payAdvance : t.placeOfflineOrder}</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {orderConfirmation && (
        <div className="owner-checkout-panel order-confirmation">
          <h2>{t.orderPlaced}</h2>
          <p>{t.orderReference}: #{orderConfirmation.id.slice(0, 8).toUpperCase()}</p>
          {orderConfirmation.invoiceNumber && <p>{t.invoiceNumber}: {orderConfirmation.invoiceNumber}</p>}
          <p>{orderConfirmation.listingName} · {formatNumber(orderConfirmation.quantity)} {t.ownerBricks}</p>
          <p>{t.brickSubtotal}: ₹{orderConfirmation.totalAmount.toLocaleString('en-IN')} · {orderConfirmation.status === 'paid' ? t.invoiceAdvancePaid : t.advanceDue}: ₹{orderConfirmation.status === 'paid' ? orderConfirmation.amountPaid : orderConfirmation.advanceAmount}</p>
          <p>{t.transportOption}: {getTransportName(orderConfirmation.transportOption, t)}{orderConfirmation.transportOption === 'self_pickup' ? ' · ₹0' : ` · ${t.transportQuotePending}`}</p>
          <p>{t.deliveryDate}: {new Date(`${orderConfirmation.deliveryDate}T00:00:00`).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')} · {t.deliveryAddress}: {orderConfirmation.deliveryAddress}</p>
          <p>{orderConfirmation.status === 'offline_pending' ? t.offlineOrderPending : t.invoiceAvailableInInvoices}</p>
          <div className="order-share-actions">
            <a className="btn-outline" href={`https://wa.me/?text=${encodeURIComponent(orderShareMessage)}`} target="_blank" rel="noreferrer">{t.shareWhatsApp}</a>
            <a className="btn-outline" href={`mailto:${encodeURIComponent(orderConfirmation.customerEmail || '')}?subject=${encodeURIComponent(`${t.orderPlaced} ${orderConfirmation.id.slice(0, 8).toUpperCase()}`)}&body=${encodeURIComponent(orderShareMessage)}`}>{t.shareEmail}</a>
          </div>
          <button type="button" className="btn-outline" onClick={() => setOrderConfirmation(null)}>{t.close}</button>
        </div>
      )}

      {ownProfile && (
        <section className="owner-orders-section">
          <h2>{t.ownerOrdersSection}</h2>
          {ownerOrders.length === 0 ? (
            <p className="owner-no-orders">{t.ownerNoOrders}</p>
          ) : ownerOrders.map((order) => {
            const nextAction = {
              paid: { status: 'loading', label: t.ownerMarkLoading },
              loading: { status: 'dispatched', label: t.ownerMarkSent },
              dispatched: { status: 'delivered', label: t.ownerMarkDelivered }
            }[order.status];
            return (
              <article className="owner-order-row" key={order.id}>
                <div>
                  <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                  {order.customer_name && <span>{t.invoiceCustomer}: {order.customer_name}</span>}
                  {order.customer_phone && <span>{order.customer_phone}</span>}
                  {order.listing?.name && <span>{order.listing.name}</span>}
                  <span>{formatNumber(order.quantity)} {t.ownerBricks} · ₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                  <span>{t.invoiceAdvancePaid}: ₹{Number(order.amount_paid).toLocaleString('en-IN')} · {order.payment_method === 'offline' ? t.offlinePayment : t.onlinePayment}</span>
                  {order.status === 'offline_pending' && <span>{t.advanceDue}: ₹{Number(order.advance_amount).toLocaleString('en-IN')}</span>}
                  {order.delivery_date && <span>{t.deliveryDate}: {new Date(`${order.delivery_date}T00:00:00`).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')}</span>}
                  <span>{t.transportOption}: {getTransportName(order.transport_option, t)}</span>
                  {order.delivery_address && <span>{t.deliveryAddress}: {order.delivery_address}</span>}
                  <span>{new Date(order.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')}</span>
                  {order.delivery_note && <span>{t.ownerDeliveryNote}: {order.delivery_note}</span>}
                </div>
                <div className="owner-order-actions">
                  <span className={`status-pill status-${order.status}`}>{t[`orderStatus_${order.status}`]}</span>
                  {order.status === 'offline_pending' && <button className="btn-outline" type="button" onClick={() => confirmOfflineAdvance(order.id)}>{t.confirmOfflineAdvance}</button>}
                  {nextAction && <button className="btn-outline" type="button" onClick={() => advanceOrder(order)}>{nextAction.label}</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}
