import React from 'react';
import { LayoutDashboard, Layers, Truck, ShieldCheck, Tag, ShoppingBag, Users, FileText, FlaskConical, Store } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, t, orderCount, isMarketplaceAdmin }) {
  const tabs = [
    { id: 'overview', label: t.navOverview, icon: <LayoutDashboard size={17} /> },
    { id: 'stock', label: t.navStock, icon: <Layers size={17} /> },
    { id: 'materials', label: t.navMaterials, icon: <FlaskConical size={17} /> },
    { id: 'transport', label: t.navTransport, icon: <Truck size={17} /> },
    { id: 'quality', label: t.navQuality, icon: <ShieldCheck size={17} /> },
    { id: 'prices', label: t.navPrices, icon: <Tag size={17} /> },
    { id: 'owners', label: t.navOwners, icon: <Users size={17} /> },
    ...(isMarketplaceAdmin ? [{ id: 'adminOwnerEntry', label: t.navAdminOwnerEntry, icon: <Store size={17} /> }] : []),
    { id: 'invoices', label: t.navInvoices, icon: <FileText size={17} /> },
    {
      id: 'orders',
      label: t.navOrders,
      icon: <ShoppingBag size={17} />,
      badge: orderCount > 0 ? orderCount : null
    }
  ];

  return (
    <nav className="nav-bar" aria-label="Dashboard Navigation">
      <div className="nav-inner">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                style={{
                  background: activeTab === tab.id ? '#ffffff' : '#e96f21',
                  color: activeTab === tab.id ? '#12394d' : '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
