import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, BrickWall, CheckCircle2, LoaderCircle, PackagePlus, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { BRICK_OWNERS } from '../../data/brickOwners';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
const activeOrderStatuses = new Set(['paid', 'loading', 'dispatched', 'delivered']);

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

const getFunctionErrorMessage = async (error) => {
  if (error?.context instanceof Response) {
    const responseBody = await error.context.clone().json().catch(() => null);
    if (typeof responseBody?.error === 'string') return responseBody.error;
  }
  return error?.message || 'The marketplace request failed.';
};

export default function BrickOwnersSection({ t, lang, user }) {
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
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [listingBusy, setListingBusy] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [newListing, setNewListing] = useState({ name: '', type: '', stock: '', price: '' });

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId);
  const selectedOwnerName = selectedOwner ? getOwnerName(selectedOwner, lang) : '';
  const ownProfile = linkedOwner?.id === selectedOwnerId;
  const totalStock = listings.reduce((total, listing) => total + Number(listing.available_stock || 0), 0);
  const receivedOrders = ownerOrders.filter((order) => activeOrderStatuses.has(order.status));
  const loadingOrders = ownerOrders.filter((order) => order.status === 'loading');
  const sentOrders = ownerOrders.filter((order) => ['dispatched', 'delivered'].includes(order.status));

  const loadOwners = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('brick_owners')
      .select('id, display_name_en, display_name_te, location')
      .order('display_name_en');

    if (queryError) {
      setError(queryError.message);
      return;
    }
    if (data) setOwners(data);
  }, []);

  const loadSelectedOwner = useCallback(async () => {
    if (!selectedOwnerId) return;
    setLoading(true);
    setError('');

    try {
      const [listingResult, ownerResult] = await Promise.all([
        supabase
          .from('brick_listings')
          .select('id, owner_id, name, brick_type, available_stock, price_per_brick, is_active')
          .eq('owner_id', selectedOwnerId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        user
          ? supabase.rpc('get_my_brick_owner')
          : Promise.resolve({ data: null, error: null })
      ]);

      if (listingResult.error) {
        setError(listingResult.error.message);
        return;
      }
      setListings(listingResult.data || []);
      const ownerData = Array.isArray(ownerResult.data) ? ownerResult.data[0] : ownerResult.data;
      if (ownerResult.error) {
        setError(ownerResult.error.message);
        setLinkedOwner(null);
      } else {
        setLinkedOwner(ownerData || null);
      }

      if (user && ownerData?.id === selectedOwnerId) {
        const { data: orderData, error: orderError } = await supabase
          .from('brick_orders')
          .select('id, quantity, total_amount, status, created_at, customer_name, customer_phone, delivery_note, listing:brick_listings(name)')
          .eq('owner_id', selectedOwnerId)
          .in('status', ['paid', 'loading', 'dispatched', 'delivered'])
          .order('created_at', { ascending: false });
        if (orderError) {
          setError(orderError.message);
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
  }, [selectedOwnerId, user]);

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
      .update({ available_stock: stock, price_per_brick: price })
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

  const buyListing = async (event) => {
    event.preventDefault();
    if (!checkoutListing) return;
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
          delivery_note: deliveryNote
        }
      });
      if (invokeError) throw new Error(await getFunctionErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);
      orderId = data.order_id;
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
        description: `${data.listing_name} · ${formatNumber(quantity)} bricks · ₹${Number(data.total_amount).toLocaleString('en-IN')}`,
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
              <label>{t.ownerBrickType}<input className="form-input" value={newListing.type} onChange={(event) => setNewListing({ ...newListing, type: event.target.value })} /></label>
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
          {listings.map((listing) => (
            <article className="content-card owner-listing-card" key={listing.id}>
              <div className="card-top">
                <div className="owner-listing-icon"><BrickWall size={22} /></div>
                <span className="card-badge">{listing.brick_type || t.ownerBrickType}</span>
              </div>
              <h2 className="card-title">{listing.name}</h2>
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
                  <button
                    type="button"
                    className="btn-primary owner-buy-button"
                      disabled={Number(listing.available_stock) < 100 || !user}
                    onClick={() => {
                      setCheckoutListing(listing);
                      setQuantity(String(Math.min(1000, Math.floor(Number(listing.available_stock) / 100) * 100)));
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
          ))}
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
            <button type="button" className="owner-checkout-close" onClick={() => setCheckoutListing(null)} aria-label={t.modalCancel}>×</button>
          </div>
          <label>{t.ownerQuantity}<input className="form-input" type="number" min="100" step="100" max={checkoutListing.available_stock} value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
          <label>{t.ownerDeliveryNote}<textarea className="form-input" rows="3" maxLength="1000" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} /></label>
          <p className="owner-order-total">{t.ownerTotal}: ₹{(Number(quantity || 0) * Number(checkoutListing.price_per_brick)).toLocaleString('en-IN')}</p>
          <button className="btn-primary" type="submit" disabled={checkoutBusy || Number(quantity) < 100 || Number(quantity) > Number(checkoutListing.available_stock)}>
            {checkoutBusy ? <LoaderCircle className="spin" size={16} /> : <Truck size={16} />}
            <span>{checkoutBusy ? t.paymentProcessing : t.ownerPayAndOrder}</span>
          </button>
          <p className="owner-payment-note">{t.ownerSecurePaymentNote}</p>
        </form>
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
                  <span>{new Date(order.created_at).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN')}</span>
                  {order.delivery_note && <span>{t.ownerDeliveryNote}: {order.delivery_note}</span>}
                </div>
                <div className="owner-order-actions">
                  <span className={`status-pill status-${order.status}`}>{t[`orderStatus_${order.status}`]}</span>
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
