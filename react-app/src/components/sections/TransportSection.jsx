import React, { useState } from 'react';
import { TRANSPORT_OPTIONS } from '../../data/mockData';
import { AlertTriangle } from 'lucide-react';

export default function TransportSection({
  t,
  onOpenEnquiry,
  checkout,
  onContinueToPayment,
  onBackToQuantity
}) {
  const [transportOption, setTransportOption] = useState(checkout?.transportOption || 'tractor');

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t.transportTitle}</h1>
        <p className="section-subtitle">{t.transportSubtitle}</p>
      </div>

      {checkout && (
        <section className="owner-checkout-panel transport-checkout-panel">
          <h2>{t.transportCheckoutTitle}</h2>
          <p className="section-subtitle">{t.transportCheckoutSubtitle}</p>
          <div className="checkout-summary">
            <div><span>{t.ownerProfile}</span><strong>{checkout.ownerName}</strong></div>
            <div><span>{t.ownerBrickName}</span><strong>{checkout.listingName}</strong></div>
            <div><span>{t.ownerQuantity}</span><strong>{Number(checkout.quantity).toLocaleString('en-IN')} {t.ownerBricks}</strong></div>
            <div><span>{t.brickSubtotal}</span><strong>₹{Number(checkout.totalAmount).toLocaleString('en-IN')}</strong></div>
          </div>
          <label>
            {t.transportOption}
            <select
              className="form-input"
              value={transportOption}
              onChange={(event) => setTransportOption(event.target.value)}
            >
              <option value="tractor">{t.transportTractor}</option>
              <option value="mini_truck">{t.transportMiniTruck}</option>
              <option value="lorry">{t.transportLorry}</option>
              <option value="self_pickup">{t.transportSelfPickup}</option>
            </select>
          </label>
          <p className="owner-payment-note">
            {transportOption === 'self_pickup' ? t.transportOwnArrangementNote : t.transportQuoteNotice}
          </p>
          <div className="checkout-step-actions">
            <button type="button" className="btn-outline" onClick={onBackToQuantity}>{t.back}</button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onContinueToPayment(transportOption)}
            >
              {t.continueToPayment}
            </button>
          </div>
        </section>
      )}

      {/* Transport pricing factors notice */}
      <div className="notice-card">
        <h4>
          <AlertTriangle size={17} />
          <span>Important Transportation & Road Access Notice</span>
        </h4>
        <p>{t.transportNotice}</p>
      </div>

      <div className="cards-grid">
        {TRANSPORT_OPTIONS.map((item) => (
          <article key={item.id} className="content-card">
            <div className="card-top">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px'
                }}
              >
                {item.icon}
              </div>
              <span className="card-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                {item.capacity}
              </span>
            </div>

            <h3 className="card-title">{item.title}</h3>
            <div style={{ fontSize: '13px', color: '#c2410c', fontWeight: 600, marginBottom: '10px' }}>
              {item.teluguTitle}
            </div>

            <div className="card-body">
              <p style={{ marginBottom: '10px' }}>
                <strong>Best For:</strong> {item.bestFor}
              </p>
              <p style={{ marginBottom: '12px', color: '#64748b' }}>
                <strong>Site Accessibility:</strong> {item.routeAccess}
              </p>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                color: '#475569',
                marginBottom: '16px'
              }}
            >
              ℹ️ {item.estimatedChargeNote}
            </div>

            <div className="card-footer">
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {t.chargesDisclaimer}
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  onOpenEnquiry({
                    name: `Transport Booking: ${item.title}`,
                    priceFormatted: 'Distance-based quote',
                    supplier: 'Local Parvathipuram Transport Union'
                  })
                }
              >
                {t.checkAvailabilityBtn}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Guidelines for site delivery */}
      <div className="checklist-container" style={{ marginTop: '30px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#12394d', marginBottom: '12px' }}>
          🚚 Delivery Guidelines & Unloading Advice
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '13.5px', color: '#334155' }}>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <strong>1. Approach Road Check:</strong>
            <p style={{ marginTop: '4px', color: '#64748b' }}>Verify overhead electrical cables and narrow culverts leading to your construction site before selecting a heavy lorry.</p>
          </div>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <strong>2. Ground Stacking Area:</strong>
            <p style={{ marginTop: '4px', color: '#64748b' }}>Ensure a flat, firm ground is cleared near your construction foundation so bricks are not dumped into waterlogged soil.</p>
          </div>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <strong>3. Unloading Labor:</strong>
            <p style={{ marginTop: '4px', color: '#64748b' }}>Manual stacking helps count exact units and inspect transit breakages prior to truck departure.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
