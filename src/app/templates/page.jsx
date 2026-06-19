'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MI = ({ name, size = 18 }) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>;

const PLATFORMS = [
  { key: 'email', label: 'Email', icon: 'mail', color: '#3b82f6' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'work', color: '#0077b5' },
  { key: 'instagram', label: 'Instagram', icon: 'photo_camera', color: '#e1306c' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', color: '#25d366' },
  { key: 'telegram', label: 'Telegram', icon: 'send', color: '#0088cc' },
  { key: 'cold_calling', label: 'Cold Calling', icon: 'call', color: '#8b5cf6' },
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'ar', label: 'Arabic', flag: '🇦🇪' },
];

const STATUS_STYLES = {
  active:   { bg: '#dcfce7', text: '#166534', label: 'Active' },
  draft:    { bg: '#fef3c7', text: '#92400e', label: 'Draft' },
  archived: { bg: '#f3f4f6', text: '#6b7280', label: 'Archived' },
};

export default function TemplatesPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [viewLang, setViewLang] = useState('en');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && user && !isAdmin) router.push('/dashboard');
  }, [user, authLoading, router, isAdmin]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const url = activePlatform === 'all' ? '/api/templates' : `/api/templates?platform=${activePlatform}`;
      const res = await fetch(url);
      setTemplates(await res.json());
    } catch { setTemplates([]); }
    setLoading(false);
  }, [activePlatform]);

  useEffect(() => { if (user && isAdmin) fetchTemplates(); }, [user, isAdmin, fetchTemplates]);

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  }

  function openEdit(template) {
    setEditingTemplate(template);
    setViewLang(template.language || 'en');
    setShowModal(true);
  }

  function openNew() {
    setEditingTemplate(null);
    setViewLang('en');
    setShowModal(true);
  }

  function getTranslatedContent(template, lang) {
    if (lang === (template.language || 'en')) return { subject: template.subject, body: template.body };
    const t = typeof template.translations === 'string' ? JSON.parse(template.translations || '{}') : (template.translations || {});
    return t[lang] || { subject: template.subject, body: template.body };
  }

  const filtered = templates;
  const platformObj = PLATFORMS.find(p => p.key === activePlatform);

  if (authLoading || !user || !isAdmin) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Templates</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Outreach templates for all platforms with multi-language support</p>
        </div>
        <button onClick={openNew} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MI name="add" size={16} /> New Template
        </button>
      </div>

      {/* Platform Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setActivePlatform('all')}
          style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: activePlatform === 'all' ? 'var(--primary)' : '#f3f4f6', color: activePlatform === 'all' ? '#fff' : '#6b7280', whiteSpace: 'nowrap', transition: 'all .2s' }}>
          All Platforms
        </button>
        {PLATFORMS.map(p => (
          <button key={p.key} onClick={() => setActivePlatform(p.key)}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: activePlatform === p.key ? p.color : '#f3f4f6', color: activePlatform === p.key ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all .2s' }}>
            <MI name={p.icon} size={16} /> {p.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <MI name="description" size={40} />
          <p style={{ marginTop: 8, fontSize: '0.95rem' }}>No templates yet</p>
          <p style={{ fontSize: '0.78rem', marginTop: 4 }}>Create your first outreach template</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(t => {
            const plat = PLATFORMS.find(p => p.key === t.platform) || PLATFORMS[0];
            const st = STATUS_STYLES[t.status] || STATUS_STYLES.draft;
            return (
              <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', transition: 'box-shadow .2s' }}
                onClick={() => openEdit(t)} onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'} onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}>
                {/* Card Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: plat.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MI name={plat.icon} size={15} />
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{plat.label}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: st.bg, color: st.text }}>{st.label}</span>
                </div>
                {/* Card Body */}
                <div style={{ padding: '14px 16px' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>{t.name}</h3>
                  {t.subject && <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 6 }}>Subject: {t.subject}</div>}
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.body}
                  </p>
                </div>
                {/* Card Footer */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {LANGUAGES.filter(l => {
                      const trans = typeof t.translations === 'string' ? JSON.parse(t.translations || '{}') : (t.translations || {});
                      return l.code === (t.language || 'en') || trans[l.code];
                    }).map(l => (
                      <span key={l.code} title={l.label} style={{ fontSize: '0.8rem' }}>{l.flag}</span>
                    ))}
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                    <MI name="delete" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {showModal && <TemplateModal template={editingTemplate} lang={viewLang} setLang={setViewLang} onClose={() => setShowModal(false)} onSave={fetchTemplates} getTranslatedContent={getTranslatedContent} />}
    </div>
  );
}

function TemplateModal({ template, lang, setLang, onClose, onSave, getTranslatedContent }) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: template?.name || '',
    platform: template?.platform || 'email',
    status: template?.status || 'active',
    subject: template?.subject || '',
    body: template?.body || '',
    language: template?.language || 'en',
  });
  const [translations, setTranslations] = useState(() => {
    if (!template) return {};
    return typeof template.translations === 'string' ? JSON.parse(template.translations || '{}') : (template.translations || {});
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // When language tab changes, load that language's content into editing area
  const currentContent = lang === form.language
    ? { subject: form.subject, body: form.body }
    : (translations[lang] || { subject: '', body: '' });

  function updateContent(field, value) {
    if (lang === form.language) {
      setForm(f => ({ ...f, [field]: value }));
    } else {
      setTranslations(t => ({ ...t, [lang]: { ...t[lang], [field]: value } }));
    }
  }

  async function handleSave() {
    if (!form.name || !(lang === form.language ? form.body : translations[lang]?.body || form.body)) {
      setError('Name and body are required');
      return;
    }
    setSaving(true); setError('');
    const payload = { ...form, translations };

    const url = isEdit ? `/api/templates/${template.id}` : '/api/templates';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (res.ok) { onSave(); onClose(); }
    else { const d = await res.json(); setError(d.error || 'Failed'); }
    setSaving(false);
  }

  return (
    <div className="leads-modal-overlay" onClick={onClose}>
      <div className="leads-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '95vw' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{isEdit ? 'Edit Template' : 'New Template'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', marginBottom: 12 }}>{error}</div>}

        {/* Meta fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="leads-form-field"><label>Template Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="leads-form-field"><label>Platform</label>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
              {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="leads-form-field"><label>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Language Tabs */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Language</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {LANGUAGES.map(l => {
              const hasContent = l.code === form.language || translations[l.code]?.body;
              return (
                <button key={l.code} onClick={() => setLang(l.code)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: lang === l.code ? '2px solid var(--primary)' : '1px solid var(--border)', background: lang === l.code ? 'var(--primary-light, #eff6ff)' : '#fff', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, color: lang === l.code ? 'var(--primary)' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s', position: 'relative' }}>
                  <span>{l.flag}</span> {l.label}
                  {hasContent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', position: 'absolute', top: 3, right: 3 }} />}
                </button>
              );
            })}
          </div>
          {lang !== form.language && !translations[lang]?.body && (
            <p style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: 6 }}>⚠ No translation for {LANGUAGES.find(l => l.code === lang)?.label} yet — type below to add one</p>
          )}
        </div>

        {/* Subject (for email) */}
        {form.platform === 'email' && (
          <div className="leads-form-field" style={{ marginBottom: 12 }}>
            <label>Subject Line</label>
            <input value={currentContent.subject || ''} onChange={e => updateContent('subject', e.target.value)} placeholder="Email subject..." />
          </div>
        )}

        {/* Body */}
        <div className="leads-form-field" style={{ marginBottom: 16 }}>
          <label>Template Body *</label>
          <textarea rows={10} value={currentContent.body || ''} onChange={e => updateContent('body', e.target.value)}
            placeholder={`Write your ${PLATFORMS.find(p => p.key === form.platform)?.label || ''} template here...`}
            style={{ fontFamily: 'inherit', lineHeight: 1.6, fontSize: '0.82rem' }} />
        </div>

        {/* Placeholders hint */}
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
          💡 <strong>Variables:</strong> Use <code>{'{{company}}'}</code>, <code>{'{{decision_maker}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{sector}}'}</code>, <code>{'{{pain_point}}'}</code> as placeholders that get filled when sending.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : isEdit ? 'Update Template' : 'Create Template'}</button>
        </div>
      </div>
    </div>
  );
}
