import { useState } from 'react';
import { Languages, Plus, Trash2 } from 'lucide-react';
import type { ChecklistSection, Data, DocumentLocale, Labels, SettingTranslations, SkillPermission, SpecificSettingRecord } from './types';
import { fakeTechnicalId } from './supportConfig';
import { checklistAuditTypes, historicalAuditTypes, settingDefinitions, toolBoxVisibilityFields } from './specificSettingsConfig';
import { CheckField, Field, FormActions, Modal, Notice, Select, TechnicalInfo } from './ui';
import { completeMissingTranslations, knownTextTranslations } from './domain';
import { TranslatableField } from './TranslatableField';

const locales: { code: DocumentLocale; label: string }[] = [
  { code: 'fr', label: 'Français' }, { code: 'en', label: 'Anglais' }, { code: 'ko', label: 'Coréen' },
];
const userTypes = ['Account Manager', 'Admin', 'Commercial', 'Droit de veto', 'Opérateur', 'Skills Manager', 'Supervisor'];

export function emptySettingTranslations(): SettingTranslations {
  return {
    fr: { active: true, title: '', description: '', fileName: '' },
    en: { active: true, title: '', description: '', fileName: '' },
    ko: { active: true, title: '', description: '', fileName: '' },
  };
}

export function settingTranslationsFor(record: SpecificSettingRecord): SettingTranslations {
  if (record.translations) return record.translations;
  const translations = emptySettingTranslations();
  const language = locales.find(locale => locale.label === record.values.language)?.code ?? 'fr';
  if (record.kind !== 'checklist') translations.fr.title = record.name;
  translations[language] = {
    ...translations[language],
    active: true,
    title: record.kind === 'checklist' ? '' : record.name,
    description: record.kind === 'toolBox' ? record.values.description || '' : '',
  };
  return translations;
}

function TranslationEditor({ title, translations, onChange, knownLabels, supportMode, technicalDomain, technicalId, description = false, fileName = false, requiredFrench = false }: {
  title: string;
  translations: SettingTranslations;
  onChange: (translations: SettingTranslations) => void;
  knownLabels: Labels[];
  supportMode: boolean;
  technicalDomain: string;
  technicalId: string;
  description?: boolean;
  fileName?: boolean;
  requiredFrench?: boolean;
}) {
  const [locale, setLocale] = useState<DocumentLocale>('fr');
  const current = translations[locale];
  const language = locales.find(item => item.code === locale)!.label;
  const patch = (change: Partial<SettingTranslations[DocumentLocale]>) =>
    onChange({ ...translations, [locale]: { ...current, ...change } });
  const propose = () => {
    const titles = completeMissingTranslations(translations.fr.title,
      { en: translations.en.title, ko: translations.ko.title }, knownLabels);
    const descriptions = description ? completeMissingTranslations(translations.fr.description,
      { en: translations.en.description, ko: translations.ko.description }, knownLabels) : null;
    onChange({
      ...translations,
      en: { ...translations.en, title: titles.en, ...(descriptions && { description: descriptions.en }) },
      ko: { ...translations.ko, title: titles.ko, ...(descriptions && { description: descriptions.ko }) },
    });
  };
  return <section className="document-language-section">
    <div className="document-language-heading"><div><h3>{title}</h3><p>Renseignez les versions utiles et leur statut.</p></div></div>
    <div className="translation-proposal">
      <button type="button" className="btn small" disabled={!translations.fr.title.trim() && (!description || !translations.fr.description.trim())} onClick={propose}>
        <Languages size={15} />Proposer les traductions manquantes
      </button>
      <small>Dictionnaire local uniquement : les textes inconnus sont signalés « à traduire ». Les traductions existantes et les statuts sont conservés ; relisez-les si le français change.</small>
    </div>
    <div className="document-language-tabs" role="group" aria-label={`Langues : ${title}`}>
      {locales.map(item => <button key={item.code} type="button" className={locale === item.code ? 'selected' : ''}
        aria-pressed={locale === item.code} onClick={() => setLocale(item.code)}>
        <strong>{item.code.toUpperCase()}</strong>{item.label}{translations[item.code].active ? ' · Active' : ' · Inactive'}
      </button>)}
    </div>
    <div className="document-language-fields">
      {supportMode && <TechnicalInfo ids={[{ label: `Version ${locale.toUpperCase()} · simulée`, value: fakeTechnicalId(technicalDomain, `${technicalId}:${locale}`) }]} tables={[]} />}
      <CheckField checked={current.active} onChange={active => patch({ active })}>Version {language} active</CheckField>
      <Field label={`Titre ${language}${requiredFrench && locale === 'fr' ? ' *' : ''}`}>
        <input value={current.title} onChange={event => patch({ title: event.target.value })} placeholder="Saisir le titre" />
      </Field>
      {description && <Field label={`Description ${language}`}><textarea rows={3} value={current.description}
        onChange={event => patch({ description: event.target.value })} /></Field>}
      {fileName && <Field label={`Nom complet du fichier ${language}`}><input value={current.fileName}
        onChange={event => patch({ fileName: event.target.value })} placeholder="Ex. notice-fr.pdf" /></Field>}
    </div>
  </section>;
}

export function SpecificSettingsEditor({ record, data, supportMode, tables, onClose, onSave }: {
  record: SpecificSettingRecord;
  data: Data;
  supportMode: boolean;
  tables: string[];
  onClose: () => void;
  onSave: (draft: SpecificSettingRecord) => void;
}) {
  const definition = settingDefinitions[record.kind];
  const multilingual = ['toolBox', 'notice', 'skillProfile', 'checklist'].includes(record.kind);
  const [draft, setDraft] = useState<SpecificSettingRecord>(() => ({
    ...record, values: { ...record.values },
    ...(multilingual ? { translations: settingTranslationsFor(record) } : {}),
  }));
  const [error, setError] = useState('');
  const dictionary = knownTextTranslations(data);
  const patchValue = (key: string, value: string) => setDraft(current => ({ ...current, values: { ...current.values, [key]: value } }));
  const patchTranslation = (key: string, value: { en: string; ko: string }) =>
    setDraft(current => ({ ...current, textTranslations: { ...current.textTranslations, [key]: value } }));
  const patchPermission = (id: string, change: Partial<SkillPermission>) => setDraft(current => ({
    ...current, permissions: (current.permissions ?? []).map(item => item.id === id ? { ...item, ...change } : item),
  }));
  const patchSection = (id: string, translations: SettingTranslations) => setDraft(current => ({
    ...current, checklistSections: (current.checklistSections ?? []).map(item => item.id === id ? { ...item, translations } : item),
  }));
  const isDescendant = (candidateId: string) => {
    const visited = new Set<string>();
    let id = candidateId;
    while (id && !visited.has(id)) {
      if (id === record.id) return true;
      visited.add(id);
      id = data.specificSettings.find(item => item.kind === 'skillProfile' && item.id === id)?.values.parentId || '';
    }
    return false;
  };
  const parentOptions = data.specificSettings.filter(item => item.kind === 'skillProfile' && !isDescendant(item.id));
  const toolBoxes = data.specificSettings.filter(item => item.kind === 'toolBox');
  const auditTypes = data.entities.filter(item => item.kind === 'auditType');
  const checklistTypes = checklistAuditTypes(data.entities);
  const selectedOption = (id: string, items: { id: string; name: string }[]) =>
    id && !items.some(item => item.id === id) ? [{ value: id, label: `Référence indisponible (${id})` }] : [];
  const isNamedByTranslation = ['toolBox', 'notice', 'skillProfile'].includes(record.kind);
  const legacyFields = definition.fields.filter(field => {
    if (record.kind === 'certificationStatus') return !['decision', 'originStatus', 'destinationStatus', 'auditType'].includes(field.key);
    return true;
  });
  return <Modal title={`${record.name ? 'Modifier' : 'Créer'} : ${definition.singular}`} onClose={onClose} wide>
    <form onSubmit={event => {
      event.preventDefault();
      let name = isNamedByTranslation ? draft.translations!.fr.title.trim() : draft.name.trim();
      if (record.kind === 'certificationStatus' && ['decision', 'originStatus', 'destinationStatus', 'auditType'].some(key => !draft.values[key]?.trim())) {
        setError('Renseignez la décision, les deux statuts et le type d’audit.'); return;
      }
      if (record.kind === 'certificationStatus') name = `${draft.values.originStatus} → ${draft.values.destinationStatus} · ${draft.values.decision} · ${draft.values.auditType}`;
      if (!name) { setError(isNamedByTranslation ? 'Renseignez le titre français.' : 'Renseignez un nom.'); return; }
      if (record.kind === 'skillProfile' && (draft.permissions ?? []).some(item => !item.userType.trim())) {
        setError('Renseignez le type d’utilisateur de chaque autorisation.'); return;
      }
      if (record.kind === 'skillProfile' && new Set((draft.permissions ?? []).map(item => item.userType)).size !== (draft.permissions ?? []).length) {
        setError('Chaque type d’utilisateur ne peut apparaître qu’une seule fois.'); return;
      }
      onSave({ ...draft, name });
    }}>
      <div className="modal-body stack">
        {supportMode && <TechnicalInfo ids={[{ label: 'Identifiant simulé', value: fakeTechnicalId(`specific-setting-${record.kind}`, record.id) }]} tables={tables} />}
        {!isNamedByTranslation && record.kind !== 'certificationStatus' && <TranslatableField label={record.kind === 'equipmentSupplier' ? 'Titre *' : 'Nom *'}
          required value={draft.name} onChange={name => setDraft(current => ({ ...current, name }))}
          translations={draft.textTranslations?.name} onTranslationsChange={value => patchTranslation('name', value)} knownLabels={dictionary} />}
        <CheckField checked={draft.active} onChange={active => setDraft(current => ({ ...current, active }))}>Actif</CheckField>
        {record.kind === 'toolBox' && <fieldset className="toolbox-visibility">
          <legend>Visibilité</legend><p>Choisissez les publics concernés.</p>
          <div className="toolbox-visibility-options">{toolBoxVisibilityFields.map(field => <CheckField key={field.key}
            checked={draft.values[field.key] === 'true'} onChange={checked => patchValue(field.key, String(checked))}>{field.label}</CheckField>)}</div>
        </fieldset>}
        {record.kind === 'notice' && <Select label="Boîte à outils" value={draft.values.toolBoxId || ''}
          options={[{ value: '', label: 'Non renseignée' }, ...selectedOption(draft.values.toolBoxId, toolBoxes), ...toolBoxes.map(item => ({ value: item.id, label: item.name }))]}
          onChange={value => patchValue('toolBoxId', value)} />}
        {record.kind === 'skillProfile' && <Select label="Dossier parent" value={draft.values.parentId || ''}
          options={[{ value: '', label: 'Aucun dossier parent' }, ...selectedOption(draft.values.parentId, parentOptions), ...parentOptions.map(item => ({ value: item.id, label: item.name }))]}
          onChange={value => patchValue('parentId', value)} />}
        {record.kind === 'checklist' && <Select label="Type d’audit" value={draft.values.auditTypeId || ''}
          options={[{ value: '', label: 'Non renseigné' }, ...selectedOption(draft.values.auditTypeId, checklistTypes), ...checklistTypes.map(item => ({ value: item.id, label: item.name }))]}
          onChange={value => patchValue('auditTypeId', value)} />}
        {record.kind === 'certificationStatus' && <div className="form-grid">
          <Select label="Veto / décision" value={draft.values.decision || ''}
            options={[{ value: '', label: 'Non renseigné' }, 'Favorable', 'Défavorable']}
            onChange={value => patchValue('decision', value)} />
          <TranslatableField label="Statut d’origine" value={draft.values.originStatus || ''} onChange={value => patchValue('originStatus', value)}
            placeholder="Ex. En cours d’acquisition" translations={draft.textTranslations?.originStatus} onTranslationsChange={value => patchTranslation('originStatus', value)} knownLabels={dictionary} />
          <TranslatableField label="Statut de destination" value={draft.values.destinationStatus || ''} onChange={value => patchValue('destinationStatus', value)}
            placeholder="Ex. Valide" translations={draft.textTranslations?.destinationStatus} onTranslationsChange={value => patchTranslation('destinationStatus', value)} knownLabels={dictionary} />
          <Select label="Type d’audit" value={draft.values.auditType || ''}
            options={[{ value: '', label: 'Non renseigné' }, ...new Set([
              ...auditTypes.map(item => item.name), ...historicalAuditTypes,
              ...data.specificSettings.filter(item => item.kind === 'certificationStatus').map(item => item.values.auditType).filter(Boolean),
              ...(draft.values.auditType ? [draft.values.auditType] : []),
            ])]}
            onChange={value => patchValue('auditType', value)} />
        </div>}
        {multilingual && <TranslationEditor title={record.kind === 'checklist' ? 'En-tête du chapitre' : 'Versions linguistiques'}
          translations={draft.translations!} requiredFrench={isNamedByTranslation} knownLabels={dictionary}
          supportMode={supportMode} technicalDomain={`specific-setting-translation-${record.kind}`} technicalId={record.id}
          description={record.kind === 'toolBox' || record.kind === 'notice'} fileName={record.kind === 'notice'}
          onChange={translations => setDraft(current => ({ ...current, translations }))} />}
        {record.kind === 'notice' && <Notice>Le nom du fichier est une référence locale : aucun fichier n’est envoyé vers Azure.</Notice>}
        {record.kind === 'skillProfile' && <section className="specific-editor-group">
          <div className="specific-editor-heading"><div><h3>Autorisations par type d’utilisateur</h3><p>Lecture et téléchargement sont simulés dans cette maquette.</p></div>
            <button type="button" className="btn small" onClick={() => setDraft(current => ({ ...current, permissions: [...(current.permissions ?? []), { id: crypto.randomUUID(), userType: '', active: true, download: false }] }))}><Plus size={15} />Ajouter</button></div>
          {(draft.permissions ?? []).map(permission => <div className="permission-row" key={permission.id}>
            <Select label="Type d’utilisateur" value={permission.userType}
              options={[{ value: '', label: 'Choisir un type' }, ...new Set([...userTypes, ...(permission.userType ? [permission.userType] : [])])]}
              onChange={userType => patchPermission(permission.id, { userType })} />
            <CheckField checked={permission.active} onChange={active => patchPermission(permission.id, { active })}>Actif / lecture</CheckField>
            <CheckField checked={permission.download} onChange={download => patchPermission(permission.id, { download })}>Téléchargement autorisé</CheckField>
            <button type="button" className="icon-btn danger" aria-label={`Supprimer l’autorisation ${permission.userType || 'sans type'}`} onClick={() => setDraft(current => ({ ...current, permissions: (current.permissions ?? []).filter(item => item.id !== permission.id) }))}><Trash2 size={16} /></button>
            {supportMode && <TechnicalInfo ids={[{ label: 'Autorisation simulée', value: fakeTechnicalId('skill-permission', permission.id) }]} tables={[]} />}
          </div>)}
          {!draft.permissions?.length && <p>Aucune autorisation configurée.</p>}
        </section>}
        {record.kind === 'checklist' && <section className="specific-editor-group">
          <div className="specific-editor-heading"><div><h3>Sections</h3><p>Ajoutez les sections du chapitre et leurs traductions.</p></div>
            <button type="button" className="btn small" onClick={() => setDraft(current => ({ ...current, checklistSections: [...(current.checklistSections ?? []), { id: crypto.randomUUID(), translations: emptySettingTranslations() }] }))}><Plus size={15} />Ajouter une section</button></div>
          {(draft.checklistSections ?? []).map((section: ChecklistSection, index) => <div className="specific-section" key={section.id}>
            <div className="specific-editor-heading"><strong>Section {index + 1}</strong>
              <button type="button" className="icon-btn danger" aria-label={`Supprimer la section ${index + 1}`} onClick={() => setDraft(current => ({ ...current, checklistSections: (current.checklistSections ?? []).filter(item => item.id !== section.id) }))}><Trash2 size={16} /></button></div>
            {supportMode && <TechnicalInfo ids={[{ label: 'Section simulée', value: fakeTechnicalId('checklist-section', section.id) }]} tables={[]} />}
            <TranslationEditor title={`Section ${index + 1}`} translations={section.translations} knownLabels={dictionary}
              supportMode={supportMode} technicalDomain="checklist-section-translation" technicalId={section.id} onChange={translations => patchSection(section.id, translations)} />
          </div>)}
          {!draft.checklistSections?.length && <p>Aucune section ajoutée.</p>}
        </section>}
        {!!legacyFields.length && <details className="specific-legacy"><summary>Informations complémentaires</summary>
          <div className="form-grid">{legacyFields.map(field => field.translatable ? <TranslatableField key={field.key} label={field.label}
            wide={field.multiline} multiline={field.multiline} value={draft.values[field.key] || ''} onChange={value => patchValue(field.key, value)}
            translations={draft.textTranslations?.[field.key]} onTranslationsChange={value => patchTranslation(field.key, value)} knownLabels={dictionary} /> : <Field key={field.key} label={field.label} wide={field.multiline}>
            {field.multiline ? <textarea rows={3} value={draft.values[field.key] || ''} onChange={event => patchValue(field.key, event.target.value)} />
              : <input value={draft.values[field.key] || ''} onChange={event => patchValue(field.key, event.target.value)} />}
          </Field>)}</div>
        </details>}
        <Notice>Ces données sont fictives et restent dans le stockage local de cette maquette.</Notice>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <FormActions onClose={onClose} />
    </form>
  </Modal>;
}
