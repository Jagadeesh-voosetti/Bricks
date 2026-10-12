import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { ShoppingBag, Calendar, Clock, Layers, CheckCircle2, AlertCircle, RefreshCw, Plus } from 'lucide-react';

export default function OrdersSection({ t, user, localEnquiries, setActiveTab, onOpenEnquiry }) {
  const [dbOrders, setDbOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      // Query real orders table for authenticated user
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // If table query has issues or RLS restricts, log and gracefully display
        console.warn('Orders query returned:', error.message);
        setFetchError(error.message);
      } else {
        setDbOrders(data || []);
      }
    } catch (err) {
      console.warn('Could not query database orders:', err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  // Combine real database orders and any local session enquiries
  const totalCount = (dbOrders?.length || 0) + (localEnquiries?.length || 0);

  return (
    <div>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="section-title">{t.ordersTitle}</h1>
          <p className="section-subtitle">{t.ordersSubtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={fetchOrders}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onOpenEnquiry()}
          >
            <Plus size={16} />
            <span>{t.newEnquiryBtn}</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="alert-box alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Database Notice:</strong> {fetchError} (Showing local session enquiries below).
          </div>
        </div>
      )}

      {totalCount === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3 className="empty-title">{t.noOrdersTitle}</h3>
          <p className="empty-desc">{t.noOrdersDesc}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setActiveTab('stock')}
          >
            Browse Brick Stock
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '18px' }}>
          {/* Real Supabase Database Orders */}
          {dbOrders.map((order) => (
            <article key={order.id} className="content-card" style={{ borderLeft: '4px solid #15803d' }}>
              <div className="card-top">
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {t.orderId}: <strong style={{ color: '#0f172a' }}>#{String(order.id).slice(0, 8)}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`status-pill status-${(order.status || 'pending').toLowerCase()}`}>
                  {order.status || t.statusPending}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '14px 0', fontSize: '14px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>{t.orderQuantity}: </span>
                  <strong>{order.quantity?.toLocaleString('en-IN') || '—'} bricks</strong>
                </div>
                {order.total_amount && (
                  <div>
                    <span style={{ color: '#64748b' }}>Total Amount: </span>
                    <strong style={{ color: '#e96f21' }}>₹{Number(order.total_amount).toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div>
                  <span style={{ color: '#64748b' }}>Data Source: </span>
                  <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    Live Supabase Database
                  </span>
                </div>
              </div>
            </article>
          ))}

          {/* Session / Local Enquiries */}
          {localEnquiries.map((enq, idx) => (
            <article key={idx} className="content-card" style={{ borderLeft: '4px solid #e96f21' }}>
              <div className="card-top">
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Enquiry Ref: <strong style={{ color: '#0f172a' }}>ENQ-{idx + 101}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {enq.date || 'Today'}
                  </div>
                </div>
                <span className="status-pill status-pending">
                  {t.statusPending}
                </span>
              </div>

              <div style={{ margin: '12px 0' }}>
                <h3 style={{ fontSize: '17px', color: '#12394d', marginBottom: '6px' }}>
                  {enq.brickName}
                </h3>
                <div style={{ fontSize: '14px', color: '#334155' }}>
                  <strong>{t.orderQuantity}:</strong> {Number(enq.quantity).toLocaleString('en-IN')} bricks
                </div>
                {enq.notes && (
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    <strong>Site Note:</strong> {enq.notes}
                  </p>
                )}
              </div>

              <div className="card-footer" style={{ borderTop: '1px dashed #e2e8f0', padding: '10px 0 0' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Status: Sent to manufacturer for price verification & delivery confirmation.
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
