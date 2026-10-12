import React from 'react';
import { Info, Layers, ShieldCheck, Tag, Truck, Package, MessageSquareCheck, ArrowRight } from 'lucide-react';

export default function OverviewSection({ t, setActiveTab }) {
  const serviceCards = [
    {
      icon: <Layers size={26} color="#e96f21" />,
      title: t.svc1Title,
      text: t.svc1Text,
      targetTab: 'stock'
    },
    {
      icon: <ShieldCheck size={26} color="#15803d" />,
      title: t.svc2Title,
      text: t.svc2Text,
      targetTab: 'quality'
    },
    {
      icon: <Tag size={26} color="#0284c7" />,
      title: t.svc3Title,
      text: t.svc3Text,
      targetTab: 'prices'
    },
    {
      icon: <Truck size={26} color="#d97706" />,
      title: t.svc4Title,
      text: t.svc4Text,
      targetTab: 'transport'
    },
    {
      icon: <Package size={26} color="#9333ea" />,
      title: t.svc5Title,
      text: t.svc5Text,
      targetTab: 'orders'
    },
    {
      icon: <MessageSquareCheck size={26} color="#0d9488" />,
      title: t.svc6Title,
      text: t.svc6Text,
      targetTab: 'stock'
    }
  ];

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t.welcomeTitle}</h1>
        <p className="section-subtitle">{t.welcomeSubtitle}</p>
      </div>

      {/* Demo notice banner */}
      <div className="notice-card">
        <h4>
          <Info size={17} />
          <span>{t.demoNoticeTitle}</span>
        </h4>
        <p>{t.demoNotice}</p>
      </div>

      {/* What Bricks-Land Provides Section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#12394d', marginBottom: '6px' }}>
          {t.servicesTitle}
        </h2>
        <p style={{ color: '#5e7482', fontSize: '14px', marginBottom: '20px' }}>
          {t.servicesIntro}
        </p>

        <div className="cards-grid">
          {serviceCards.map((svc, idx) => (
            <article key={idx} className="content-card">
              <div className="card-top">
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {svc.icon}
                </div>
              </div>
              <h3 className="card-title">{svc.title}</h3>
              <p className="card-body">{svc.text}</p>
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setActiveTab(svc.targetTab)}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Explore</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Quality & Replacement Policy */}
      <div className="checklist-container" style={{ borderLeft: '4px solid #12394d' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#12394d', marginBottom: '8px' }}>
          🛡️ {t.policyTitle}
        </h3>
        <p style={{ color: '#4a6372', fontSize: '14px', lineHeight: '1.6' }}>
          {t.policyText}
        </p>
      </div>
    </div>
  );
}
