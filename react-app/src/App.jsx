import React, { lazy, Suspense, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { translations } from './translations';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import OverviewSection from './components/sections/OverviewSection';
import StockSection from './components/sections/StockSection';
import MaterialsSection from './components/sections/MaterialsSection';
import TransportSection from './components/sections/TransportSection';
import QualitySection from './components/sections/QualitySection';
import PricesSection from './components/sections/PricesSection';
import OrdersSection from './components/sections/OrdersSection';
import EnquiryModal from './components/EnquiryModal';
import OwnerUpdatesSection from './components/sections/OwnerUpdatesSection';

const BrickOwnersSection = lazy(() => import('./components/sections/BrickOwnersSection'));
const InvoicesSection = lazy(() => import('./components/sections/InvoicesSection'));

export default function App() {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('bricks_land_lang') || 'en';
  });

  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [linkedOwner, setLinkedOwner] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [marketplaceCheckout, setMarketplaceCheckout] = useState(null);
  const [marketplaceTransportSelection, setMarketplaceTransportSelection] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBrickForEnquiry, setSelectedBrickForEnquiry] = useState(null);
  const [localEnquiries, setLocalEnquiries] = useState(() => {
    try {
      const saved = localStorage.getItem('bricks_land_enquiries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Current translation object
  const t = translations[lang] || translations.en;

  // Persist language selection
  useEffect(() => {
    localStorage.setItem('bricks_land_lang', lang);
  }, [lang]);

  // Persist local enquiries
  useEffect(() => {
    localStorage.setItem('bricks_land_enquiries', JSON.stringify(localEnquiries));
  }, [localEnquiries]);

  // Check Supabase authentication status on load
  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setLoadingAuth(false);
        }
      } catch (err) {
        console.warn('Could not retrieve Supabase session:', err);
        if (mounted) setLoadingAuth(false);
      }
    }

    getInitialSession();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!session?.user?.id) return undefined;

    supabase.rpc('get_my_brick_owner')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Could not check linked brick owner profile:', error.message);
          return;
        }
        const owner = Array.isArray(data) ? data[0] : data;
        if (mounted) setLinkedOwner({ userId: session.user.id, ownerId: owner?.id || null });
      })
      .catch((error) => {
        console.warn('Could not check linked brick owner profile:', error);
      });

    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  const ownerProfileId = linkedOwner && session?.user?.id
    && linkedOwner.userId === session.user.id
    ? linkedOwner.ownerId
    : null;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setSession(null);
    setActiveTab('overview');
    setMarketplaceCheckout(null);
    setMarketplaceTransportSelection(null);
  };

  const handleOpenEnquiry = (brickItem = null) => {
    setSelectedBrickForEnquiry(brickItem);
    setIsModalOpen(true);
  };

  const handleAddEnquiry = (newEnquiry) => {
    setLocalEnquiries((prev) => [newEnquiry, ...prev]);
    setActiveTab('orders');
  };

  const handleStartMarketplaceCheckout = (checkout) => {
    setMarketplaceCheckout(checkout);
    setMarketplaceTransportSelection(null);
    setActiveTab('transport');
  };

  const handleContinueMarketplaceCheckout = (transportOption) => {
    setMarketplaceTransportSelection(transportOption);
    setMarketplaceCheckout(null);
    setActiveTab('owners');
  };

  const handleBackToMarketplaceQuantity = () => {
    setMarketplaceCheckout(null);
    setMarketplaceTransportSelection(null);
    setActiveTab('owners');
  };

  const handleResetMarketplaceCheckout = () => {
    setMarketplaceCheckout(null);
    setMarketplaceTransportSelection(null);
  };

  // Loading spinner during initial session check
  if (loadingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d2735',
          color: '#ffffff',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ fontSize: '42px', marginBottom: '16px' }}>🧱</div>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>Bricks-Land</div>
        <div style={{ fontSize: '13px', color: '#ff9d4d', marginTop: '6px' }}>
          Loading marketplace session...
        </div>
      </div>
    );
  }

  // If user is not authenticated, show only Auth page (Login / Signup)
  if (!session) {
    return (
      <div className="app-container">
        <Header
          lang={lang}
          setLang={setLang}
          t={t}
          user={null}
          onLogout={handleLogout}
        />
        <Auth
          t={t}
          onAuthSuccess={(newSession) => setSession(newSession)}
        />
        <footer className="app-footer">
          <p>{t.footerRights}</p>
        </footer>
      </div>
    );
  }

  // If user is authenticated, render the dashboard
  return (
    <div className="app-container">
      <Header
        lang={lang}
        setLang={setLang}
        t={t}
        user={session?.user}
        onLogout={handleLogout}
      />

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        t={t}
        orderCount={localEnquiries.length}
        isBrickOwner={Boolean(ownerProfileId)}
      />

      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewSection
            t={t}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'stock' && (
          <StockSection
            t={t}
            onOpenEnquiry={handleOpenEnquiry}
          />
        )}

        {activeTab === 'materials' && <MaterialsSection t={t} />}

        {activeTab === 'transport' && (
          <TransportSection
            t={t}
            onOpenEnquiry={handleOpenEnquiry}
            checkout={marketplaceCheckout}
            onContinueToPayment={handleContinueMarketplaceCheckout}
            onBackToQuantity={handleBackToMarketplaceQuantity}
          />
        )}

        {activeTab === 'quality' && (
          <QualitySection
            t={t}
          />
        )}

        {activeTab === 'prices' && (
          <PricesSection
            t={t}
            onOpenEnquiry={handleOpenEnquiry}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersSection
            t={t}
            user={session?.user}
            localEnquiries={localEnquiries}
            setActiveTab={setActiveTab}
            onOpenEnquiry={handleOpenEnquiry}
          />
        )}

        <div hidden={activeTab !== 'owners'}>
          <Suspense fallback={<div className="owner-loading">{t.ownerLoading || 'Loading...'}</div>}>
            <BrickOwnersSection
              t={t}
              lang={lang}
              user={session?.user}
              onStartCheckout={handleStartMarketplaceCheckout}
              transportSelection={marketplaceTransportSelection}
              onResetCheckoutNavigation={handleResetMarketplaceCheckout}
            />
          </Suspense>
        </div>

        {activeTab === 'ownerUpdates' && ownerProfileId && (
          <OwnerUpdatesSection key={ownerProfileId} t={t} lang={lang} ownerId={ownerProfileId} />
        )}

        {activeTab === 'invoices' && (
          <Suspense fallback={<div className="owner-loading">{t.ownerLoading || 'Loading...'}</div>}>
            <InvoicesSection t={t} lang={lang} user={session?.user} />
          </Suspense>
        )}
      </main>

      <EnquiryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preselectedBrick={selectedBrickForEnquiry}
        t={t}
        user={session?.user}
        onAddEnquiry={handleAddEnquiry}
      />

      <footer className="app-footer">
        <p>{t.footerRights}</p>
      </footer>
    </div>
  );
}
