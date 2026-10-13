import React from 'react';
import { AlertCircle, Droplets, Flame, FlaskConical, Factory, Mountain, Package, Waves } from 'lucide-react';

const materialIcons = [Mountain, Droplets, Waves, Factory, Package, FlaskConical, Flame];

export default function MaterialsSection({ t }) {
  return (
    <section aria-labelledby="materials-title">
      <div className="section-header">
        <h1 id="materials-title" className="section-title">{t.materialsTitle}</h1>
        <p className="section-subtitle">{t.materialsSubtitle}</p>
      </div>

      <div className="notice-card">
        <h4>
          <AlertCircle size={17} />
          <span>{t.materialsNoticeTitle}</span>
        </h4>
        <p>{t.materialsNotice}</p>
      </div>

      <div className="cards-grid">
        {t.materialItems.map((material, index) => {
          const Icon = materialIcons[index];

          return (
            <article key={material.name} className="content-card materials-card">
              <div className="materials-card-heading">
                <span className="materials-icon" aria-hidden="true">
                  <Icon size={21} />
                </span>
                <h2>{material.name}</h2>
              </div>
              <span className="materials-use">
                {t.materialsUseLabel}: {material.use}
              </span>
              <p>{material.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
