import React, { useState } from 'react';
import { ArrowLeft, BrickWall } from 'lucide-react';
import { BRICK_OWNERS } from '../../data/brickOwners';

const formatStock = (stock) => Number(stock).toLocaleString('en-IN');

export default function BrickOwnersSection({ t }) {
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const selectedOwner = BRICK_OWNERS.find((owner) => owner.id === selectedOwnerId);

  if (selectedOwner) {
    return (
      <section>
        <button
          type="button"
          className="btn-outline owner-back-button"
          onClick={() => setSelectedOwnerId(null)}
        >
          <ArrowLeft size={16} />
          <span>{t.ownerBack}</span>
        </button>

        <div className="owner-detail-heading">
          <div className="owner-avatar owner-avatar-large" aria-hidden="true">
            {selectedOwner.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <div>
            <span className="owner-label">{t.ownerProfile}</span>
            <h1 className="section-title">{selectedOwner.name}</h1>
          </div>
        </div>

        {selectedOwner.listings.length > 0 ? (
          <div className="cards-grid">
            {selectedOwner.listings.map((listing) => (
              <article className="content-card" key={listing.id}>
                <div className="card-top">
                  <div className="owner-listing-icon"><BrickWall size={22} /></div>
                  <span className="card-badge">{listing.type}</span>
                </div>
                <h2 className="card-title">{listing.name}</h2>
                <ul className="spec-list">
                  <li className="spec-item">
                    <span className="spec-label">{t.ownerStock}</span>
                    <span className="spec-value">{formatStock(listing.stock)} bricks</span>
                  </li>
                  <li className="spec-item">
                    <span className="spec-label">{t.ownerPrice}</span>
                    <span className="spec-value">₹{Number(listing.price).toLocaleString('en-IN')} {t.ownerPerBrick}</span>
                  </li>
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <div className="owner-empty-state">
            <BrickWall size={30} aria-hidden="true" />
            <p>{t.ownerNoListings}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="section-header">
        <h1 className="section-title">{t.ownersTitle}</h1>
        <p className="section-subtitle">{t.ownersSubtitle}</p>
      </div>

      <div className="cards-grid owner-cards-grid">
        {BRICK_OWNERS.map((owner) => (
          <button
            className="owner-profile-card"
            key={owner.id}
            type="button"
            onClick={() => setSelectedOwnerId(owner.id)}
            aria-label={`${owner.name} - ${t.ownerProfile}`}
          >
            <span className="owner-avatar" aria-hidden="true">
              {owner.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
            </span>
            <span className="owner-profile-copy">
              <span className="owner-label">{t.ownerProfile}</span>
              <span className="owner-name">{owner.name}</span>
            </span>
            <span className="owner-open-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
