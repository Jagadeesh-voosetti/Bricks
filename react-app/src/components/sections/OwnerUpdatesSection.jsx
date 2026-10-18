import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Save, Store } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { getMarketplaceErrorMessage } from '../../utils/marketplaceErrors';

const emptyListing = {
  id: '',
  type: '',
  stock: '',
  price: ''
};

const getListingName = (type) => ({
  nela: 'Nela bricks',
  number: 'Number bricks'
})[type] || type;

export default function OwnerUpdatesSection({ t, lang, ownerId }) {
  const [profile, setProfile] = useState({ nameEn: '', nameTe: '', location: '' });
  const [listings, setListings] = useState([]);
  const [listing, setListing] = useState(emptyListing);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOwnerDetails = useCallback(async () => {
    try {
      const [ownerResult, listingsResult] = await Promise.all([
        supabase
          .from('brick_owners')
          .select('id, display_name_en, display_name_te, location')
          .eq('id', ownerId)
          .maybeSingle(),
        supabase
          .from('brick_listings')
          .select('id, name, brick_type, available_stock, price_per_brick, is_active')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
      ]);

      if (ownerResult.error || listingsResult.error) {
        setError(getMarketplaceErrorMessage(ownerResult.error || listingsResult.error, t));
      } else if (!ownerResult.data) {
        setError(t.ownerProfileNotLinked);
      } else {
        setProfile({
          nameEn: ownerResult.data.display_name_en || '',
          nameTe: ownerResult.data.display_name_te || '',
          location: ownerResult.data.location || ''
        });
        const ownerListings = listingsResult.data || [];
        setListings(ownerListings);
        setListing((current) => {
          if (current.id) return current;
          const firstListing = ownerListings.find((item) => item.is_active);
          return firstListing
            ? {
              id: firstListing.id,
              type: firstListing.brick_type || '',
              stock: String(firstListing.available_stock),
              price: String(firstListing.price_per_brick)
            }
            : emptyListing;
        });
      }
    } catch (loadError) {
      setError(getMarketplaceErrorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [ownerId, t]);

  useEffect(() => {
    loadOwnerDetails();
  }, [loadOwnerDetails]);

  const selectListing = (listingId) => {
    if (!listingId) {
      setListing(emptyListing);
      return;
    }
    const selected = listings.find((item) => item.id === listingId);
    if (!selected) return;
    setListing({
      id: selected.id,
      type: selected.brick_type || '',
      stock: String(selected.available_stock),
      price: String(selected.price_per_brick)
    });
  };

  const saveOwnerDetails = async (event) => {
    event.preventDefault();
    const stock = Number(listing.stock);
    const price = Number(listing.price);
    if (
      !profile.nameEn.trim() ||
      !profile.nameTe.trim() ||
      !profile.location.trim() ||
      !listing.type.trim() ||
      listing.stock.trim() === '' ||
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError(t.ownerUpdateInvalid);
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data: savedListingId, error: saveError } = await supabase.rpc('save_my_brick_owner_details', {
        p_display_name_en: profile.nameEn.trim(),
        p_display_name_te: profile.nameTe.trim(),
        p_location: profile.location.trim(),
        p_listing_id: listing.id || null,
        p_listing_name: getListingName(listing.type),
        p_brick_type: listing.type.trim(),
        p_available_stock: stock,
        p_price_per_brick: price
      });

      if (saveError) {
        setError(getMarketplaceErrorMessage(saveError, t));
      } else {
        setListing((current) => ({ ...current, id: savedListingId }));
        setNotice(t.ownerUpdateSaved);
        await loadOwnerDetails();
      }
    } catch (saveError) {
      setError(getMarketplaceErrorMessage(saveError, t));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="owner-loading"><LoaderCircle className="spin" size={20} />{t.ownerLoading}</div>;
  }

  return (
    <section className="owner-detail-page">
      <div className="section-header">
        <h1 className="section-title">{t.ownerUpdatesTitle}</h1>
        <p className="section-subtitle">{t.ownerUpdatesSubtitle}</p>
      </div>

      {error && <div className="alert-box alert-error owner-feedback"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert-box alert-success owner-feedback"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {!error && (
        <form className="owner-checkout-panel owner-update-form" onSubmit={saveOwnerDetails}>
          <div className="owner-checkout-heading">
            <div>
              <h2><Store size={19} /> {t.ownerProfileDetails}</h2>
              <p>{lang === 'te' ? profile.nameTe : profile.nameEn}</p>
            </div>
          </div>

          <div className="owner-update-grid">
            <label>{t.ownerNameEnglish}
              <input className="form-input" required maxLength="120" value={profile.nameEn} onChange={(event) => setProfile({ ...profile, nameEn: event.target.value })} />
            </label>
            <label>{t.ownerNameTelugu}
              <input className="form-input" required maxLength="120" value={profile.nameTe} onChange={(event) => setProfile({ ...profile, nameTe: event.target.value })} />
            </label>
            <label>{t.ownerLocation}
              <input className="form-input" required maxLength="200" value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} />
            </label>
          </div>

          <div className="owner-update-divider" />

          <h2>{t.ownerListingDetails}</h2>
          <label>{t.ownerChooseListing}
            <select className="form-input" value={listing.id} onChange={(event) => selectListing(event.target.value)}>
              <option value="">{t.ownerAddNewListing}</option>
              {listings.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.brick_type === 'nela' ? t.ownerNelaBrick
                    : item.brick_type === 'number' ? t.ownerNumberBrick
                      : item.name}{item.is_active ? '' : ` · ${t.ownerInactiveListing}`}
                </option>
              ))}
            </select>
          </label>

          <div className="owner-update-grid">
            <label>{t.ownerBrickType}
              <select className="form-input" required value={listing.type} onChange={(event) => setListing({ ...listing, type: event.target.value })}>
                <option value="">{t.ownerChooseBrickType}</option>
                <option value="nela">{t.ownerNelaBrick}</option>
                <option value="number">{t.ownerNumberBrick}</option>
                {listing.type && !['nela', 'number'].includes(listing.type) && (
                  <option value={listing.type}>{listing.type}</option>
                )}
              </select>
            </label>
            <label>{t.ownerStock}
              <input className="form-input" required type="number" min="0" step="1" value={listing.stock} onChange={(event) => setListing({ ...listing, stock: event.target.value })} />
            </label>
            <label>{t.ownerPrice}
              <input className="form-input" required type="number" min="0.01" step="0.01" value={listing.price} onChange={(event) => setListing({ ...listing, price: event.target.value })} />
            </label>
          </div>

          <p className="owner-payment-note">{t.ownerUpdatePublishNotice}</p>
          <button className="btn-primary owner-form-action" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            <span>{saving ? t.ownerSaving : t.ownerSaveDetails}</span>
          </button>
        </form>
      )}
    </section>
  );
}
