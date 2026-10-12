import React, { useState } from 'react';
import { BRICK_PRODUCTS } from '../../data/mockData';
import { Layers, Info, Check, MessageSquare, MapPin, Building2, ShieldAlert } from 'lucide-react';

export default function StockSection({ t, onOpenEnquiry }) {
  const [filter, setFilter] = useState('ALL');

  const filteredProducts = filter === 'ALL'
    ? BRICK_PRODUCTS
    : BRICK_PRODUCTS.filter(p => p.type.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t.stockTitle}</h1>
        <p className="section-subtitle">{t.stockSubtitle}</p>
      </div>

      {/* Disclaimed notice */}
      <div className="notice-card">
        <h4>
          <ShieldAlert size={17} />
          <span>Notice on Stock & Samples</span>
        </h4>
        <p>
          Inventory figures below represent standard production batch capacities from kilns in Parvathipuram. Always verify live ready stock and kiln firing cycles with the supplier prior to transport dispatch.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: t.filterAll },
          { id: 'Clay', label: 'Red Clay' },
          { id: 'Wirecut', label: 'Wirecut' },
          { id: 'Fly Ash', label: 'Fly Ash' }
        ].map(item => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'btn-primary' : 'btn-outline'}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="cards-grid">
        {filteredProducts.map((product) => (
          <article key={product.id} className="content-card">
            <div className="card-top">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: `${product.color}15`,
                  border: `1.5px solid ${product.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}
              >
                🧱
              </div>
              <span className="card-badge badge-sample">Sample Stock</span>
            </div>

            <h3 className="card-title">{product.name}</h3>
            <div style={{ fontSize: '13px', color: '#c2410c', fontWeight: 600, marginBottom: '8px' }}>
              {product.teluguName}
            </div>

            <p style={{ fontSize: '13px', color: '#5e7482', marginBottom: '12px' }}>
              {product.type}
            </p>

            <ul className="spec-list">
              <li className="spec-item">
                <span className="spec-label">{t.stockAvailable}</span>
                <span className="spec-value">{product.stock} bricks</span>
              </li>
              <li className="spec-item">
                <span className="spec-label">{t.qualityGrade}</span>
                <span className="spec-value">{product.compressiveStrength}</span>
              </li>
              <li className="spec-item">
                <span className="spec-label">Kiln / Supplier:</span>
                <span className="spec-value" style={{ textAlign: 'right' }}>
                  {product.supplier}
                </span>
              </li>
              <li className="spec-item">
                <span className="spec-label">Location:</span>
                <span className="spec-value">{product.supplierLocation}</span>
              </li>
            </ul>

            <div className="card-footer">
              <div>
                <div className="price-tag">
                  {product.priceFormatted} <small>{t.perBrick}</small>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenEnquiry(product)}
              >
                <MessageSquare size={16} />
                <span>{t.enquireBtn}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
