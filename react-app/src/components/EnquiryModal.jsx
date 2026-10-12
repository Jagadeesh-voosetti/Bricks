import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { BRICK_PRODUCTS } from '../data/mockData';

export default function EnquiryModal({ isOpen, onClose, preselectedBrick, t, user, onAddEnquiry }) {
  if (!isOpen) return null;

  const [selectedBrickName, setSelectedBrickName] = useState(
    preselectedBrick?.name || BRICK_PRODUCTS[0].name
  );
  const [quantity, setQuantity] = useState(2000);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!quantity || Number(quantity) < 100) {
      setError('Please enter a valid quantity of at least 100 bricks.');
      return;
    }

    setLoading(true);

    const newEnquiry = {
      brickName: selectedBrickName,
      quantity: Number(quantity),
      notes: notes.trim(),
      date: new Date().toLocaleDateString()
    };

    try {
      // If user is authenticated, attempt to record enquiry in Supabase orders table
      if (user?.id) {
        try {
          await supabase.from('orders').insert([
            {
              customer_id: user.id,
              quantity: Number(quantity),
              status: 'Pending Confirmation'
            }
          ]);
        } catch (dbErr) {
          console.warn('Could not record into Supabase orders table:', dbErr);
        }
      }

      onAddEnquiry(newEnquiry);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Error saving enquiry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 className="modal-title">{t.modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', color: '#64748b', padding: '4px' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="modal-subtitle">
          Submit your requirements to receive confirmed availability and local delivery charges.
        </p>

        {error && (
          <div className="alert-box alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        {success ? (
          <div className="alert-box alert-success" style={{ padding: '20px', textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
            <CheckCircle2 size={36} color="#15803d" />
            <div style={{ marginTop: '8px', fontWeight: 700, fontSize: '15px' }}>
              {t.modalSuccess}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Selected Brick / Product</label>
              <select
                className="form-input"
                style={{ paddingLeft: '14px' }}
                value={selectedBrickName}
                onChange={(e) => setSelectedBrickName(e.target.value)}
              >
                {BRICK_PRODUCTS.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} ({b.priceFormatted} / brick)
                  </option>
                ))}
                <option value="Transport Inquiry Only">Transport Inquiry Only (Truck / Tractor / Auto)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t.modalQuantityLabel}</label>
              <input
                type="number"
                min="100"
                step="100"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.modalNotesLabel}</label>
              <textarea
                className="form-input"
                style={{ height: '80px', padding: '10px 14px', resize: 'vertical' }}
                placeholder={t.modalNotesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={onClose}>
                {t.modalCancel}
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? t.modalSubmitting : t.modalSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
