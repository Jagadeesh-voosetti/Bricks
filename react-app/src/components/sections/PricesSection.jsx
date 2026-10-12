import React from 'react';
import { BRICK_PRODUCTS, PRICE_COMPARISONS } from '../../data/mockData';
import { Tag, HelpCircle, Calculator, TrendingUp, ShieldAlert } from 'lucide-react';

export default function PricesSection({ t, onOpenEnquiry }) {
  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t.pricesTitle}</h1>
        <p className="section-subtitle">{t.pricesSubtitle}</p>
      </div>

      <div className="notice-card">
        <h4>
          <ShieldAlert size={17} />
          <span>{t.rateNotice}</span>
        </h4>
        <p>
          Brick rates in Andhra Pradesh depend on seasonal soil availability, monsoon kiln shutdowns, and coal/fuel prices. Bulk bookings (5,000+ units) may qualify for negotiated kiln rates.
        </p>
      </div>

      {/* Baseline Rate Cards */}
      <div className="cards-grid" style={{ marginBottom: '32px' }}>
        {BRICK_PRODUCTS.map((brick) => (
          <article key={brick.id} className="content-card">
            <div className="card-top">
              <span className="card-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                Per Unit Price
              </span>
              <span className="card-badge badge-sample">Sample Rate</span>
            </div>

            <h3 className="card-title">{brick.name}</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              {brick.type}
            </p>

            <div style={{ margin: '10px 0' }}>
              <div className="price-tag">
                {brick.priceFormatted} <small>/ brick</small>
              </div>
              <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600, marginTop: '4px' }}>
                ₹{(brick.price * 1000).toLocaleString('en-IN')} per 1,000 bricks
              </div>
            </div>

            <div
              style={{
                fontSize: '12.5px',
                color: '#64748b',
                background: '#f8fafc',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                margin: '12px 0'
              }}
            >
              <strong>Transport note:</strong> Unloading & local transport extra per distance.
            </div>

            <div className="card-footer" style={{ borderTop: 'none', padding: 0 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onOpenEnquiry(brick)}
              >
                Request Quotation
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Comparison Table */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#12394d', marginBottom: '16px' }}>
          📋 Comprehensive Comparison Table (Parvathipuram Kiln Averages)
        </h3>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.compareColType}</th>
                <th>Rate (1000 Bricks)</th>
                <th>Estimated Local Transport</th>
                <th>{t.compareColUsage}</th>
              </tr>
            </thead>
            <tbody>
              {PRICE_COMPARISONS.map((row, idx) => (
                <tr key={idx}>
                  <td><strong>{row.type}</strong></td>
                  <td style={{ color: '#e96f21', fontWeight: 700 }}>{row.ratePer1000}</td>
                  <td>{row.transportEstimate}</td>
                  <td>{row.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Estimator helper note */}
      <div className="checklist-container" style={{ marginTop: '26px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#12394d', marginBottom: '8px' }}>
          💡 How to Calculate Your Total Requirement:
        </h4>
        <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.6' }}>
          A standard 9" thick brick wall generally requires approximately <strong>1,100 to 1,200 bricks per 100 square feet</strong> of wall area (including mortar allowances and standard 2-3% chipping/breakage). Confirm with your site civil engineer or mason before placing orders.
        </p>
      </div>
    </div>
  );
}
