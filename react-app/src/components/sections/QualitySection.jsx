import React from 'react';
import { ShieldCheck, Check, AlertCircle, FileText, Scale, Eye } from 'lucide-react';

export default function QualitySection({ t }) {
  const checklist = [
    { title: 'Standard Dimensions', desc: t.c1, icon: <Scale size={18} /> },
    { title: 'Metallic Ringing Sound', desc: t.c2, icon: <Check size={18} /> },
    { title: 'Drop Impact Resistance', desc: t.c3, icon: <Check size={18} /> },
    { title: 'Water Absorption Limit', desc: t.c4, icon: <Check size={18} /> },
    { title: 'Uniform Color & Texture', desc: t.c5, icon: <Eye size={18} /> },
    { title: 'Transit Load Verification', desc: t.c6, icon: <FileText size={18} /> }
  ];

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t.qualityTitle}</h1>
        <p className="section-subtitle">{t.qualitySubtitle}</p>
      </div>

      <div className="notice-card">
        <h4>
          <AlertCircle size={17} />
          <span>Objective Quality Standards</span>
        </h4>
        <p>
          Bricks-Land encourages on-site verification rather than unverifiable marketing claims. Inspect sample batches directly from the kiln or upon truck arrival using standard civil engineering field tests.
        </p>
      </div>

      <div className="checklist-container">
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#12394d', marginBottom: '6px' }}>
          {t.checklistTitle}
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
          Follow these 6 practical checks before masonry construction begins:
        </p>

        <div className="checklist-grid">
          {checklist.map((item, idx) => (
            <div key={idx} className="checklist-item">
              <div className="check-badge">✓</div>
              <div>
                <strong style={{ fontSize: '15px', color: '#12394d', display: 'block', marginBottom: '4px' }}>
                  {item.title}
                </strong>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Brick Grading Reference Card */}
      <div style={{ marginTop: '26px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#12394d', marginBottom: '16px' }}>
          📊 Kiln Burnt Clay Brick Classification (IS 1077)
        </h3>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class / Grade</th>
                <th>Avg. Compressive Strength</th>
                <th>Water Absorption (Max)</th>
                <th>Recommended Application</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Class 10 (First Class)</strong></td>
                <td>10.0 N/mm² (100 kg/cm²)</td>
                <td>Up to 15%</td>
                <td>Reinforced brickwork, multi-floor columns, exposed facades</td>
              </tr>
              <tr>
                <td><strong>Class 7.5 (Premium)</strong></td>
                <td>7.5 N/mm² (75 kg/cm²)</td>
                <td>Up to 20%</td>
                <td>Load-bearing exterior walls, residential villas</td>
              </tr>
              <tr>
                <td><strong>Class 5.0 (Standard)</strong></td>
                <td>5.0 N/mm² (50 kg/cm²)</td>
                <td>Up to 20%</td>
                <td>General residential masonry, partition walls</td>
              </tr>
              <tr>
                <td><strong>Class 3.5 (Economy)</strong></td>
                <td>3.5 N/mm² (35 kg/cm²)</td>
                <td>Up to 22%</td>
                <td>Temporary walls, sheds, compound boundary walls</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
