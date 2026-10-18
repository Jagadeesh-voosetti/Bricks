import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Save, Store } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { getMarketplaceErrorMessage } from '../../utils/marketplaceErrors';

const emptyListing = { name: '', type: '', stock: '', price: '' };

export default function AdminOwnerEntrySection({ t }) {
  const [owners, setOwners] = useState([]);
  const [listings, setListings] = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [owner, setOwner] = useState({ nameEn: '', nameTe: '', location: '' });
  const [listing, setListing] = useState(emptyListing);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOwners = useCallback(async () => {
    setError('');
    try {
      const { data, error: loadError } = await supabase
        .from('brick_owners')
        .select('id, display_name_en, display_name_te, location')
        .order('display_name_en');
      if (loadError) throw loadError;
      setOwners(data || []);
    } catch (loadError) {
      setError(getMarketplaceErrorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const loadOwnerListings = useCallback(async (selectedOwnerId) => {
    if (!selectedOwnerId) {
      setListings([]);
      return;
    }
    const { data, error: loadError } = await supabase
      .from('brick_listings')
      .select('id, name, brick_type, available_stock, price_per_brick, is_active')
      .eq('owner_id', selectedOwnerId)
      .order('created_at', { ascending: false });
    if (loadError) {
      setError(getMarketplaceErrorMessage(loadError, t));
      return;
    }
    setListings(data || []);
  }, [t]);

  const selectOwner = async (selectedId) => {
    setOwnerId(selectedId);
    setNotice('');
    setError('');
    setListing(emptyListing);
    const selectedOwner = owners.find((item) => item.id === selectedId);
    setOwner(selectedOwner
      ? {
        nameEn: selectedOwner.display_name_en || '',
        nameTe: selectedOwner.display_name_te || '',
        location: selectedOwner.location || ''
      }
      : { nameEn: '', nameTe: '', location: '' });
    await loadOwnerListings(selectedId);
  };

  const selectListing = (selectedId) => {
    const selected = listings.find((item) => item.id === selectedId);
    setListing(selected
      ? {
        id: selected.id,
        name: selected.name,
        type: selected.brick_type || '',
        stock: String(selected.available_stock),
        price: String(selected.price_per_brick)
      }
      : emptyListing);
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const { data: savedOwnerId, error: saveError } = await supabase.rpc('admin_save_brick_owner_listing', {
        p_owner_id: ownerId || null,
        p_listing_id: listing.id || null,
        p_display_name_en: owner.nameEn.trim(),
        p_display_name_te: owner.nameTe.trim(),
        p_location: owner.location.trim(),
        p_listing_name: listing.name.trim(),
        p_brick_type: listing.type.trim(),
        p_available_stock: Number(listing.stock),
        p_price_per_brick: Number(listing.price)
      });
      if (saveError) throw saveError;

      setOwnerId(savedOwnerId);
      setNotice(t.adminOwnerSaved);
      setListing(emptyListing);
      await loadOwners();
      await loadOwnerListings(savedOwnerId);
    } catch (saveError) {
      setError(getMarketplaceErrorMessage(saveError, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-owner-entry">
      <div className="section-header">
        <h1 className="section-title">{t.adminOwnerEntryTitle}</h1>
        <p className="section-subtitle">{t.adminOwnerEntrySubtitle}</p>
      </div>

      {error && (
        <div className="owner-feedback error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="owner-feedback success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="owner-loading"><LoaderCircle size={18} className="spinner" />{t.ownerLoading}</div>
      ) : (
        <form className="owner-update-card admin-owner-entry-form" onSubmit={saveDetails}>
          <label>
            {t.adminSelectOwner}
            <select className="form-input" value={ownerId} onChange={(event) => selectOwner(event.target.value)}>
              <option value="">{t.adminNewOwner}</option>
              {owners.map((item) => (
                <option key={item.id} value={item.id}>{item.display_name_en} · {item.location}</option>
              ))}
            </select>
          </label>

          <div className="owner-listing-form">
            <label>{t.ownerNameEnglish}<input className="form-input" value={owner.nameEn} onChange={(event) => setOwner((current) => ({ ...current, nameEn: event.target.value }))} required maxLength={120} /></label>
            <label>{t.ownerNameTelugu}<input className="form-input" value={owner.nameTe} onChange={(event) => setOwner((current) => ({ ...current, nameTe: event.target.value }))} required maxLength={120} /></label>
            <label>{t.ownerLocation}<input className="form-input" value={owner.location} onChange={(event) => setOwner((current) => ({ ...current, location: event.target.value }))} required maxLength={200} /></label>
          </div>

          <h2 className="admin-owner-entry-subheading"><Store size={18} />{t.ownerListingDetails}</h2>
          {ownerId && (
            <label>
              {t.ownerChooseListing}
              <select className="form-input" value={listing.id} onChange={(event) => selectListing(event.target.value)}>
                <option value="">{t.ownerAddNewListing}</option>
                {listings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.is_active ? '' : ` · ${t.ownerInactiveListing}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="owner-listing-form">
            <label>{t.adminBrickName}<input className="form-input" value={listing.name} onChange={(event) => setListing((current) => ({ ...current, name: event.target.value }))} required maxLength={120} /></label>
            <label>{t.adminBrickType}<input className="form-input" value={listing.type} onChange={(event) => setListing((current) => ({ ...current, type: event.target.value }))} maxLength={120} /></label>
            <label>{t.adminAvailableStock}<input className="form-input" type="number" min="0" step="1" value={listing.stock} onChange={(event) => setListing((current) => ({ ...current, stock: event.target.value }))} required /></label>
            <label>{t.adminPricePerBrick}<input className="form-input" type="number" min="0.01" step="0.01" value={listing.price} onChange={(event) => setListing((current) => ({ ...current, price: event.target.value }))} required /></label>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <LoaderCircle size={17} className="spinner" /> : <Save size={17} />}
            {saving ? t.ownerSaving : t.adminSaveOwnerListing}
          </button>
        </form>
      )}
    </section>
  );
}
