import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, Copy, Search, ShieldCheck, X } from 'lucide-react';
import { alphabetic } from './domain';
import type { Impact } from './types';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'amber' }) {
  return <span className={`badge ${tone}`}>{tone === 'green' && <span className="status-dot" />}{children}</span>;
}
export function Status({ active }: { active: boolean }) {
  return <Badge tone={active ? 'green' : 'neutral'}>{active ? 'Actif' : 'Inactif'}</Badge>;
}
export function CompatibilityWarning() {
  return <span className="compatibility-warning">Ne pas modifier/supprimer</span>;
}
export function SearchBox({ value, onChange, placeholder = 'Rechercher…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={17} /><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />{value && <button type="button" className="icon-btn" aria-label="Effacer la recherche" onClick={() => onChange('')}><X size={14} /></button>}</label>;
}
export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Select({ label, value, options, onChange, required, disabled }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  const items = alphabetic(options.map(o => typeof o === 'string' ? { value: o, label: o } : o), o => o.label);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const validationRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    validationRef.current?.setCustomValidity(required && !value ? `Choisissez une valeur pour « ${label} ».` : '');
  }, [label, required, value]);
  return <div ref={ref} className="single-select-field">
    <MultiSelectDropdown label={label} values={[value]} options={items} singleSelection disabled={disabled}
      onChange={selected => { setInvalid(false); onChange(selected[0]); }} />
    {/* Preserve form validation without a native select popup in embedded browsers. */}
    <input ref={validationRef} type="text" className="sr-only" aria-hidden="true" tabIndex={-1} value={value} required={required} disabled={disabled}
      onChange={event => onChange(event.target.value)}
      onInvalid={event => { event.preventDefault(); setInvalid(true); ref.current?.querySelector('button')?.focus(); }} />
    {invalid && <p className="form-error" role="alert">Choisissez une valeur pour « {label} ».</p>}
  </div>;
}
export function FilterDropdown({ label, values, options, onChange, allLabel = 'Tous' }: {
  label: string;
  values: string[];
  options: (string | { value: string; label: string })[];
  onChange: (values: string[]) => void;
  allLabel?: string;
}) {
  const items = alphabetic(options.map(option => typeof option === 'string' ? { value: option, label: option } : option), option => option.label);
  return <MultiSelectDropdown label={label} options={[{ value: '', label: allLabel }, ...items]}
    values={values.length ? values : ['']} exclusiveValue=""
    onChange={selected => onChange(selected.filter(value => value !== ''))} />;
}
export function CheckField({ children, checked, onChange, disabled }: { children: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="check-field"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>;
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <div className={`notice ${warning ? 'warning' : ''}`}>{warning ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}<div>{children}</div></div>;
}
export function Empty({ children = 'Aucun résultat. Essayez de modifier vos filtres.' }: { children?: ReactNode }) {
  return <div className="empty"><Search size={27} /><h3>Aucun élément à afficher</h3><p>{children}</p></div>;
}
export function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function Modal({ title, subtitle, children, headerAside, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; headerAside?: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useRef(`dialog-${crypto.randomUUID()}`).current;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={wide ? 'modal modal-wide' : 'modal'} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className={`modal-header${headerAside ? ' with-aside' : ''}`}><div><div className="eyebrow">PARAMÉTRAGE <Badge tone="amber">DEV · Simulation</Badge></div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{headerAside && <div className="modal-header-aside">{headerAside}</div>}<button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}><X size={21} /></button></div>
    {children}
  </dialog>;
}
export function FormActions({ onClose, label = 'Enregistrer' }: { onClose: () => void; label?: string }) {
  return <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Annuler</button><button type="submit" className="btn primary"><Check size={16} />{label}</button></div>;
}
export function MultiSelectDropdown({ label, options, values, onChange, exclusiveValue, singleSelection = false, disabled = false }: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  exclusiveValue?: string;
  singleSelection?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [open]);
  const selectedLabels = values.map(value => options.find(option => option.value === value)?.label || value);
  const toggle = (value: string, checked: boolean) => {
    if (singleSelection) {
      if (checked) onChange([value]);
      else if (options.some(option => option.value === '')) onChange(['']);
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
      return;
    }
    if (!checked) { onChange(values.filter(selected => selected !== value)); return; }
    if (value === exclusiveValue) { onChange([value]); return; }
    onChange([...values.filter(selected => selected !== exclusiveValue && selected !== value), value]);
  };
  return <div className="field multi-select-field">
    <span>{label}</span>
    <div ref={ref} className="multi-select-dropdown" data-open={open || undefined}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button type="button" aria-label={`${label} : ${selectedLabels.join(', ') || 'Aucune sélection'}`} disabled={disabled}
        aria-expanded={open} aria-controls={optionsId} onClick={() => setOpen(current => !current)}
        title={selectedLabels.join(', ')}>{selectedLabels.join(', ') || (singleSelection ? 'Choisir une valeur' : 'Choisir une ou plusieurs valeurs')}</button>
      {open && <div id={optionsId} className="multi-select-options" role="group" aria-label={label}>
        {options.map(option => <label key={option.value}>
          <input type="checkbox" checked={values.includes(option.value)} disabled={disabled} onChange={event => toggle(option.value, event.target.checked)} />
          <span>{option.label}</span>
        </label>)}
      </div>}
    </div>
  </div>;
}
export function Confirmation({ impact, onClose, supportMode = false }: { impact: Impact; onClose: () => void; supportMode?: boolean }) {
  const [accepted, setAccepted] = useState(false);
  const [failed, setFailed] = useState(false);
  return <Modal title={impact.title} subtitle="Vérifiez les impacts avant de poursuivre." onClose={onClose}>
    <div className="modal-body stack">
      <div className="confirmation-icon"><ShieldCheck size={28} /></div>
      <p>{impact.description}</p><div className="scope-summary"><span>PÉRIMÈTRE DE LA MODIFICATION</span><strong>{impact.scope}</strong></div>
      {supportMode && impact.technical && <TechnicalInfo ids={impact.technical.ids} tables={impact.technical.tables} />}
      <div className="impact-grid">{impact.facts.map(f => <div key={f.label}><strong>{f.value}</strong><span>{f.label}</span></div>)}</div>
      {impact.warning && <Notice warning>{impact.warning}</Notice>}
      {impact.compatibilityWarning && <CompatibilityWarning />}
      <Notice>Aucune donnée réelle n’est modifiée. L’opération est enregistrée dans le journal local et la dernière modification peut être annulée.</Notice>
      <CheckField checked={accepted} onChange={setAccepted}>J’ai vérifié le périmètre et je confirme cette modification.</CheckField>
      {failed && <p className="form-error" role="alert">La modification n’a pas été enregistrée. Consultez le détail dans la notification ; vos données restent inchangées.</p>}
    </div>
    <div className="modal-actions"><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!accepted} onClick={() => { if (impact.apply()) onClose(); else setFailed(true); }}><ShieldCheck size={17} />{impact.confirmLabel || 'Confirmer la modification'}</button></div>
  </Modal>;
}
export function RowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-link" onClick={onClick}>{children}<ChevronRight size={15} /></button>;
}
export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('');
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('La copie dans le presse-papiers n’est pas disponible dans ce navigateur.');
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copié.`);
    } catch (cause) {
      setMessage(`Copie impossible : ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };
  return <span className="copy-value">
    <button type="button" className="btn small" onClick={copy}><Copy size={13} />Copier {label}</button>
    {message && <small role="status">{message}</small>}
  </span>;
}
export function TechnicalInfo({ ids, fields = [], tables }: {
  ids: { label: string; value: string }[];
  fields?: { label: string; value: string }[];
  tables: string[];
}) {
  return <div className="technical-info">
    <div className="technical-info-ids">
      <strong>Identifiants simulés</strong>
      {ids.map(item => <div className="technical-info-row" key={item.label}>
        <span>{item.label}</span><code>{item.value}</code><CopyValueButton value={item.value} label="l’identifiant" />
      </div>)}
    </div>
    {(fields.length > 0 || tables.length > 0) && <details>
      <summary>Informations techniques complémentaires</summary>
      <div className="technical-info-body">
        {fields.map((item, index) => <div className="technical-info-row" key={`${item.label}-${index}-${item.value}`}>
          <span>{item.label}</span><code>{item.value}</code>
        </div>)}
        {!!tables.length && <div className="technical-info-tables">
          <strong>Tables simulées</strong>
          {tables.map(table => <div className="technical-info-row" key={table}>
            <code>{table}</code><CopyValueButton value={table} label="le nom de table" />
          </div>)}
        </div>}
        <p>Données techniques simulées. Correspondances à confirmer avec le schéma DIAMS.</p>
      </div>
    </details>}
  </div>;
}
export function TechnicalInlineId({ value, label = 'ID simulé' }: { value: string; label?: string }) {
  return <span className="technical-inline-id">{label} : <code>{value}</code></span>;
}
export const formatDate = (date: string) => new Date(date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
