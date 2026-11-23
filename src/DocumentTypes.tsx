import { useState } from 'react';
import { Building2, CircleCheck, ClipboardCheck, MapPin, Pencil, Plus, ShieldCheck, Trash2, UserRoundCheck, Users, type LucideIcon } from 'lucide-react';
import type { Commit, Data, DocumentType, Impact } from './types';
import { alphabetic, deleteDocumentType, isSystemCompatibilityDocument, knownTextTranslations, matches, saveDocumentType } from './domain';
import { createDocumentType } from './documentTypeData';
import { fakeTechnicalId, technicalMappings } from './supportConfig';
import { Badge, CheckField, CompatibilityWarning, Empty, FormActions, Modal, Notice, SearchBox, Select, Status, TechnicalInfo, TechnicalInlineId } from './ui';
import { TranslatableField } from './TranslatableField';

const tables = [...technicalMappings.documentTypes.tables];
const typeId = (id: string) => fakeTechnicalId('document-type', id);
const typeIds = (id: string) => [
  { label: 'ID catégorie · fictif', value: typeId(id) },
  ...(['fr', 'en', 'ko'] as const).map(locale => ({
    label: `ID version categorie ${locale.toUpperCase()} · fictif`,
    value: fakeTechnicalId('document-type-description', `${id}:${locale}`),
  })),
];
const flags = [
  { key: 'required', label: 'Obligatoire / requis', detail: 'Marquer ce type comme requis.', icon: ClipboardCheck, group: 'settings' },
  { key: 'companySpace', label: 'Disponible dans l’espace documentaire de l’entreprise', detail: 'Associer ce type à l’espace documentaire.', icon: Building2, group: 'settings' },
  { key: 'siteLinked', label: 'Rattaché à un site', detail: 'Associer ce type à un site.', icon: MapPin, group: 'settings' },
  { key: 'visibleCorrespondents', label: 'Visible par les correspondants', detail: 'Visibilité pour les correspondants.', icon: Users, group: 'visibility' },
  { key: 'visibleExternalAuditors', label: 'Visible par les auditeurs externes', detail: 'Visibilité pour les auditeurs externes.', icon: UserRoundCheck, group: 'visibility' },
  { key: 'visibleStaff', label: 'Visible par le personnel UTAC', detail: 'Visibilité pour le personnel UTAC.', icon: ShieldCheck, group: 'visibility' },
] as const;

function DocumentTypeOption({ label, detail, icon: Icon, checked, onChange }: {
  label: string; detail: string; icon: LucideIcon; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return <label className={`document-type-option${checked ? ' selected' : ''}`}>
    <span className="document-type-option-icon"><Icon size={17} aria-hidden="true" /></span>
    <span className="document-type-option-text"><strong>{label}</strong><small>{detail}</small></span>
    <input type="checkbox" aria-label={label} checked={checked} onChange={event => onChange(event.target.checked)} />
  </label>;
}

export function DocumentTypes({ data, commit, confirm, supportMode }: {
  data: Data; commit: Commit; confirm: (impact: Impact) => void; supportMode: boolean;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const types = alphabetic(data.documentTypes.filter(item =>
    matches(query, item.name, item.labels.en, item.labels.ko, item.descriptions.fr, item.descriptions.en, item.descriptions.ko) &&
    (!status || (status === 'active' ? item.active : !item.active))), item => item.name);
  const save = (draft: DocumentType) => {
    const previous = data.documentTypes.find(item => item.id === draft.id);
    const apply = () => {
      const ok = commit(`${previous ? 'Modification' : 'Création'} du type de document « ${draft.labels.fr.trim()} »`,
        'Types de documents et modèles associés', current => saveDocumentType(current, draft));
      if (ok) setEditing(null);
      return ok;
    };
    if (previous) confirm({
      title: 'Modifier ce type de document ?',
      description: 'Un changement de titre est répercuté sur les modèles qui utilisent ce type.',
      scope: previous.name,
      compatibilityWarning: isSystemCompatibilityDocument(previous.name, draft.labels.fr),
      facts: [{ label: 'modèles associés', value: data.documents.filter(document => document.type === previous.name).length }],
      technical: { ids: typeIds(draft.id), tables },
      apply,
    });
    else apply();
  };
  const remove = (item: DocumentType) => confirm({
    title: `Supprimer « ${item.name} » ?`,
    description: 'Ce type sera retiré des choix proposés aux modèles de documents.',
    scope: 'Types de documents',
    compatibilityWarning: isSystemCompatibilityDocument(item.name),
    facts: [{ label: 'type supprimé', value: 1 }],
    warning: 'La suppression est bloquée si un modèle utilise ce type. Elle peut être annulée depuis le journal.',
    confirmLabel: 'Supprimer ce type',
    technical: { ids: typeIds(item.id), tables },
    apply: () => commit(`Suppression du type de document « ${item.name} »`, 'Types de documents', current => deleteDocumentType(current, item.id)),
  });
  return <>
    <div className="panel">
      <div className="panel-heading"><div><h3>Types de documents</h3><p>Configurez les règles, les publics et les versions linguistiques de chaque type.</p></div>
        <button className="btn small primary" onClick={() => setEditing(createDocumentType(crypto.randomUUID()))}><Plus size={15} />Créer un type</button></div>
      <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Rechercher un type de document…" /><Badge>{types.length} types</Badge></div>
      <div className="filters"><Select label="Statut" value={status} onChange={setStatus}
        options={[{ value: '', label: 'Tous les statuts' }, { value: 'active', label: 'Actifs' }, { value: 'inactive', label: 'Inactifs' }]} /></div>
      <div className="table-scroll"><table className="document-types-table"><thead><tr>
        <th>Type de document</th><th>Statut</th><th>Requis</th><th>Espace entreprise</th><th>Site</th><th>Correspondants</th><th>Auditeurs externes</th><th>Personnel UTAC</th><th>Modèles</th><th>Actions</th>
      </tr></thead><tbody>{types.map(item => {
        const count = data.documents.filter(document => document.type === item.name).length;
        return <tr key={item.id}>
          <td><strong>{item.name || 'Sans titre'}</strong>{isSystemCompatibilityDocument(item.name) && <CompatibilityWarning />}{supportMode && <TechnicalInlineId value={typeId(item.id)} />}
            <small>{(['fr', 'en', 'ko'] as const).map(locale => `${locale.toUpperCase()} ${item.languageActive[locale] ? 'actif' : 'inactif'}`).join(' · ')}</small></td>
          <td><Status active={item.active} /></td>
          {flags.map(flag => <td key={flag.key}>{item[flag.key] ? 'Oui' : 'Non'}</td>)}
          <td>{count}{count > 0 && <small>Suppression bloquée</small>}</td>
          <td><div className="inline">
            <button className="icon-btn" aria-label={`Modifier ${item.name}`} onClick={() => setEditing(item)}><Pencil size={16} /></button>
            <button className="icon-btn danger" aria-label={`Supprimer ${item.name}`} disabled={count > 0}
              title={count ? 'Réaffectez les modèles avant de supprimer ce type.' : 'Supprimer'} onClick={() => remove(item)}><Trash2 size={16} /></button>
          </div></td>
        </tr>;
      })}</tbody></table></div>
      {!types.length && <Empty />}
    </div>
    <Notice>Un type utilisé par un modèle ne peut pas être supprimé. Les options des anciens types sont initialisées à des valeurs neutres et restent à vérifier. Ces données de démonstration ne modifient pas les accès dans DIAMS.</Notice>
    {editing && <DocumentTypeEditor item={editing} data={data} supportMode={supportMode} onClose={() => setEditing(null)} onSave={save} />}
  </>;
}

function DocumentTypeEditor({ item, data, supportMode, onClose, onSave }: {
  item: DocumentType; data: Data; supportMode: boolean; onClose: () => void; onSave: (item: DocumentType) => void;
}) {
  const [draft, setDraft] = useState<DocumentType>(() => ({
    ...item, labels: { ...item.labels }, descriptions: { ...item.descriptions }, languageActive: { ...item.languageActive },
  }));
  const [error, setError] = useState('');
  const patch = (change: Partial<DocumentType>) => setDraft(current => ({ ...current, ...change }));
  const dictionary = knownTextTranslations(data);
  return <Modal title={data.documentTypes.some(type => type.id === item.id) ? 'Modifier le type de document' : 'Créer un type de document'} wide onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      try { saveDocumentType(data, draft); } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause)); return;
      }
      onSave(draft);
    }}>
      <div className="modal-body stack">
        {isSystemCompatibilityDocument(item.name, draft.labels.fr) && <CompatibilityWarning />}
        <div className="form-grid">
          <TranslatableField label="Titre du type *" required wide value={draft.labels.fr}
            onChange={fr => patch({ labels: { ...draft.labels, fr } })} translations={draft.labels}
            onTranslationsChange={translations => patch({ labels: { ...draft.labels, ...translations } })} knownLabels={dictionary} />
          <TranslatableField label="Description" wide multiline value={draft.descriptions.fr}
            onChange={fr => patch({ descriptions: { ...draft.descriptions, fr } })} translations={draft.descriptions}
            onTranslationsChange={translations => patch({ descriptions: { ...draft.descriptions, ...translations } })} knownLabels={dictionary} />
        </div>
        <section className="document-common document-type-settings"><div><h3 className="subheading">Paramètres et visibilité</h3>
          <p>Définissez les règles du type et les publics concernés.</p></div>
          <fieldset className="document-type-option-group"><legend>Règles du type</legend>
            <div className="document-type-options">
              <DocumentTypeOption label="Actif" detail="Activer ou désactiver ce type." icon={CircleCheck}
                checked={draft.active} onChange={active => patch({ active })} />
              {flags.filter(flag => flag.group === 'settings').map(flag => <DocumentTypeOption key={flag.key}
                label={flag.label} detail={flag.detail} icon={flag.icon} checked={draft[flag.key]}
                onChange={checked => patch({ [flag.key]: checked })} />)}
            </div>
          </fieldset>
          <fieldset className="document-type-option-group"><legend>Visibilité</legend>
            <div className="document-type-options visibility">
              {flags.filter(flag => flag.group === 'visibility').map(flag => <DocumentTypeOption key={flag.key}
                label={flag.label} detail={flag.detail} icon={flag.icon} checked={draft[flag.key]}
                onChange={checked => patch({ [flag.key]: checked })} />)}
            </div>
          </fieldset>
        </section>
        <section className="document-common"><h3 className="subheading">Versions linguistiques</h3>
          <p>Les titres et descriptions se renseignent ci-dessus. Chaque version peut être activée indépendamment.</p>
          <div className="button-row">{(['fr', 'en', 'ko'] as const).map(locale =>
            <CheckField key={locale} checked={draft.languageActive[locale]}
              onChange={active => patch({ languageActive: { ...draft.languageActive, [locale]: active } })}>Version {locale.toUpperCase()} active</CheckField>)}</div>
        </section>
        {supportMode && <TechnicalInfo ids={typeIds(item.id)} tables={tables} />}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <FormActions onClose={onClose} />
    </form>
  </Modal>;
}
