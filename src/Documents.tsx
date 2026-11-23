import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, Check, CloudUpload, Copy, Database, FileText, Languages, Link2, Pencil, Plus, Upload } from 'lucide-react';
import type { Commit, Data, DocumentLocale, DocumentModel, DocumentVersion, Impact } from './types';
import { demoTagQueryMappings } from './data';
import { readDocxTags } from './docxTags';
import {
  alphabetic, azureBlobPathFor, documentGenerationMode, documentScriptReadinessError,
  generateDemoSqlScript, isSystemCompatibilityDocument, knownTextTranslations, matches, matchesFilter, prepareGeneratedDocumentFile, replaceDocumentVersion, simulateAzureReplacement,
  tagAnalysisForTags, templateError, templateFileNameForLogicalName, validateDocumentSqlScript,
} from './domain';
import { Badge, CheckField, CompatibilityWarning, Empty, Field, FilterDropdown, FormActions, Modal, Notice, SearchBox, SectionTitle, Select, Status, TechnicalInfo, TechnicalInlineId, formatDate } from './ui';
import { documentTemplateDescriptionTechnicalId, documentTemplateTechnicalId, fakeTechnicalId, technicalMappings } from './supportConfig';
import { TranslatableField } from './TranslatableField';
import { DocumentTypes } from './DocumentTypes';

const documentLocales: { code: DocumentLocale; tag: string; label: string }[] = [
  { code: 'fr', tag: 'FR', label: 'Français' },
  { code: 'en', tag: 'EN', label: 'English' },
  { code: 'ko', tag: 'KO', label: '한국어 / Coréen' },
];
const documentName = (document: DocumentModel) =>
  document.versions.fr.label || document.versions.en.label || document.versions.ko.label || 'Document sans titre';
const compatibilityDocument = (document: DocumentModel) => isSystemCompatibilityDocument(document.type, ...documentLocales.map(item => document.versions[item.code].label));
const hasLanguageVersion = (version: DocumentVersion) => Boolean(version.label.trim() && version.templateLogicalName.trim() && version.fileName.trim());

function createDocument(type = 'Courrier'): DocumentModel {
  const updatedAt = new Date().toISOString();
  const version = (language: DocumentLocale): DocumentVersion => ({
    language, label: '', description: '', active: true, templateLogicalName: '', fileName: '', version: 0, archives: [],
    detectedTags: [], unmappedTags: [], sqlScript: '', sqlScriptStatus: 'À générer', analyzedFileName: '',
    azureContainer: 'diams-templates-demo', azureBlobPath: '', azureSyncStatus: 'Non synchronisé',
    lastUpdatedAt: updatedAt, azureLastOperation: null,
  });
  return {
    id: crypto.randomUUID(), type, active: true, mandatory: false, workDocument: false, originDocumentId: '',
    generationMode: 'none', visibleInExpertiseAndVeto: false, implementationEvidence: false, implementationVerification: false, taskIds: [],
    versions: { fr: version('fr'), en: version('en'), ko: version('ko') },
  };
}

async function docxFileError(file: File): Promise<string | null> {
  const invalid = templateError(file);
  if (invalid) return invalid;
  try {
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      return 'Ce fichier ne possède pas la signature ZIP attendue d’un .docx.';
    }
    return null;
  } catch (cause) {
    return `Impossible de lire le fichier local : ${cause instanceof Error ? cause.message : String(cause)}`;
  }
}

function TemplateNameProposal({ file, logicalName, onRename }: { file: File; logicalName: string; onRename: (file: File) => void }) {
  const [kept, setKept] = useState(false);
  const expected = templateFileNameForLogicalName(logicalName);
  if (!expected) return <p className="form-error" role="alert">Renseignez un nom logique sans séparateur de chemin ni caractère de contrôle pour préparer l’envoi.</p>;
  if (file.name === expected) return null;
  return <div className="template-name-proposal">
    <strong>Le nom du fichier diffère du nom logique</strong>
    <p>Pour l’envoi simulé, utiliser « {expected} » à la place de « {file.name} » ? Le fichier d’origine ne sera pas modifié.</p>
    <div className="button-row">
      <button type="button" className="btn small primary" onClick={() => onRename(new File([file], expected, { type: file.type, lastModified: file.lastModified }))}>Utiliser le nom logique</button>
      <button type="button" className="btn small" onClick={() => setKept(true)}>Conserver le nom du fichier</button>
    </div>
    <small role="status">{kept ? 'Nom actuel conservé. ' : ''}L’envoi Azure simulé reste bloqué tant que les noms ne correspondent pas.</small>
  </div>;
}

function renameAnalyzedFile(document: DocumentModel, locale: DocumentLocale, previousName: string, newName: string): DocumentModel {
  const version = document.versions[locale];
  if (version.analyzedFileName !== previousName) return document;
  return { ...document, versions: { ...document.versions, [locale]: { ...version, analyzedFileName: newName } } };
}

export function Documents({ data, commit, confirm, initialSearch = '', supportMode = false }: { data: Data; commit: Commit; confirm: (impact: Impact) => void; initialSearch?: string; supportMode?: boolean }) {
  const [section, setSection] = useState<'models' | 'types'>('models');
  const [query, setQuery] = useState(initialSearch);
  const [type, setType] = useState<string[]>([]);
  const [language, setLanguage] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(initialSearch ? [] : ['active']);
  const [descending, setDescending] = useState(false);
  const [editing, setEditing] = useState<DocumentModel | null>(null);
  const [replacement, setReplacement] = useState<DocumentModel | null>(null);
  const documents = alphabetic(data.documents.filter(document => {
    const localizedValues = documentLocales.flatMap(locale => {
      const version = document.versions[locale.code];
      return [version.label, version.templateLogicalName, version.fileName, version.sqlScript, ...version.detectedTags];
    });
    return matches(query, document.type, ...localizedValues) &&
      matchesFilter(document.type, type) &&
      (!language.length || documentLocales.some(locale => language.includes(locale.code) && hasLanguageVersion(document.versions[locale.code]))) &&
      matchesFilter(document.active ? 'active' : 'inactive', status);
  }), documentName);
  if (descending) documents.reverse();

  const save = (draft: DocumentModel) => {
    const apply = () => {
      const ok = commit(`${data.documents.some(document => document.id === draft.id) ? 'Modification' : 'Création'} du document « ${documentName(draft)} »`,
        `${draft.taskIds.length} tâches · versions FR/EN/KO indépendantes`,
        current => {
          const previous = current.documents.find(document => document.id === draft.id);
          const selected = current.documentTypes.find(item => item.name === draft.type);
          if ((!selected || !selected.active) && (!draft.type || previous?.type !== draft.type))
            throw new Error('Choisissez un type de document actif.');
          return { ...current, documents: [...current.documents.filter(document => document.id !== draft.id), draft] };
        });
      if (ok) setEditing(null);
      return ok;
    };
    if (data.documents.some(document => document.id === draft.id)) confirm({
      title: 'Modifier ce document partagé ?',
      description: `Les associations de « ${documentName(draft)} » seront disponibles dans toutes les matrices des tâches sélectionnées.`,
      scope: 'Modèle documentaire multilingue et associations',
      compatibilityWarning: compatibilityDocument(draft) || data.documents.some(item => item.id === draft.id && compatibilityDocument(item)),
      facts: [
        { label: 'tâches associées', value: draft.taskIds.length },
        { label: 'matrices utilisant ces tâches', value: data.matrices.filter(matrix => !matrix.deleted && matrix.taskIds.some(id => draft.taskIds.includes(id))).length },
      ],
      technical: { ids: [{ label: 'ID document', value: documentTemplateTechnicalId(draft.id) }], tables: [...technicalMappings.documentTemplates.tables] },
      apply,
    });
    else apply();
  };

  const persistTemplateChange = (next: DocumentModel, title: string) => {
    return commit(title, `${documentName(next)} · versions FR/EN/KO indépendantes`,
      current => {
        const previous = current.documents.find(item => item.id === next.id);
        if (!previous) throw new Error('Ce document n’existe plus.');
        for (const locale of documentLocales) {
          const name = next.versions[locale.code].templateLogicalName.trim();
          if (name === previous.versions[locale.code].templateLogicalName.trim()) continue;
          if (!name) throw new Error('Renseignez le nom logique du template.');
          if (documentLocales.some(other => other.code !== locale.code && next.versions[other.code].templateLogicalName.trim() === name) ||
            current.documents.some(item => item.id !== next.id && documentLocales.some(other => item.versions[other.code].templateLogicalName.trim().toLowerCase() === name.toLowerCase())))
            throw new Error('Ce nom de template est déjà utilisé par une autre version.');
        }
        return { ...current, documents: current.documents.map(item => item.id === next.id ? next : item) };
      });
  };

  return <>
    <SectionTitle eyebrow="PARAMÉTRAGE / DOCUMENTS" title="Gérer les documents" description="Gérez les modèles, leurs associations aux tâches et les types de documents."
      action={section === 'models' ? <button className="btn primary" onClick={() => setEditing(createDocument(data.documentTypes.find(item => item.active && item.name === 'Courrier')?.name ?? data.documentTypes.find(item => item.active)?.name ?? ''))}><Plus size={18} />Créer un document</button> : undefined} />
    <nav className="report-settings-tabs" aria-label="Gestion des documents">
      <button className={section === 'models' ? 'selected' : ''} aria-current={section === 'models' ? 'page' : undefined} onClick={() => setSection('models')}>Modèles de documents <Badge>{data.documents.length}</Badge></button>
      <button className={section === 'types' ? 'selected' : ''} aria-current={section === 'types' ? 'page' : undefined} onClick={() => setSection('types')}>Types de documents <Badge>{data.documentTypes.length}</Badge></button>
    </nav>
    {section === 'types' ? <DocumentTypes data={data} commit={commit} confirm={confirm} supportMode={supportMode} /> : <>
    <div className="panel">
      <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Rechercher un document ou un template…" /><Badge>{documents.length} documents</Badge></div>
      <div className="filters">
        <FilterDropdown label="Type de document" values={type} onChange={setType} allLabel="Tous les types" options={[...new Set([...data.documentTypes.map(item => item.name), ...data.documents.map(item => item.type)])]} />
        <FilterDropdown label="Langue" values={language} onChange={setLanguage} allLabel="Toutes les langues" options={documentLocales.map(locale => ({ value: locale.code, label: `${locale.tag} · ${locale.label}` }))} />
        <FilterDropdown label="Statut" values={status} onChange={setStatus} options={[{ value: 'active', label: 'Actifs' }, { value: 'inactive', label: 'Inactifs' }]} />
      </div>
      <div className="table-scroll"><table className="documents-table"><thead><tr>
        <th><button className="sort-btn" onClick={() => setDescending(!descending)}>Document <ArrowDownUp size={13} /></button></th>
        <th>Type</th><th>Versions</th><th>Templates associés</th><th>Tâches associées</th><th>Statut</th>{supportMode && <th>Informations techniques</th>}<th>Actions</th>
      </tr></thead><tbody>
        {documents.map(document => <tr key={document.id}>
          <td><div className="inline"><span className="file-icon"><FileText size={19} /></span><strong>{documentName(document)}</strong></div>{compatibilityDocument(document) && <CompatibilityWarning />}<small>{document.mandatory ? 'Obligatoire' : 'Facultatif'} · {documentGenerationMode(document) === 'none' ? 'Non généré' : 'Généré · scripts par langue'}</small></td>
          <td>{document.type}</td>
          <td><div className="document-language-badges">{documentLocales.map(locale => <Badge key={locale.code} tone={hasLanguageVersion(document.versions[locale.code]) ? 'blue' : 'neutral'}>{locale.tag}</Badge>)}</div></td>
          <td><div className="document-template-list">{documentLocales.map(locale => <div key={locale.code}><span>{locale.tag}</span><code>{document.versions[locale.code].templateLogicalName || 'À définir'}</code></div>)}</div></td>
          <td>{document.taskIds.map(id => <span className="task-label" key={id}>{data.tasks.find(task => task.id === id)?.name}{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template', id)} />}</span>)}{!document.taskIds.length && <small>Non associé</small>}</td>
          <td><Status active={document.active} /></td>
          {supportMode && <td><TechnicalInfo
            ids={[
              { label: 'ID document · fictif', value: documentTemplateTechnicalId(document.id) },
              ...data.documentTypes.filter(item => item.name === document.type).map(item => ({ label: 'ID catégorie · fictif', value: fakeTechnicalId('document-type', item.id) })),
              ...documentLocales.map(locale => ({
                label: `ID version document ${locale.tag} · fictif`,
                value: documentTemplateDescriptionTechnicalId(document.id, locale.code),
              })),
            ]}
            fields={documentLocales.map(locale => ({
              label: `Template ${locale.tag}`,
              value: document.versions[locale.code].templateLogicalName || 'À définir',
            }))}
            tables={[...technicalMappings.documentTypes.tables, ...technicalMappings.documentTemplates.tables, ...technicalMappings.documentTaskAssociations.tables, ...technicalMappings.templateScripts.tables]}
          /></td>}
          <td><div className="inline"><button className="icon-btn" aria-label={`Modifier ${documentName(document)}`} onClick={() => setEditing(document)}><Pencil size={17} /></button><button className="icon-btn" aria-label={`Remplacer une version du template de ${documentName(document)}`} onClick={() => setReplacement(document)}><Upload size={18} /></button></div></td>
        </tr>)}
      </tbody></table></div>{!documents.length && <Empty />}
    </div>
    <Notice>Les tâches restent communes au document métier. Pour les documents générés, les balises et scripts sont indépendants pour FR, EN et KO.</Notice>
    {editing && <DocumentEditor document={editing} data={data} supportMode={supportMode} onClose={() => setEditing(null)} onSave={save} />}
    {replacement && <TemplateReplacement document={replacement} supportMode={supportMode} onClose={() => setReplacement(null)}
      onLocalSave={next => { const ok = persistTemplateChange(next, `Enregistrement local du template « ${documentName(next)} »`); if (ok) setReplacement(null); return ok; }}
      onAzureSave={next => persistTemplateChange(next, `Remplacement Azure simulé du template « ${documentName(next)} »`)} />}
    </>}
  </>;
}

function DocumentEditor({ document, data, supportMode, onSave, onClose }: { document: DocumentModel; data: Data; supportMode: boolean; onSave: (doc: DocumentModel) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<DocumentModel>(() => ({
    ...document,
    generationMode: documentGenerationMode(document),
    taskIds: [...document.taskIds],
    versions: {
      fr: { ...document.versions.fr, archives: [...document.versions.fr.archives], detectedTags: [...document.versions.fr.detectedTags], unmappedTags: [...document.versions.fr.unmappedTags] },
      en: { ...document.versions.en, archives: [...document.versions.en.archives], detectedTags: [...document.versions.en.detectedTags], unmappedTags: [...document.versions.en.unmappedTags] },
      ko: { ...document.versions.ko, archives: [...document.versions.ko.archives], detectedTags: [...document.versions.ko.detectedTags], unmappedTags: [...document.versions.ko.unmappedTags] },
    },
  }));
  const [locale, setLocale] = useState<DocumentLocale>('fr');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Record<DocumentLocale, File | null>>({ fr: null, en: null, ko: null });
  const [sourceNames, setSourceNames] = useState<Record<DocumentLocale, string>>({ fr: '', en: '', ko: '' });
  const attemptedFiles = useRef<Partial<Record<DocumentLocale, File>>>({});
  const [fileErrors, setFileErrors] = useState<Record<DocumentLocale, string>>({ fr: '', en: '', ko: '' });
  const [checkingLocale, setCheckingLocale] = useState<DocumentLocale | null>(null);
  const [azureConfirmation, setAzureConfirmation] = useState<{ locale: DocumentLocale; file: File; version: number } | null>(null);
  const [scriptMessage, setScriptMessage] = useState('');
  const currentVersion = draft.versions[locale];
  const pendingFile = pendingFiles[locale];
  const checkingFile = checkingLocale === locale;
  const nextVersion = pendingFile ? nextTemplateVersion(currentVersion, sourceNames[locale] || pendingFile.name) : 0;
  const generationMode = documentGenerationMode(draft);
  const generationDisabled = draft.mandatory || Boolean(draft.workDocument);
  const generated = generationMode !== 'none';
  const readinessError = pendingFile ? documentScriptReadinessError(currentVersion, pendingFile.name, generationMode) : 'Choisissez un nouveau fichier .docx.';
  const localSaveError = !currentVersion.templateLogicalName.trim() ? 'Renseignez le nom logique du template avant de remplacer le fichier.' : '';
  const knownLabels = knownTextTranslations(data);
  const patch = (change: Partial<DocumentModel>) => setDraft(current => ({ ...current, ...change }));
  const patchVersion = (change: Partial<DocumentVersion>) => setDraft(current => ({
    ...current,
    versions: { ...current.versions, [locale]: { ...current.versions[locale], ...change } },
  }));
  const patchText = (key: 'label' | 'description', values: Partial<Record<DocumentLocale, string>>) => setDraft(current => ({
    ...current,
    versions: {
      fr: { ...current.versions.fr, ...(values.fr === undefined ? {} : { [key]: values.fr }) },
      en: { ...current.versions.en, ...(values.en === undefined ? {} : { [key]: values.en }) },
      ko: { ...current.versions.ko, ...(values.ko === undefined ? {} : { [key]: values.ko }) },
    },
  }));
  const chooseDocumentFile = async (target: DocumentLocale, candidate?: File) => {
    if (!candidate) return;
    setCheckingLocale(target);
    setFileErrors(current => ({ ...current, [target]: '' }));
    const invalid = await docxFileError(candidate);
    setCheckingLocale(current => current === target ? null : current);
    if (invalid) { setFileErrors(current => ({ ...current, [target]: invalid })); return; }
    setSourceNames(current => ({ ...current, [target]: candidate.name }));
    setPendingFiles(current => ({ ...current, [target]: candidate }));
    setDraft(current => prepareGeneratedDocumentFile(current, target, candidate.name));
  };
  const saveLocally = () => {
    if (!pendingFile || localSaveError) return;
    const analysis = !generated || currentVersion.analyzedFileName === pendingFile.name ? versionAnalysis(currentVersion) : undefined;
    const next = replaceDocumentVersion(draft, locale, pendingFile.name, nextVersion, true, new Date().toISOString(), analysis);
    setDraft(next);
    setPendingFiles(current => ({ ...current, [locale]: null }));
  };
  const sendToAzure = (outcome: 'success' | 'failure') => {
    if (!pendingFile) return;
    const next = simulateAzureReplacement(draft, locale, pendingFile.name, nextVersion, new Date().toISOString(), outcome);
    setDraft(next);
    if (outcome === 'success') setPendingFiles(current => ({ ...current, [locale]: null }));
    setAzureConfirmation(null);
  };
  useEffect(() => {
    if (!generated || !pendingFile || checkingFile || readinessError || attemptedFiles.current[locale] === pendingFile) return;
    attemptedFiles.current[locale] = pendingFile;
    try {
      const next = simulateAzureReplacement(draft, locale, pendingFile.name, nextVersion, new Date().toISOString());
      setDraft(next);
      setPendingFiles(current => current[locale] === pendingFile ? { ...current, [locale]: null } : current);
      setScriptMessage('Envoi Azure simulé automatiquement. Enregistrez le document pour conserver les métadonnées.');
    } catch (cause) {
      setFileErrors(current => ({ ...current, [locale]: `Envoi simulé impossible : ${cause instanceof Error ? cause.message : String(cause)}. Sélectionnez à nouveau le fichier pour réessayer.` }));
    }
  }, [checkingFile, draft, generated, locale, nextVersion, pendingFile, readinessError]);
  const configurationWarnings = generated ? documentLocales.flatMap(item => {
    const version = draft.versions[item.code];
    const warnings: string[] = [];
    if (!version.templateLogicalName.trim()) warnings.push('nom logique du template absent');
    if (!version.fileName) warnings.push('aucune trame sélectionnée');
    else if (!version.detectedTags.length) warnings.push('balises à analyser');
    const metrics = tagMetrics(version);
    if (metrics.unknown) warnings.push(`${metrics.unknown} balise(s) non reconnue(s)`);
    if (metrics.withoutSql) warnings.push(`${metrics.withoutSql} balise(s) sans correspondance SQL`);
    if (version.sqlScriptStatus !== 'Valide') warnings.push(`script ${version.sqlScriptStatus.toLowerCase()}`);
    return warnings.length ? [`${item.tag} : ${warnings.join(', ')}`] : [];
  }) : [];

  return <Modal title={documentName(document) === 'Document sans titre' ? 'Créer un document métier' : 'Modifier le document métier'}
    subtitle="Un seul document regroupe ses informations communes et ses versions FR, EN et KO." wide onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (checkingLocale) { setError('Attendez la fin de la vérification du fichier.'); return; }
      const versions = {
        fr: { ...draft.versions.fr, label: draft.versions.fr.label.trim() },
        en: { ...draft.versions.en, label: draft.versions.en.label.trim() },
        ko: { ...draft.versions.ko, label: draft.versions.ko.label.trim() },
      };
      const selectedType = data.documentTypes.find(item => item.name === draft.type);
      if ((!selectedType || !selectedType.active) && (!draft.type || !data.documents.some(item => item.id === draft.id && item.type === draft.type))) {
        setError('Choisissez un type de document actif.'); return;
      }
      const templateNames = documentLocales.map(item => versions[item.code].templateLogicalName.trim());
      if (!versions.fr.label || (generated && documentLocales.some(item => !versions[item.code].label))) { setError(generated ? 'Saisissez le libellé dans les trois langues.' : 'Saisissez le nom français du document.'); return; }
      if (generated && templateNames.some(name => !name)) { setError('Renseignez le nom logique du template dans chaque langue.'); return; }
      const definedTemplateNames = templateNames.filter(Boolean);
      if (new Set(definedTemplateNames).size !== definedTemplateNames.length) { setError('Les noms de template renseignés doivent être distincts.'); return; }
      const otherTemplateNames = data.documents.filter(item => item.id !== draft.id)
        .flatMap(item => documentLocales.map(language => item.versions[language.code].templateLogicalName.trim().toLowerCase()));
      if (definedTemplateNames.some(name => otherTemplateNames.includes(name.toLowerCase()))) { setError('Un de ces noms de template est déjà utilisé par un autre document.'); return; }
      onSave({ ...draft, generationMode, versions, taskIds: [...new Set(draft.taskIds)] });
    }}>
      <div className="modal-body stack document-editor">
        {(compatibilityDocument(document) || compatibilityDocument(draft)) && <CompatibilityWarning />}
        <div className="form-grid">
          <TranslatableField label="Nom du document *" required wide value={draft.versions.fr.label}
            onChange={value => patchText('label', { fr: value })} translations={{ en: draft.versions.en.label, ko: draft.versions.ko.label }}
            onTranslationsChange={value => patchText('label', value)} knownLabels={knownLabels} />
          <TranslatableField label="Description du document" multiline wide value={draft.versions.fr.description || ''}
            onChange={value => patchText('description', { fr: value })} translations={{ en: draft.versions.en.description || '', ko: draft.versions.ko.description || '' }}
            onTranslationsChange={value => patchText('description', value)} knownLabels={knownLabels} />
        </div>
        <section className="document-common">
          <h3 className="subheading">Paramètres du document</h3>
          <div className="form-grid">
            <Select label="Type de document" value={draft.type} required onChange={type => patch({ type })}
              options={[...data.documentTypes.filter(item => item.active || (item.name === draft.type && data.documents.some(document => document.id === draft.id && document.type === item.name)))
                .map(item => ({ value: item.name, label: `${item.name}${item.active ? '' : ' · Inactif (conservé)'}` })),
                ...(draft.type && !data.documentTypes.some(item => item.name === draft.type) && data.documents.some(item => item.id === draft.id)
                  ? [{ value: draft.type, label: `${draft.type} · Type historique conservé` }] : [])]} />
            <Select label="Document template d’origine" value={draft.originDocumentId || ''} onChange={originDocumentId => patch({ originDocumentId })}
              options={[{ value: '', label: 'Aucun' }, ...data.documents.filter(item => item.id !== draft.id).map(item => ({ value: item.id, label: documentName(item) })),
                ...(draft.originDocumentId && !data.documents.some(item => item.id === draft.originDocumentId) ? [{ value: draft.originDocumentId, label: 'Document d’origine indisponible' }] : [])]} />
            <div className="button-row document-flags wide"><CheckField checked={draft.active} onChange={active => patch({ active })}>Actif</CheckField>
              <CheckField checked={draft.mandatory} onChange={mandatory => patch({ mandatory, ...(mandatory ? { generationMode: 'none' } : {}) })}>Document obligatoire</CheckField>
              <CheckField checked={draft.workDocument ?? false} onChange={workDocument => patch({ workDocument, ...(workDocument ? { generationMode: 'none' } : {}) })}>Document de travail</CheckField></div>
          </div>
          <fieldset className="document-generation"><legend>Mode de génération</legend>
            {([{ value: 'none', label: 'Non généré' }, { value: 'before', label: 'Avant la tâche' }, { value: 'after', label: 'Après la tâche' }] as const).map(option =>
              <label key={option.value} className={`${generationMode === option.value ? 'selected' : ''}${generationDisabled && option.value !== 'none' ? ' disabled' : ''}`}><input type="radio" name="generationMode" value={option.value} checked={generationMode === option.value} disabled={generationDisabled && option.value !== 'none'} onChange={() => patch({ generationMode: option.value })} />{option.label}</label>)}
          </fieldset>
          {generationDisabled && <small>Un document obligatoire ou de travail ne peut pas être généré. Décochez ces options pour choisir une génération avant ou après la tâche.</small>}
          <div className="button-row document-flags">
            <CheckField checked={draft.visibleInExpertiseAndVeto ?? false} onChange={visibleInExpertiseAndVeto => patch({ visibleInExpertiseAndVeto })}>Visible en expertise et tâche véto</CheckField>
            <CheckField checked={draft.implementationEvidence ?? false} onChange={implementationEvidence => patch({ implementationEvidence })}>Preuve mise en œuvre doc</CheckField>
            <CheckField checked={draft.implementationVerification ?? false} onChange={implementationVerification => patch({ implementationVerification })}>Vérification mise en œuvre doc</CheckField>
          </div>
          <small>Le document d’origine référence un autre modèle utilisé comme document de travail ; ce lien est simulé.</small>
        </section>
        {generated && <Notice warning>Le script proposé est illustratif et modifiable. Aucun SQL n’est exécuté et aucun fichier n’est réellement envoyé.</Notice>}
        {supportMode && <TechnicalInfo
          ids={[
            { label: 'ID document fictif', value: documentTemplateTechnicalId(document.id) },
            ...data.documentTypes.filter(item => item.name === draft.type).map(item => ({ label: 'ID catégorie fictif', value: fakeTechnicalId('document-type', item.id) })),
            ...documentLocales.map(item => ({
              label: `ID version document ${item.tag}`,
              value: documentTemplateDescriptionTechnicalId(document.id, item.code),
            })),
            ...draft.taskIds.map((taskId, index) => ({
              label: `ID tâche associé ${index + 1}`,
              value: fakeTechnicalId('task-template', taskId),
            })),
            ...(draft.originDocumentId && data.documents.some(item => item.id === draft.originDocumentId)
              ? [{ label: 'ID document d’origine', value: documentTemplateTechnicalId(draft.originDocumentId) }] : []),
          ]}
          fields={[
            ...documentLocales.map(item => ({
              label: `Nom logique du template ${item.tag}`,
              value: document.versions[item.code].templateLogicalName || 'À définir',
            })),
            ...documentLocales.map(item => ({
              label: `Langue du script ${item.tag}`,
              value: item.code,
            })),
          ]}
          tables={[
            ...technicalMappings.documentTypes.tables,
            ...technicalMappings.documentTemplates.tables,
            ...technicalMappings.documentTaskAssociations.tables,
            ...technicalMappings.templateScripts.tables,
          ]}
        />}
        {!!configurationWarnings.length && <div className="document-config-warning" role="note">
          <strong>Configuration linguistique incomplète — enregistrement non bloqué</strong>
          <ul>{configurationWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          <small>Une version n’est considérée comme prête que si sa trame est sélectionnée, ses balises ont une correspondance et son script est validé.</small>
        </div>}
        <section className="document-language-section">
          <div className="document-language-heading"><div><h3>Versions et templates par langue</h3><p>Chaque onglet conserve son fichier et son état Azure{generated ? ', ainsi que ses balises et son script SQL' : ''}.</p></div><Languages size={19} /></div>
          <div className="document-language-tabs" role="tablist" aria-label="Versions linguistiques du document">
            {documentLocales.map(item => <button key={item.code} type="button" role="tab" aria-selected={locale === item.code} className={locale === item.code ? 'selected' : ''} onClick={() => { setLocale(item.code); setScriptMessage(''); }}>
              <strong>{item.tag}</strong><span>{item.label}</span>
            </button>)}
          </div>
          <div className="document-language-fields">
            {supportMode && <TechnicalInfo ids={[{ label: `ID version document ${locale.toUpperCase()}`, value: documentTemplateDescriptionTechnicalId(document.id, locale) }]} tables={[]} />}
            <CheckField checked={currentVersion.active ?? true} onChange={active => patchVersion({ active })}>Version {locale.toUpperCase()} active</CheckField>
            <Field label={`Nom logique du template ${locale.toUpperCase()}${generated ? ' *' : ''}`} wide hint={generated ? 'Le nom du fichier est repris s’il est vide ; vous pouvez le modifier. Un nom distinct est nécessaire par langue.' : 'Nom modifiable, distinct pour chaque langue.'}>
              <input required={generated} value={currentVersion.templateLogicalName} onChange={event => patchVersion({ templateLogicalName: event.target.value })} placeholder={`ex. Audit confirmation ${locale.toUpperCase()}.docx`} />
            </Field>
            <div className="template-current">
              <FileText size={22} />
              <div><small>FICHIER .DOCX ACTUEL · {locale.toUpperCase()}</small><strong>{currentVersion.fileName || 'Aucun fichier associé'}</strong>
                <small>Version {currentVersion.version || 'non définie'} · {currentVersion.lastUpdatedAt ? formatDate(currentVersion.lastUpdatedAt) : '—'}</small>
              </div>
            </div>
            <Field label={`Choisir le fichier .docx ${locale.toUpperCase()}`} hint="10 Mo maximum. Le fichier reste local : seule sa métadonnée sera enregistrée.">
              <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={checkingFile} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; void chooseDocumentFile(locale, selected); }} />
            </Field>
            {checkingFile && <p role="status">Vérification locale du fichier…</p>}
            {fileErrors[locale] && <p className="form-error" role="alert">{fileErrors[locale]}</p>}
            {pendingFile && <div className="file-comparison"><div><small>NOUVEAU FICHIER · {locale.toUpperCase()}</small><strong>{pendingFile.name}</strong><span>{(pendingFile.size / 1024).toFixed(1)} Ko · version proposée {nextVersion}</span></div></div>}
            {generated && pendingFile && <TemplateNameProposal key={`${locale}:${pendingFile.name}:${currentVersion.templateLogicalName}`}
              file={pendingFile} logicalName={currentVersion.templateLogicalName} onRename={renamed => {
                setDraft(current => renameAnalyzedFile(current, locale, pendingFile.name, renamed.name));
                setPendingFiles(current => ({ ...current, [locale]: renamed }));
              }} />}
            {!!currentVersion.archives.length && <details><summary>Historique des fichiers {locale.toUpperCase()} ({currentVersion.archives.length})</summary><ul>{currentVersion.archives.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></details>}
            <Field label={`Conteneur Azure simulé ${locale.toUpperCase()}`} hint="Valeur fictive modifiable; aucune connexion Azure n’est effectuée.">
              <input value={currentVersion.azureContainer} onChange={event => patchVersion({ azureContainer: event.target.value })} />
            </Field>
            <div className="metadata"><div><span>État Azure</span><strong>{currentVersion.azureSyncStatus}</strong></div><div><span>Clé Blob actuelle</span><code>{currentVersion.azureBlobPath || 'Non définie'}</code></div></div>
            {generated && <TagSqlEditor locale={locale} version={currentVersion} candidateFile={pendingFile}
              onChange={patchVersion} message={scriptMessage} setMessage={setScriptMessage} />}
            {pendingFile && <div className="document-upload-actions">
              <button type="button" className="btn" disabled={checkingFile || Boolean(localSaveError)} onClick={saveLocally}><Database size={16} />Enregistrer uniquement dans la maquette</button>
              {generated ? <small>L’envoi Azure est simulé automatiquement après validation du script et concordance des noms.</small> :
                <button type="button" className="btn primary" disabled={checkingFile || Boolean(readinessError)} title={readinessError || undefined}
                  onClick={() => setAzureConfirmation({ locale, file: pendingFile, version: nextVersion })}><CloudUpload size={16} />Envoyer vers Azure et remplacer</button>}
              {readinessError && <small className="field-hint">{readinessError}</small>}
            </div>}
            {currentVersion.azureLastOperation && <AzureResultPanel operation={currentVersion.azureLastOperation} />}
          </div>
        </section>

        <section className="document-common">
          <h3 className="subheading"><Link2 size={17} />Tâches associées aux trois langues</h3>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un modèle de tâche…" />
          <div className="checkbox-list">{alphabetic(data.tasks.filter(task => matches(search, task.name)), task => task.name).map(task =>
            <CheckField key={task.id} checked={draft.taskIds.includes(task.id)} onChange={checked => patch({ taskIds: checked ? [...draft.taskIds, task.id] : draft.taskIds.filter(id => id !== task.id) })}>
              {task.name}{!task.active && <Badge>Inactif</Badge>}{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template', task.id)} />}
            </CheckField>)}
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <FormActions onClose={onClose} />
    </form>
    {azureConfirmation && <AzureReplacementConfirmation
      documentId={document.id}
      supportMode={supportMode}
      version={draft.versions[azureConfirmation.locale]}
      generated={generated}
      locale={azureConfirmation.locale}
      fileName={azureConfirmation.file.name}
      nextVersion={azureConfirmation.version}
      onClose={() => setAzureConfirmation(null)}
      onConfirm={sendToAzure}
    />}
  </Modal>;
}

function nextTemplateVersion(current: DocumentVersion, fileName: string): number {
  const detected = fileName.match(/(?:v|rev(?:ision)?)[\s_.-]*(\d+)/i)?.[1];
  return Math.max(current.version + 1, detected ? Number(detected) : 0);
}

function versionAnalysis(version: DocumentVersion): Pick<DocumentVersion, 'detectedTags' | 'unmappedTags' | 'sqlScript' | 'sqlScriptStatus' | 'analyzedFileName'> {
  return {
    detectedTags: [...version.detectedTags],
    unmappedTags: [...version.unmappedTags],
    sqlScript: version.sqlScript,
    sqlScriptStatus: version.sqlScriptStatus,
    analyzedFileName: version.analyzedFileName,
  };
}

function tagMetrics(version: DocumentVersion) {
  const mappings = new Map(demoTagQueryMappings.map(mapping => [mapping.tag, mapping]));
  const uniqueTags = [...new Set(version.detectedTags)];
  return {
    total: version.detectedTags.length,
    recognized: uniqueTags.filter(tag => mappings.has(tag)).length,
    unknown: version.unmappedTags.length,
    withoutSql: uniqueTags.filter(tag => mappings.has(tag) && !mappings.get(tag)?.sourceHint).length,
    duplicates: uniqueTags.filter(tag => version.detectedTags.filter(detected => detected === tag).length > 1),
  };
}

function TagSqlEditor({ locale, version, candidateFile, onChange, message, setMessage }: {
  locale: DocumentLocale;
  version: DocumentVersion;
  candidateFile: File | null;
  onChange: (change: Partial<DocumentVersion>) => void;
  message: string;
  setMessage: (message: string) => void;
}) {
  const metrics = tagMetrics(version);
  const mappings = new Map(demoTagQueryMappings.map(mapping => [mapping.tag, mapping]));
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const currentFile = useRef(candidateFile);
  currentFile.current = candidateFile;
  const generate = async () => {
    if (!candidateFile) { setAnalysisError(true); setMessage('Sélectionnez le fichier .docx pour analyser son contenu.'); return; }
    setAnalyzing(true);
    setAnalysisError(false);
    try {
      const tags = await readDocxTags(candidateFile);
      if (currentFile.current !== candidateFile) { setMessage('Le fichier a changé pendant l’analyse ; relancez-la.'); return; }
      const analysis = tagAnalysisForTags(tags);
      onChange({
        detectedTags: analysis.detectedTags,
        unmappedTags: analysis.unmappedTags,
        sqlScript: generateDemoSqlScript(analysis.detectedTags, locale),
        sqlScriptStatus: 'Brouillon',
        analyzedFileName: candidateFile.name,
      });
      setMessage(`Analyse locale de ${candidateFile.name}. La liste de référence est fictive.`);
    } catch (cause) {
      setAnalysisError(true);
      setMessage(`Analyse impossible : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setAnalyzing(false); }
  };
  const validate = () => {
    const result = validateDocumentSqlScript(version);
    onChange({ sqlScriptStatus: result.valid ? 'Valide' : 'En erreur' });
    setMessage(result.message);
  };
  const copy = () => {
    if (!navigator.clipboard?.writeText) {
      setMessage('Le presse-papiers n’est pas disponible dans ce navigateur.');
      return;
    }
    void navigator.clipboard.writeText(version.sqlScript)
      .then(() => setMessage('Script copié dans le presse-papiers.'))
      .catch(cause => setMessage(`Copie impossible : ${cause instanceof Error ? cause.message : String(cause)}`));
  };
  return <section className="document-sql-workbench">
    <div className="document-sql-heading"><h4><Database size={16} />Balises et script SQL · {locale.toUpperCase()}</h4><span className={`sql-status ${version.sqlScriptStatus === 'Valide' ? 'success' : version.sqlScriptStatus === 'En erreur' ? 'failure' : ''}`}>{version.sqlScriptStatus}</span></div>
    <Notice warning>Le fichier sélectionné est analysé localement pour les balises au format {'{{BALISE}}'}. La liste de référence et les correspondances SQL sont fictives : aucune connexion à référentiel de démonstration ni exécution SQL.</Notice>
    {!!version.unmappedTags.length && <p className="form-error" role="alert">Balises absentes de la liste fictive référentiel de démonstration : {version.unmappedTags.join(', ')}. Vérifiez la référence réelle ; l’envoi simulé reste bloqué.</p>}
    <div className="tag-metrics">
      <div><strong>{metrics.total}</strong><span>balises détectées</span></div>
      <div><strong>{metrics.recognized}</strong><span>reconnues</span></div>
      <div className={metrics.unknown ? 'has-issue' : ''}><strong>{metrics.unknown}</strong><span>non reconnues</span></div>
      <div className={metrics.withoutSql ? 'has-issue' : ''}><strong>{metrics.withoutSql}</strong><span>sans correspondance SQL</span></div>
      <div className={metrics.duplicates.length ? 'has-issue' : ''}><strong>{metrics.duplicates.length}</strong><span>doublons</span></div>
    </div>
    {version.analyzedFileName && <small className="analysis-file">Analyse locale de : <strong>{version.analyzedFileName}</strong></small>}
    <div className="detected-tag-list">
      {!version.detectedTags.length && <small>Aucune balise analysée pour le moment.</small>}
      {version.detectedTags.map((tag, index) => {
        const mapping = mappings.get(tag);
        const state = !mapping ? 'Absente de la liste fictive' : mapping.sourceHint ? mapping.sourceHint : 'Reconnu, mais sans correspondance SQL';
        return <div key={`${tag}-${index}`}><code>{`{{${tag}}}`}</code><span>{state}</span>{metrics.duplicates.includes(tag) && <Badge>Doublon</Badge>}</div>;
      })}
    </div>
    <button type="button" className="btn small" disabled={!candidateFile || analyzing} onClick={() => void generate()}>
      <Database size={15} />{version.analyzedFileName ? 'Régénérer' : 'Analyser les balises et générer le script'}
    </button>
    {!candidateFile && <small>Sélectionnez à nouveau le fichier pour analyser son contenu ; il n’est pas conservé dans la maquette.</small>}
    <Field label={`Script SQL proposé · ${locale.toUpperCase()}`} hint="Éditeur local modifiable; le script n’est jamais exécuté.">
      <textarea className="sql-editor" aria-label={`Script SQL ${locale.toUpperCase()}`} spellCheck={false} value={version.sqlScript}
        onChange={event => {
          onChange({ sqlScript: event.target.value, sqlScriptStatus: event.target.value.trim() ? 'Brouillon' : 'À générer' });
          setMessage('');
        }} />
    </Field>
    <div className="document-sql-actions">
      <button type="button" className="btn small" disabled={!version.sqlScript.trim()} onClick={copy}><Copy size={14} />Copier le script</button>
      <button type="button" className="btn small" disabled={!version.sqlScript.trim()} onClick={validate}><Check size={14} />Valider le script</button>
    </div>
    {message && <p className={analysisError || version.sqlScriptStatus === 'En erreur' ? 'form-error' : 'inline-feedback'} role={analysisError ? 'alert' : 'status'}>{message}</p>}
  </section>;
}

function AzureReplacementConfirmation({ version, locale, fileName, nextVersion, documentId, supportMode, generated, onClose, onConfirm }: {
  version: DocumentVersion;
  locale: DocumentLocale;
  fileName: string;
  nextVersion: number;
  documentId: string;
  supportMode: boolean;
  generated: boolean;
  onClose: () => void;
  onConfirm: (outcome: 'success' | 'failure') => void;
}) {
  const [simulateFailure, setSimulateFailure] = useState(false);
  const metrics = tagMetrics(version);
  const container = version.azureContainer || 'diams-templates-demo';
  const blobPath = azureBlobPathFor(version.templateLogicalName, locale, fileName);
  return <Modal title="Confirmer l’envoi Azure simulé" subtitle="Aucune connexion ni transfert réel. La référence locale ne sera modifiée qu’après confirmation." wide onClose={onClose}>
    <div className="modal-body stack">
      <Notice warning>Simulation locale uniquement. Aucun secret Azure n’est utilisé et aucun fichier n’est envoyé.</Notice>
      {supportMode && <TechnicalInfo ids={[
        { label: 'ID document simulé', value: documentTemplateTechnicalId(documentId) },
        { label: `ID version document ${locale.toUpperCase()} simulé`, value: documentTemplateDescriptionTechnicalId(documentId, locale) },
      ]} tables={[...technicalMappings.documentTemplates.tables]} />}
      <div className="azure-confirmation-grid">
        <div><span>Langue</span><strong>{locale.toUpperCase()}</strong></div>
        <div><span>Nom logique du template</span><strong>{version.templateLogicalName || 'À définir'}</strong></div>
        <div><span>Ancien fichier / version</span><strong>{version.fileName || 'Aucun'} · v{version.version || 0}</strong></div>
        <div><span>Nouveau fichier / version</span><strong>{fileName} · v{nextVersion}</strong></div>
        <div><span>Conteneur Azure simulé</span><strong>{container}</strong></div>
        <div><span>Clé Blob cible simulée</span><code>{blobPath}</code></div>
        <div><span>Archivage de l’ancien fichier</span><strong>{version.fileName ? 'Oui après succès; non en cas d’échec' : 'Aucune ancienne version'}</strong></div>
        {generated && <><div><span>Script SQL</span><strong>{version.sqlScriptStatus}</strong></div>
          <div><span>Balises reconnues / non reconnues</span><strong>{metrics.recognized} / {metrics.unknown}</strong></div></>}
      </div>
      {generated && <details><summary>Relire le script associé</summary><pre className="sql-preview">{version.sqlScript}</pre></details>}
      <CheckField checked={simulateFailure} onChange={setSimulateFailure}>Pour la démonstration, simuler un échec avant activation (l’ancien fichier restera actif).</CheckField>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Annuler</button>
      <button type="button" className="btn primary" onClick={() => onConfirm(simulateFailure ? 'failure' : 'success')}><CloudUpload size={16} />Envoyer vers Azure et remplacer</button>
    </div>
  </Modal>;
}

function AzureResultPanel({ operation }: { operation: NonNullable<DocumentVersion['azureLastOperation']> }) {
  return <section className={`azure-result ${operation.result === 'Succès' ? 'success' : 'failure'}`} role="status">
    <strong>Dernière opération Azure simulée : {operation.result.toLowerCase()}</strong>
    <div><span>Langue / fichier</span><b>{operation.language.toUpperCase()} · {operation.attemptedFileName}</b></div>
    <div><span>Version tentée</span><b>v{operation.version}</b></div>
    <div><span>Conteneur / clé cible</span><b>{operation.container} / {operation.blobPath}</b></div>
    <div><span>Ancienne version archivée</span><b>{operation.archivedPrevious ? 'Oui' : 'Non'}</b></div>
    <div><span>Date / auteur simulés</span><b>{formatDate(operation.at)} · {operation.author}</b></div>
    <small>{operation.message}</small>
  </section>;
}

function TemplateReplacement({ document, supportMode, onClose, onLocalSave, onAzureSave }: {
  document: DocumentModel;
  supportMode: boolean;
  onClose: () => void;
  onLocalSave: (next: DocumentModel) => boolean;
  onAzureSave: (next: DocumentModel) => boolean;
}) {
  const [documentDraft, setDocumentDraft] = useState(document);
  const [locale, setLocale] = useState<DocumentLocale>('fr');
  const [pendingFiles, setPendingFiles] = useState<Record<DocumentLocale, File | null>>({ fr: null, en: null, ko: null });
  const [sourceNames, setSourceNames] = useState<Record<DocumentLocale, string>>({ fr: '', en: '', ko: '' });
  const attemptedFiles = useRef<Partial<Record<DocumentLocale, File>>>({});
  const [fileErrors, setFileErrors] = useState<Record<DocumentLocale, string>>({ fr: '', en: '', ko: '' });
  const [checkingLocale, setCheckingLocale] = useState<DocumentLocale | null>(null);
  const [message, setMessage] = useState('');
  const [azureConfirmation, setAzureConfirmation] = useState<{ locale: DocumentLocale; fileName: string; version: number } | null>(null);
  const currentVersion = documentDraft.versions[locale];
  const pendingFile = pendingFiles[locale];
  const nextVersion = pendingFile ? nextTemplateVersion(currentVersion, sourceNames[locale] || pendingFile.name) : 0;
  const generationMode = documentGenerationMode(documentDraft);
  const generated = generationMode !== 'none';
  const readinessError = pendingFile ? documentScriptReadinessError(currentVersion, pendingFile.name, generationMode) : 'Choisissez un nouveau fichier .docx.';
  const localSaveError = !currentVersion.templateLogicalName.trim() ? 'Renseignez le nom logique du template dans le document avant de remplacer le fichier.' : '';
  const languageLabel = documentLocales.find(item => item.code === locale)?.label || locale;
  const updateVersion = (target: DocumentLocale, change: Partial<DocumentVersion>) => setDocumentDraft(current => ({
    ...current,
    versions: { ...current.versions, [target]: { ...current.versions[target], ...change } },
  }));
  const choose = async (target: DocumentLocale, candidate?: File) => {
    if (!candidate) return;
    setCheckingLocale(target);
    setFileErrors(current => ({ ...current, [target]: '' }));
    const invalid = await docxFileError(candidate);
    setCheckingLocale(current => current === target ? null : current);
    if (invalid) { setFileErrors(current => ({ ...current, [target]: invalid })); return; }
    setSourceNames(current => ({ ...current, [target]: candidate.name }));
    setPendingFiles(current => ({ ...current, [target]: candidate }));
    setDocumentDraft(current => prepareGeneratedDocumentFile(current, target, candidate.name));
    setMessage('');
  };
  const saveLocally = () => {
    if (!pendingFile || localSaveError) return;
    const analysis = !generated || currentVersion.analyzedFileName === pendingFile.name ? versionAnalysis(currentVersion) : undefined;
    const next = replaceDocumentVersion(documentDraft, locale, pendingFile.name, nextVersion, true, new Date().toISOString(), analysis);
    if (onLocalSave(next)) {
      setDocumentDraft(next);
      setPendingFiles(current => ({ ...current, [locale]: null }));
    }
  };
  const simulateAzure = (outcome: 'success' | 'failure') => {
    if (!pendingFile) return;
    const next = simulateAzureReplacement(documentDraft, locale, pendingFile.name, nextVersion, new Date().toISOString(), outcome);
    if (onAzureSave(next)) {
      setDocumentDraft(next);
      if (outcome === 'success') setPendingFiles(current => ({ ...current, [locale]: null }));
      setAzureConfirmation(null);
    }
  };
  useEffect(() => {
    if (!generated || !pendingFile || checkingLocale === locale || readinessError || attemptedFiles.current[locale] === pendingFile) return;
    attemptedFiles.current[locale] = pendingFile;
    try {
      const next = simulateAzureReplacement(documentDraft, locale, pendingFile.name, nextVersion, new Date().toISOString());
      if (onAzureSave(next)) {
        setDocumentDraft(next);
        setPendingFiles(current => current[locale] === pendingFile ? { ...current, [locale]: null } : current);
        setMessage('Envoi Azure simulé automatiquement et enregistré dans la maquette.');
      } else setMessage('Envoi simulé non enregistré. Sélectionnez à nouveau le fichier pour réessayer.');
    } catch (cause) {
      setMessage(`Envoi simulé impossible : ${cause instanceof Error ? cause.message : String(cause)}. Sélectionnez à nouveau le fichier pour réessayer.`);
    }
  }, [checkingLocale, documentDraft, generated, locale, nextVersion, onAzureSave, pendingFile, readinessError]);

  return <Modal title="Remplacer une version linguistique" subtitle={`Document métier : ${documentName(document)}. Fichiers indépendants par langue.`} wide onClose={onClose}>
    <div className="modal-body stack">
      {compatibilityDocument(document) && <CompatibilityWarning />}
      <Notice warning>Parcours de maquette. L’enregistrement local conserve uniquement les métadonnées; l’envoi Azure est une simulation sans connexion ni transfert réel.</Notice>
      {supportMode && <TechnicalInfo ids={[
        { label: 'ID document simulé', value: documentTemplateTechnicalId(document.id) },
        { label: `ID version document ${locale.toUpperCase()} simulé`, value: documentTemplateDescriptionTechnicalId(document.id, locale) },
      ]} tables={[...technicalMappings.documentTemplates.tables]} />}
      <div className="document-language-tabs replacement-language-tabs" role="tablist" aria-label="Langue du fichier à remplacer">
        {documentLocales.map(item => <button key={item.code} type="button" role="tab" aria-selected={locale === item.code} className={locale === item.code ? 'selected' : ''} onClick={() => setLocale(item.code)}>
          <strong>{item.tag}</strong><span>{item.label}</span>
        </button>)}
      </div>
      <div className="template-current"><FileText size={25} /><div><small>FICHIER ACTUEL · {locale.toUpperCase()}</small><strong>{currentVersion.fileName || 'Aucun fichier associé'}</strong>
        <small>Template : {currentVersion.templateLogicalName || 'À définir'} · Version {currentVersion.version || 'non définie'} · {formatDate(currentVersion.lastUpdatedAt)}</small>
      </div></div>
      {generated && <Field label={`Nom logique du template ${locale.toUpperCase()}`} hint="Renseigné depuis le fichier s’il est vide ; modifiable avant l’enregistrement.">
        <input value={currentVersion.templateLogicalName} onChange={event => updateVersion(locale, { templateLogicalName: event.target.value })} />
      </Field>}
      <div className="metadata"><div><span>État Azure actuel</span><strong>{currentVersion.azureSyncStatus}</strong></div><div><span>Clé Blob active</span><code>{currentVersion.azureBlobPath || 'Non définie'}</code></div></div>
      <Field label={`Nouveau fichier .docx pour ${locale.toUpperCase()} · ${languageLabel}`} hint="10 Mo maximum. Le fichier ne quitte pas le navigateur.">
        <input key={locale} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={checkingLocale === locale}
          onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; void choose(locale, selected); }} />
      </Field>
      {checkingLocale === locale && <p role="status">Vérification locale du fichier…</p>}
      {fileErrors[locale] && <p className="form-error" role="alert">{fileErrors[locale]}</p>}
      {pendingFile && <div className="file-comparison"><div><small>NOUVEAU FICHIER · {locale.toUpperCase()}</small><strong>{pendingFile.name}</strong><span>{(pendingFile.size / 1024).toFixed(1)} Ko · version proposée {nextVersion}</span></div></div>}
      {generated && pendingFile && <TemplateNameProposal key={`${locale}:${pendingFile.name}:${currentVersion.templateLogicalName}`}
        file={pendingFile} logicalName={currentVersion.templateLogicalName} onRename={renamed => {
          setDocumentDraft(current => renameAnalyzedFile(current, locale, pendingFile.name, renamed.name));
          setPendingFiles(current => ({ ...current, [locale]: renamed }));
        }} />}
      {generated && <TagSqlEditor locale={locale} version={currentVersion} candidateFile={pendingFile}
        onChange={change => updateVersion(locale, change)} message={message} setMessage={setMessage} />}
      {!!currentVersion.archives.length && <details><summary>Versions {locale.toUpperCase()} archivées ({currentVersion.archives.length})</summary><ul>{currentVersion.archives.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></details>}
      {currentVersion.azureLastOperation && <AzureResultPanel operation={currentVersion.azureLastOperation} />}
      {pendingFile && <div className="document-upload-actions">
        <button type="button" className="btn" disabled={checkingLocale === locale || Boolean(localSaveError)} onClick={saveLocally}><Database size={16} />Enregistrer uniquement dans la maquette</button>
        {generated ? <small>L’envoi Azure est simulé automatiquement après validation du script et concordance des noms.</small> :
          <button type="button" className="btn primary" disabled={checkingLocale === locale || Boolean(readinessError)}
            onClick={() => setAzureConfirmation({ locale, fileName: pendingFile.name, version: nextVersion })}><CloudUpload size={16} />Envoyer vers Azure et remplacer</button>}
        {readinessError && <small className="field-hint">{readinessError}</small>}
      </div>}
      <div className="simulation-steps"><span>1. Valider le fichier</span><ArrowRight size={14} />{generated && <><span>2. Analyser et valider le script</span><ArrowRight size={14} /></>}<span>{generated ? '3' : '2'}. Simuler l’envoi</span></div>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Fermer</button></div>
    {azureConfirmation && <AzureReplacementConfirmation
      documentId={document.id}
      supportMode={supportMode}
      version={documentDraft.versions[azureConfirmation.locale]}
      generated={generated}
      locale={azureConfirmation.locale}
      fileName={azureConfirmation.fileName}
      nextVersion={azureConfirmation.version}
      onClose={() => setAzureConfirmation(null)}
      onConfirm={simulateAzure}
    />}
  </Modal>;
}

