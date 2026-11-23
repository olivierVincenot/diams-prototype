import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Commit, Data, Impact, ReportScope, SpecificSettingKind, SpecificSettingRecord } from './types';
import { entityTechnicalId, fakeTechnicalId, technicalMappings } from './supportConfig';
import { certificateAuditTypesFor, checklistAuditTypes, reportSpecificKinds, settingDefinitions, toolBoxVisibilityFields } from './specificSettingsConfig';
import { Badge, CheckField, Empty, Field, FormActions, Modal, MultiSelectDropdown, Notice, SearchBox, SectionTitle, Select, Status, TechnicalInfo } from './ui';
import { reportAuditTypes, reportStandardsFor, standardTypes } from './data';
import { knownTextTranslations, matches, reportScopePaths } from './domain';
import { ReportHierarchy } from './ReportHierarchy';
import { ReportTemplateView } from './ReportTemplateView';
import { SpecificSettingsEditor } from './SpecificSettingsEditor';
import { TranslatableField } from './TranslatableField';

type Props = {
  data: Data;
  commit: Commit;
  confirm: (impact: Impact) => void;
  supportMode: boolean;
  allowedKinds?: SpecificSettingKind[];
  showSectionTitle?: boolean;
};

const kinds = Object.keys(settingDefinitions) as SpecificSettingKind[];
const detailedKinds: SpecificSettingKind[] = ['toolBox', 'notice', 'skillProfile', 'certificationStatus', 'equipmentSupplier', 'checklist'];
const settingTemplateName = (item: SpecificSettingRecord) => item.values.templateName || item.values.templateLogicalName || '';

export function SpecificSettings({ data, commit, confirm, supportMode, allowedKinds, showSectionTitle = true }: Props) {
  const visibleKinds = allowedKinds ?? kinds.filter(item => item !== 'workload' && !reportSpecificKinds.includes(item));
  const [kind, setKind] = useState<SpecificSettingKind>(visibleKinds[0] ?? kinds[0]);
  const [editing, setEditing] = useState<SpecificSettingRecord | null>(null);
  const [search, setSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const definition = settingDefinitions[kind];
  const isReportSetting = reportSpecificKinds.includes(kind);
  const records = data.specificSettings.filter(item => item.kind === kind &&
    (kind !== 'skillProfile' || matches(search, item.name)) &&
    (kind !== 'certificationStatus' || matches(search, item.name, ...Object.values(item.values))) &&
    (kind !== 'checklist' || !auditFilter || item.values.auditTypeId === auditFilter));
  const tables = definition.mapping ? [...technicalMappings[definition.mapping].tables] : [];
  const newRecord = () => ({
    id: crypto.randomUUID(),
    kind,
    name: '',
    active: true,
    values: Object.fromEntries(definition.fields.map(field => [field.key, ''])),
  });
  const save = (draft: SpecificSettingRecord) => {
    const name = draft.name.trim();
    if (!name) return;
    const ok = commit(`${draft.id && data.specificSettings.some(item => item.id === draft.id) ? 'Modification' : 'Création'} de « ${name} »`, definition.title, current => ({
      ...current,
      specificSettings: [...current.specificSettings.filter(item => item.id !== draft.id), { ...draft, name }],
    }));
    if (ok) setEditing(null);
  };
  const remove = (item: SpecificSettingRecord) => confirm({
    title: `Supprimer « ${item.name} » ?`,
    description: 'Cet enregistrement fictif sera retiré des paramétrages locaux.',
    scope: definition.title,
    facts: [{ label: 'enregistrement supprimé', value: 1 }],
    warning: 'Cette suppression ne peut être annulée que par un retour arrière depuis le journal.',
    confirmLabel: 'Supprimer cet enregistrement',
    technical: { ids: [{ label: 'Paramétrage supprimé', value: fakeTechnicalId(`specific-setting-${item.kind}`, item.id) }], tables },
    apply: () => commit(`Suppression de « ${item.name} »`, definition.title, current => ({
      ...current,
      specificSettings: current.specificSettings.filter(record => record.id !== item.id),
    })),
  });

  return <>
    {showSectionTitle && <SectionTitle
      eyebrow="PARAMÉTRAGE / OUTILS SPÉCIFIQUES"
      title="Paramétrages spécifiques"
      description="Parcours locaux de démonstration pour les outils de la palette historique. Aucune règle métier ou connexion externe n’est supposée."
      action={<button className="btn primary" onClick={() => setEditing(newRecord())}><Plus size={17} />Ajouter</button>}
    />}
    <div className={`specific-settings-layout ${visibleKinds.length === 1 ? 'single' : ''}`}>
      {visibleKinds.length > 1 && <nav className="panel specific-settings-nav" aria-label="Domaines de paramétrages spécifiques">
        {visibleKinds.map(itemKind => {
          const itemDefinition = settingDefinitions[itemKind];
          const count = data.specificSettings.filter(item => item.kind === itemKind).length;
          return <button key={itemKind} className={`specific-settings-nav-item ${kind === itemKind ? 'active' : ''}`} onClick={() => { setKind(itemKind); setSearch(''); setAuditFilter(''); }}>
            <span>{itemDefinition.title}</span><Badge>{count}</Badge>
          </button>;
        })}
      </nav>}
      <section className="panel specific-settings-panel">
        <div className="panel-heading">
          <div><h3>{definition.title}</h3><p>{definition.description}</p></div>
          <button className="btn small primary" onClick={() => setEditing(newRecord())}><Plus size={15} />Ajouter</button>
        </div>
        {kind === 'skillProfile' && <div className="specific-filter"><SearchBox value={search} onChange={setSearch} placeholder="Filtrer par titre…" /></div>}
        {kind === 'certificationStatus' && <>
          <Notice>Exemples fictifs : doublons et lignes incomplètes inclus. Le statut actif est une valeur de démonstration ; complétez les champs manquants avant d’enregistrer une transition.</Notice>
          <div className="specific-filter"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher une décision, un statut ou un type d’audit…" /></div>
        </>}
        {kind === 'checklist' && <div className="specific-filter"><Select label="Filtrer par type d’audit" value={auditFilter}
          options={[{ value: '', label: 'Tous les types d’audit' }, ...checklistAuditTypes(data.entities).map(item => ({ value: item.id, label: item.name }))]}
          onChange={setAuditFilter} /></div>}
        {isReportSetting ? <ReportHierarchy records={records} pathsFor={item => reportScopePaths(item.reportScope)}>
          {branchRecords => <ReportTemplateView records={branchRecords}
            describe={item => ({ template: settingTemplateName(item), scope: item.reportScope, language: item.values.language || '' })}>
            {renderSettingCards}
          </ReportTemplateView>}
        </ReportHierarchy> : renderSettingCards(records)}
        {supportMode && !definition.mapping && <Notice>Table historique non précisée pour ce domaine ; correspondance à confirmer.</Notice>}
      </section>
    </div>
    {editing && (detailedKinds.includes(editing.kind) ? <SpecificSettingsEditor
      record={editing}
      data={data}
      supportMode={supportMode}
      tables={settingDefinitions[editing.kind].mapping ? [...technicalMappings[settingDefinitions[editing.kind].mapping!].tables] : []}
      onClose={() => setEditing(null)}
      onSave={save}
    /> : <SettingEditor
      record={editing}
      data={data}
      supportMode={supportMode}
      tables={editing.kind === kind && definition.mapping ? tables : (() => {
        const mapping = settingDefinitions[editing.kind].mapping;
        return mapping ? [...technicalMappings[mapping].tables] : [];
      })()}
      onClose={() => setEditing(null)}
      onSave={save}
    />)}
  </>;

  function renderSettingCards(displayedRecords: SpecificSettingRecord[]) {
    return !displayedRecords.length ? <Empty /> : <div className="specific-setting-list">
          {displayedRecords.map(item => {
            const referenced = data.specificSettings.some(other =>
              (item.kind === 'toolBox' && other.kind === 'notice' && other.values.toolBoxId === item.id) ||
              (item.kind === 'skillProfile' && other.kind === 'skillProfile' && other.values.parentId === item.id));
            const relationName = (id: string, type: SpecificSettingKind) =>
              data.specificSettings.find(other => other.kind === type && other.id === id)?.name || (id ? 'Référence indisponible' : 'Non renseigné');
            return <article className="specific-setting-card" key={item.id}>
            <div className={`specific-setting-heading ${isReportSetting ? 'record-heading' : ''}`}>
              <div><strong>{item.name}</strong><Status active={item.active} /></div>
              <div className="button-row">
                <button className="icon-btn" aria-label={`Modifier ${item.name}`} onClick={() => setEditing({ ...item, values: { ...item.values } })}><Pencil size={16} /></button>
                <button className="icon-btn danger" aria-label={`Supprimer ${item.name}`} disabled={referenced}
                  title={referenced ? 'Retirez d’abord les rattachements à cette fiche.' : 'Supprimer'}
                  onClick={() => remove(item)}><Trash2 size={16} /></button>
              </div>
            </div>
            <dl className="specific-setting-values">
              {isReportSetting && <>
                <div><dt>Type de norme</dt><dd>{item.reportScope?.standardType || 'Non renseigné'}</dd></div>
                <div><dt>Norme(s)</dt><dd>{item.reportScope?.standards.join(', ') || 'Non renseigné'}</dd></div>
                <div><dt>Types d’audit</dt><dd>{item.reportScope?.auditTypes.join(', ') || 'Non renseigné'}</dd></div>
              </>}
              {definition.fields.filter(field => (item.values[field.key]?.trim() ||
                (item.kind === 'certificationStatus' && ['decision', 'originStatus', 'destinationStatus', 'auditType'].includes(field.key))) &&
                !(item.translations && ['toolBox', 'notice'].includes(item.kind) && ['description', 'language'].includes(field.key))).map(field => <div key={field.key}>
                <dt>{field.label}</dt><dd>{item.values[field.key]?.trim() || 'Non renseigné'}</dd>
              </div>)}
              {item.kind === 'toolBox' && toolBoxVisibilityFields.map(field => <div key={field.key}>
                <dt>{field.label}</dt><dd>{item.values[field.key] === 'true' ? 'Oui' : 'Non'}</dd>
              </div>)}
              {item.kind === 'notice' && <div><dt>Boîte à outils</dt><dd>{relationName(item.values.toolBoxId, 'toolBox')}</dd></div>}
              {item.translations && ['toolBox', 'notice'].includes(item.kind) && item.translations.fr.description && <div><dt>Description française</dt><dd>{item.translations.fr.description}</dd></div>}
              {item.kind === 'skillProfile' && <>
                <div><dt>Dossier parent</dt><dd>{relationName(item.values.parentId, 'skillProfile')}</dd></div>
                <div><dt>Lecture uniquement</dt><dd>{item.permissions?.filter(permission => permission.active && !permission.download).map(permission => permission.userType).join(', ') || 'Aucune'}</dd></div>
                <div><dt>Téléchargement autorisé</dt><dd>{item.permissions?.filter(permission => permission.active && permission.download).map(permission => permission.userType).join(', ') || 'Aucun'}</dd></div>
              </>}
              {item.kind === 'checklist' && <>
                <div><dt>Type d’audit</dt><dd>{checklistAuditTypes(data.entities).find(type => type.id === item.values.auditTypeId)?.name || (item.values.auditTypeId ? 'Référence indisponible' : 'Non renseigné')}</dd></div>
                <div><dt>En-tête</dt><dd>{item.translations?.fr.title || 'Non renseigné'}</dd></div>
                <div><dt>Sections</dt><dd>{item.checklistSections?.map(section => section.translations.fr.title || 'Sans titre').join(', ') || 'Aucune'}</dd></div>
              </>}
              {item.translations && item.kind !== 'checklist' && <div><dt>Versions actives</dt><dd>{(['fr', 'en', 'ko'] as const).filter(locale => item.translations?.[locale].active).map(locale => locale.toUpperCase()).join(', ') || 'Aucune'}</dd></div>}
            </dl>
            {referenced && <small className="specific-reference-note">Suppression indisponible : cette fiche est utilisée par un autre paramétrage.</small>}
            {supportMode && <TechnicalInfo
              ids={[
                { label: 'Identifiant simulé', value: fakeTechnicalId(`specific-setting-${item.kind}`, item.id) },
                ...(item.kind === 'notice' && data.specificSettings.some(other => other.kind === 'toolBox' && other.id === item.values.toolBoxId) ? [{ label: 'Boîte à outils liée', value: fakeTechnicalId('specific-setting-toolBox', item.values.toolBoxId) }] : []),
                ...(item.kind === 'skillProfile' && data.specificSettings.some(other => other.kind === 'skillProfile' && other.id === item.values.parentId) ? [{ label: 'Dossier parent lié', value: fakeTechnicalId('specific-setting-skillProfile', item.values.parentId) }] : []),
                ...(item.kind === 'checklist' && data.entities.some(other => other.kind === 'auditType' && other.id === item.values.auditTypeId) ? [{ label: 'Type d’audit lié', value: entityTechnicalId('auditType', item.values.auditTypeId) }] : []),
                ...(item.checklistSections ?? []).map((section, index) => ({ label: `Section ${index + 1}`, value: fakeTechnicalId('checklist-section', section.id) })),
                ...(item.permissions ?? []).map((permission, index) => ({ label: `Autorisation ${index + 1}`, value: fakeTechnicalId('skill-permission', permission.id) })),
              ]}
              tables={tables}
            />}
          </article>})}
        </div>;
  }
}

function SettingEditor({ record, data, supportMode, tables, onClose, onSave }: {
  record: SpecificSettingRecord;
  data: Data;
  supportMode: boolean;
  tables: string[];
  onClose: () => void;
  onSave: (draft: SpecificSettingRecord) => void;
}) {
  const definition = settingDefinitions[record.kind];
  const isReportSetting = reportSpecificKinds.includes(record.kind);
  const standardsFor = (type: string) => [...new Set([...reportStandardsFor(type), ...(definition.standardOptions?.[type] ?? [])])];
  const [draft, setDraft] = useState<SpecificSettingRecord>(() => ({ ...record, values: { ...record.values } }));
  const [error, setError] = useState('');
  const patchValue = (key: string, value: string) => setDraft(current => ({ ...current, values: { ...current.values, [key]: value } }));
  const patchTranslation = (key: string, value: { en: string; ko: string }) =>
    setDraft(current => ({ ...current, textTranslations: { ...current.textTranslations, [key]: value } }));
  const dictionary = knownTextTranslations(data);
  const scope: ReportScope = draft.reportScope ?? { standardType: '', standards: [], auditTypes: [] };
  const auditTypesFor = (standards: string[]) => {
    if (record.kind !== 'certificateWeft') return reportAuditTypes;
    const configured = certificateAuditTypesFor(standards);
    return configured.length ? configured : reportAuditTypes;
  };
  const patchScope = (change: Partial<ReportScope>) => setDraft(current => ({
    ...current,
    reportScope: { ...scope, ...change },
  }));
  return <Modal title={`${record.name ? 'Modifier' : 'Créer'} : ${definition.singular}`} onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!draft.name.trim()) { setError('Renseignez un nom.'); return; }
      onSave(draft);
    }}>
      <div className="modal-body stack">
        {supportMode && <TechnicalInfo
          ids={[{ label: 'Identifiant simulé', value: fakeTechnicalId(`specific-setting-${record.kind}`, record.id) }]}
          tables={tables}
        />}
        <TranslatableField label="Nom *" required value={draft.name} onChange={name => setDraft(current => ({ ...current, name }))}
          placeholder={`Nom de ${definition.singular}`} translations={draft.textTranslations?.name}
          onTranslationsChange={value => patchTranslation('name', value)} knownLabels={dictionary} />
        {isReportSetting && <>
          <div className="form-grid">
            <Select label="Type de norme" value={scope.standardType}
              options={[{ value: '', label: 'Non renseigné' }, ...standardTypes]}
              onChange={standardType => patchScope({
                standardType,
                standards: standardType ? scope.standards.filter(standard => standard === 'Toutes les normes' || standardsFor(standardType).includes(standard)) : [],
                auditTypes: standardType ? scope.auditTypes : [],
              })} />
            <MultiSelectDropdown label="Norme(s)" values={scope.standards} exclusiveValue="Toutes les normes"
              options={scope.standardType ? ['Toutes les normes', ...standardsFor(scope.standardType)].map(value => ({ value, label: value })) : []}
              onChange={standards => patchScope({
                standards,
                auditTypes: record.kind === 'certificateWeft' ? scope.auditTypes.filter(value => auditTypesFor(standards).includes(value)) : scope.auditTypes,
              })} />
            <MultiSelectDropdown label="Types d’audit" values={scope.auditTypes}
              options={scope.standardType ? [...new Set([...auditTypesFor(scope.standards), ...scope.auditTypes])].map(value => ({ value, label: value })) : []}
              onChange={auditTypes => patchScope({ auditTypes })} />
          </div>
          <Notice>Ces rattachements alimentent la cartographie. Un niveau laissé vide apparaît comme « Non renseigné ». Les anciennes valeurs indicatives restent conservées et ne créent pas de rattachement automatique.</Notice>
        </>}
        <div className="form-grid">
          {definition.fields.map(field => field.translatable ? <TranslatableField key={field.key} label={field.label} wide={field.multiline}
            multiline={field.multiline} value={draft.values[field.key] || ''} onChange={value => patchValue(field.key, value)}
            placeholder={field.placeholder} translations={draft.textTranslations?.[field.key]}
            onTranslationsChange={value => patchTranslation(field.key, value)} knownLabels={dictionary} /> : <Field key={field.key} label={field.label} wide={field.multiline}>
            {field.multiline
              ? <textarea value={draft.values[field.key] || ''} onChange={event => patchValue(field.key, event.target.value)} placeholder={field.placeholder} rows={3} />
              : <input value={draft.values[field.key] || ''} onChange={event => patchValue(field.key, event.target.value)} placeholder={field.placeholder} />}
          </Field>)}
        </div>
        <CheckField checked={draft.active} onChange={active => setDraft(current => ({ ...current, active }))}>Paramétrage actif</CheckField>
        {record.kind === 'toolBox' && <fieldset className="toolbox-visibility">
          <legend>Visibilité</legend>
          <p>Choisissez les publics pour lesquels cette boîte à outils est visible.</p>
          <div className="toolbox-visibility-options">
            {toolBoxVisibilityFields.map(field => <CheckField key={field.key}
              checked={draft.values[field.key] === 'true'}
              onChange={checked => patchValue(field.key, String(checked))}>{field.label}</CheckField>)}
          </div>
        </fieldset>}
        <Notice>Ces données sont fictives et restent dans le stockage local de cette maquette.</Notice>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <FormActions onClose={onClose} label="Enregistrer" />
    </form>
  </Modal>;
}
