import { createOrganizationExamples, createInitialData, createTaskSettings, createWorkbookMatrixData, createWorkbookTaskExamples } from './data.ts';
import { createCertificateExamples } from './specificSettingsConfig.ts';
import { createCertificationStatusExamples } from './certificationStatusExamples.ts';
import { createDocumentType } from './documentTypeData.ts';
import { fakeTechnicalId } from './supportConfig.ts';
import type { AzureOperationLog, Data, DocumentLocale, DocumentModel, DocumentType, DocumentVersion, Language, SpecificSettingKind, SpecificSettingRecord, Store } from './types';

type LegacyDocumentModel = {
  id: string;
  title: string;
  type: string;
  language: Language;
  active: boolean;
  mandatory: boolean;
  logicalName: string;
  fileName: string;
  version: number;
  updatedAt: string;
  archives: string[];
  taskIds: string[];
  query: string;
};
type LegacyDocumentVersion = {
  label: string;
  templateName: string;
  fileName: string;
  version: number;
  updatedAt: string;
  archives: string[];
};
type LegacyMultilingualDocument = {
  id: string;
  type: string;
  active: boolean;
  mandatory: boolean;
  taskIds: string[];
  query: string;
  versions: Record<DocumentLocale, LegacyDocumentVersion>;
};
type StoredDocument = DocumentModel | LegacyMultilingualDocument | LegacyDocumentModel;
type PersistedData = Omit<Data, 'documents' | 'specificSettings' | 'documentTypes'> & { documents: StoredDocument[]; specificSettings?: SpecificSettingRecord[]; documentTypes?: DocumentType[] };
type PersistedStore = Omit<Store, 'data' | 'undo'> & {
  data: PersistedData;
  undo: { data: PersistedData; logId: string } | null;
};

export const storageKey = 'diams-tools-external-demo-v1';
export const createStore = (): Store => ({
  version: 1, certificateExamplesInitialized: true, certificateAuditTypesInitialized: true, organizationCertificationExamplesInitialized: true, demoOrganizationInitialized: true, demoClientNameCorrected: true, workbookTaskExamplesInitialized: true, workbookMatrixExamplesInitialized: true, certificationStatusWorkbookInitialized: true,
  data: createInitialData(), history: [], undo: null,
});
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const fields = (v: Record<string, unknown>, names: string[], type: 'string' | 'boolean' | 'number') =>
  names.every(name => typeof v[name] === type && (type !== 'number' || Number.isFinite(v[name])));
const labels = (v: unknown) => record(v) && fields(v, ['fr', 'en', 'ko'], 'string');
const validDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const locales: DocumentLocale[] = ['fr', 'en', 'ko'];
const sqlStatuses = ['À générer', 'Brouillon', 'Valide', 'En erreur'];
const azureStatuses = ['Non synchronisé', 'Synchronisé', 'Échec'];
const specificSettingKinds: SpecificSettingKind[] = [
  'toolBox', 'notice', 'skillProfile', 'auditPlanningWeft', 'certificateWeft', 'nonConformityDocument',
  'notificationLetter', 'specificDocumentTemplate', 'certificationStatus', 'equipmentSupplier', 'checklist', 'workload',
];
const isAzureOperation = (v: unknown): v is AzureOperationLog => record(v) &&
  fields(v, ['attemptedFileName', 'container', 'blobPath', 'previousFileName', 'author', 'message'], 'string') &&
  fields(v, ['version', 'previousVersion'], 'number') && fields(v, ['archivedPrevious'], 'boolean') &&
  ['fr', 'en', 'ko'].includes(String(v.language)) && ['Succès', 'Échec'].includes(String(v.result)) && validDate(v.at);
const isDocumentVersion = (v: unknown, locale?: DocumentLocale) => record(v) &&
  fields(v, ['language', 'label', 'templateLogicalName', 'fileName', 'sqlScript', 'analyzedFileName', 'azureContainer', 'azureBlobPath'], 'string') &&
  (v.description === undefined || typeof v.description === 'string') && (v.active === undefined || typeof v.active === 'boolean') &&
  fields(v, ['version'], 'number') && strings(v.archives) && strings(v.detectedTags) && strings(v.unmappedTags) &&
  sqlStatuses.includes(String(v.sqlScriptStatus)) && azureStatuses.includes(String(v.azureSyncStatus)) &&
  (!locale || v.language === locale) && validDate(v.lastUpdatedAt) &&
  (v.azureLastOperation === null || isAzureOperation(v.azureLastOperation));
const isLegacyVersion = (v: unknown) => record(v) &&
  fields(v, ['label', 'templateName', 'fileName'], 'string') && fields(v, ['version'], 'number') &&
  validDate(v.updatedAt) && strings(v.archives);
const isStoredDocument = (v: Record<string, unknown>) => {
  const versions = v.versions;
  if (!fields(v, ['type'], 'string') || !fields(v, ['active', 'mandatory'], 'boolean') || !strings(v.taskIds)) return false;
  if (['workDocument', 'visibleInExpertiseAndVeto', 'implementationEvidence', 'implementationVerification'].some(key => v[key] !== undefined && typeof v[key] !== 'boolean') ||
    (v.originDocumentId !== undefined && typeof v.originDocumentId !== 'string') ||
    (v.generationMode !== undefined && !['none', 'before', 'after'].includes(String(v.generationMode)))) return false;
  if (record(versions)) {
    if (locales.every(locale => isDocumentVersion(versions[locale], locale))) return true;
    return fields(v, ['query'], 'string') && locales.every(locale => isLegacyVersion(versions[locale]));
  }
  return fields(v, ['title', 'type', 'language', 'logicalName', 'fileName', 'query'], 'string') &&
    ['Français', 'Anglais', 'Coréen'].includes(String(v.language)) &&
    fields(v, ['active', 'mandatory'], 'boolean') && fields(v, ['version'], 'number') &&
    validDate(v.updatedAt) && strings(v.archives) && strings(v.taskIds);
};
const collection = (v: unknown, check: (entry: Record<string, unknown>) => boolean) => Array.isArray(v) &&
  v.every(entry => record(entry) && typeof entry.id === 'string' && check(entry)) &&
  new Set(v.map(entry => entry.id)).size === v.length;
const settingTranslations = (v: unknown) => record(v) && locales.every(locale =>
  record(v[locale]) && fields(v[locale], ['title', 'description', 'fileName'], 'string') &&
  fields(v[locale], ['active'], 'boolean'));

function isData(v: unknown): v is PersistedData {
  return record(v) &&
    collection(v.tasks, t => fields(t, ['name', 'type', 'scope', 'role', 'referenceTaskId'], 'string') &&
      fields(t, ['active'], 'boolean') && fields(t, ['offset'], 'number') && labels(t.labels) &&
      (t.descriptions === undefined || labels(t.descriptions)) &&
      (t.languageActive === undefined || (record(t.languageActive) && fields(t.languageActive, ['fr', 'en', 'ko'], 'boolean'))) &&
      ['canCompleteBeforeContractValidation', 'mustCompleteBeforeNextTask', 'canCompleteBeforeAuditDateConfirmation', 'isReferenceTask']
        .every(key => t[key] === undefined || typeof t[key] === 'boolean') &&
      ['Début d’audit', 'Fin d’audit', 'Date du cycle', 'Décision POV', 'Autre tâche'].includes(String(t.reference))) &&
    collection(v.matrices, m => fields(m, ['family', 'name', 'auditTypeId', 'standardType', 'certificationType'], 'string') &&
      fields(m, ['special', 'active', 'deleted'], 'boolean') && labels(m.labels) &&
      (m.descriptions === undefined || labels(m.descriptions)) &&
      strings(m.taskIds) && ['Audit Cycle', 'Audit Process'].includes(String(m.kind))) &&
    collection(v.audits, a => fields(a, ['name', 'matrixId'], 'string') && strings(a.taskIds) && ['En cours', 'Planifié', 'Terminé'].includes(String(a.status))) &&
    collection(v.documents, isStoredDocument) &&
    (v.documentTypes === undefined || collection(v.documentTypes, item =>
      fields(item, ['name'], 'string') &&
      fields(item, ['active', 'required', 'companySpace', 'siteLinked', 'visibleCorrespondents', 'visibleExternalAuditors', 'visibleStaff'], 'boolean') &&
      labels(item.labels) && labels(item.descriptions) && record(item.languageActive) &&
      fields(item.languageActive, ['fr', 'en', 'ko'], 'boolean'))) &&
    collection(v.reports, r => fields(r, ['standardType', 'standard', 'auditType', 'language', 'template'], 'string') &&
      fields(r, ['active'], 'boolean') && (r.groupId === undefined || typeof r.groupId === 'string')) &&
    collection(v.entities, e => fields(e, ['name', 'parentId'], 'string') && ['site', 'enterprise', 'client', 'auditType', 'certification', 'scheme'].includes(String(e.kind)) &&
      (e.details === undefined || (Array.isArray(e.details) && e.details.every(detail => record(detail) && fields(detail, ['label', 'value'], 'string'))))) &&
    (v.specificSettings === undefined || collection(v.specificSettings, setting =>
      fields(setting, ['kind', 'name'], 'string') && fields(setting, ['active'], 'boolean') &&
      specificSettingKinds.includes(String(setting.kind) as SpecificSettingKind) && record(setting.values) &&
      Object.values(setting.values).every(value => typeof value === 'string') &&
      (setting.translations === undefined || settingTranslations(setting.translations)) &&
      (setting.permissions === undefined || collection(setting.permissions, permission =>
        fields(permission, ['userType'], 'string') && fields(permission, ['active', 'download'], 'boolean'))) &&
      (setting.checklistSections === undefined || collection(setting.checklistSections, section => settingTranslations(section.translations))) &&
      (setting.textTranslations === undefined || (record(setting.textTranslations) &&
        Object.values(setting.textTranslations).every(value => record(value) && fields(value, ['en', 'ko'], 'string')))) &&
      (setting.reportScope === undefined || (record(setting.reportScope) &&
        typeof setting.reportScope.standardType === 'string' &&
        strings(setting.reportScope.standards) && strings(setting.reportScope.auditTypes)))));
}
function isStore(v: unknown): v is PersistedStore {
  return record(v) && v.version === 1 && isData(v.data) &&
    (v.certificateExamplesInitialized === undefined || typeof v.certificateExamplesInitialized === 'boolean') &&
    (v.certificateAuditTypesInitialized === undefined || typeof v.certificateAuditTypesInitialized === 'boolean') &&
    (v.organizationCertificationExamplesInitialized === undefined || typeof v.organizationCertificationExamplesInitialized === 'boolean') &&
    (v.demoOrganizationInitialized === undefined || typeof v.demoOrganizationInitialized === 'boolean') &&
    (v.demoClientNameCorrected === undefined || typeof v.demoClientNameCorrected === 'boolean') &&
    (v.workbookTaskExamplesInitialized === undefined || typeof v.workbookTaskExamplesInitialized === 'boolean') &&
    (v.workbookMatrixExamplesInitialized === undefined || typeof v.workbookMatrixExamplesInitialized === 'boolean') &&
    (v.certificationStatusWorkbookInitialized === undefined || typeof v.certificationStatusWorkbookInitialized === 'boolean') &&
    collection(v.history, log => fields(log, ['author', 'title', 'scope'], 'string') && validDate(log.at) && (log.undone === undefined || typeof log.undone === 'boolean')) &&
    (v.undo === null || (record(v.undo) && isData(v.undo.data) && typeof v.undo.logId === 'string'));
}

const localeByLanguage: Record<Language, DocumentLocale> = { Français: 'fr', Anglais: 'en', Coréen: 'ko' };
const migrationScriptNote = (query: string) => {
  const safeQuery = query.replace(/[\r\n]+/g, ' ').replace(/--/g, '-').trim();
  return safeQuery
    ? `-- Ancienne association commune conservée à titre informatif : ${safeQuery}\n-- À remplacer par un script SQL propre à cette langue.`
    : '';
};
function migratedVersion(locale: DocumentLocale, old: LegacyDocumentVersion, templateLogicalName: string, query: string): DocumentVersion {
  return {
    language: locale,
    label: old.label,
    templateLogicalName,
    fileName: old.fileName,
    version: old.version,
    archives: [...old.archives],
    detectedTags: [],
    unmappedTags: [],
    sqlScript: migrationScriptNote(query),
    sqlScriptStatus: 'À générer',
    analyzedFileName: '',
    azureContainer: 'diams-templates-demo',
    azureBlobPath: '',
    azureSyncStatus: 'Non synchronisé',
    lastUpdatedAt: old.updatedAt,
    azureLastOperation: null,
  };
}
function migrateDocument(document: StoredDocument): DocumentModel {
  if ('versions' in document && !('query' in document)) return document;
  if ('versions' in document) {
    return {
      id: document.id,
      type: document.type,
      active: document.active,
      mandatory: document.mandatory,
      taskIds: [...document.taskIds],
      versions: {
        fr: migratedVersion('fr', document.versions.fr, document.versions.fr.templateName, document.query),
        en: migratedVersion('en', document.versions.en, document.versions.en.templateName, document.query),
        ko: migratedVersion('ko', document.versions.ko, document.versions.ko.templateName, document.query),
      },
    };
  }
  const selectedLocale = localeByLanguage[document.language];
  const base = document.logicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || document.id;
  const version = (locale: DocumentLocale): DocumentVersion => migratedVersion(locale, {
    label: locale === selectedLocale ? document.title : '',
    templateName: `${base}-${locale}`,
    fileName: locale === selectedLocale ? document.fileName : '',
    version: locale === selectedLocale ? document.version : 0,
    updatedAt: document.updatedAt,
    archives: locale === selectedLocale ? [...document.archives] : [],
  }, `${base}-${locale}`, document.query);
  return {
    id: document.id,
    type: document.type,
    active: document.active,
    mandatory: document.mandatory,
    taskIds: [...document.taskIds],
    versions: { fr: version('fr'), en: version('en'), ko: version('ko') },
  };
}
function migrateData(data: PersistedData, seed: Data): Data {
  const documentTypes = data.documentTypes ?? [...seed.documentTypes];
  if (data.documentTypes === undefined) {
    for (const document of data.documents) {
      if (!documentTypes.some(item => item.name === document.type)) {
        documentTypes.push(createDocumentType(`legacy-${fakeTechnicalId('document-type-legacy', document.type)}`, document.type));
      }
    }
  }
  return {
    ...data,
    tasks: data.tasks.map(task => ({
      ...createTaskSettings(),
      ...task,
      scope: task.scope === 'Audit' ? 'Type d’audit' : task.scope === 'Processus' ? 'Process' : task.scope,
    })),
    documents: data.documents.map(migrateDocument),
    documentTypes,
    specificSettings: data.specificSettings || seed.specificSettings,
  };
}

const demoProcessExampleIds = new Set(['m13', 'm14']);
const demoReportExampleIds = new Set(['demo-sm-surveillance-1', 'demo-sm-surveillance-2', 'demo-sm-surveillance-3', 'demo-auto-iatf-initial']);
function mergeDemoExamples(data: Data, seed: Data): Data {
  let merged = data;
  if (data.entities.some(entity => entity.id === 'at3')) {
    const matrices = seed.matrices.filter(matrix => demoProcessExampleIds.has(matrix.id) &&
      !data.matrices.some(existing => existing.id === matrix.id));
    if (matrices.length) {
      const matrixIds = new Set(matrices.map(matrix => matrix.id));
      const auditIds = new Set(data.audits.map(audit => audit.id));
      const audits = seed.audits.filter(audit => matrixIds.has(audit.matrixId) && !auditIds.has(audit.id));
      merged = { ...merged, matrices: [...data.matrices, ...matrices], audits: [...data.audits, ...audits] };
    }
  }
  const reports = seed.reports.filter(report => demoReportExampleIds.has(report.id) &&
    !merged.reports.some(existing => existing.id === report.id));
  return reports.length ? { ...merged, reports: [...merged.reports, ...reports] } : merged;
}

function mergeCertificateExamples(data: Data): Data {
  const existingIds = new Set(data.specificSettings.map(item => item.id));
  const examples = createCertificateExamples().filter(item => !existingIds.has(item.id));
  return { ...data, specificSettings: [...data.specificSettings, ...examples] };
}

function initializeCertificateAuditTypes(data: Data, seed: Data): Data {
  const examples = new Map(seed.specificSettings.filter(item => item.kind === 'certificateWeft' && item.id.startsWith('demo-certificate-')).map(item => [item.id, item]));
  return {
    ...data,
    specificSettings: data.specificSettings.map(item => {
      const scope = item.reportScope;
      const exampleScope = examples.get(item.id)?.reportScope;
      if (!scope || !exampleScope || scope.auditTypes.length || !exampleScope.auditTypes.length ||
        scope.standardType !== exampleScope.standardType || scope.standards.length !== 1 ||
        scope.standards[0] !== exampleScope.standards[0]) return item;
      return { ...item, reportScope: { ...scope, auditTypes: [...exampleScope.auditTypes] } };
    }),
  };
}

function initializeOrganizationCertificationExamples(data: Data, seed: Data): Data {
  const enterprise = data.entities.find(entity => entity.id === 'e1' && entity.kind === 'enterprise' && entity.name === 'Entreprise A');
  const exampleNames: Record<string, string> = { sc1: 'Schéma Automobile', sc2: 'Schéma Système de management' };
  const entities = data.entities.map(entity => enterprise && entity.kind === 'scheme' && !entity.parentId &&
    exampleNames[entity.id] === entity.name ? { ...entity, parentId: enterprise.id } : entity);
  const secondEnterprise = entities.find(entity => entity.id === 'e2' && entity.kind === 'enterprise' && entity.name === 'Entreprise B');
  const exampleIds = ['sc3', 'c4', 'at7'];
  const examples = secondEnterprise && exampleIds.every(id => !entities.some(entity => entity.id === id))
    ? seed.entities.filter(entity => exampleIds.includes(entity.id)) : [];
  return { ...data, entities: [...entities, ...examples] };
}

function initializeDemoOrganization(data: Data): Data {
  const examples = createOrganizationExamples();
  const collision = examples.find(example => data.entities.some(entity => entity.id === example.id));
  if (collision) throw new Error(`L’identifiant d’exemple « ${collision.id} » existe déjà ; les données existantes n’ont pas été modifiées.`);
  return { ...data, entities: [...data.entities, ...examples] };
}

export function loadStore(): { store: Store | null; error: string | null } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { store: createStore(), error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) throw new Error('Le format des données locales est invalide ou incompatible.');
    const seed = createInitialData();
    const migrate = (previous: PersistedData) => {
      const data = mergeDemoExamples(migrateData(previous, seed), seed);
      const withCertificates = parsed.certificateExamplesInitialized ? data : mergeCertificateExamples(data);
      const withAuditTypes = parsed.certificateAuditTypesInitialized ? withCertificates : initializeCertificateAuditTypes(withCertificates, seed);
      const withOrganization = parsed.organizationCertificationExamplesInitialized ? withAuditTypes : initializeOrganizationCertificationExamples(withAuditTypes, seed);
      const withDemoOrganization = parsed.demoOrganizationInitialized ? withOrganization : initializeDemoOrganization(withOrganization);
      const withCorrectedClient = parsed.demoClientNameCorrected ? withDemoOrganization : {
        ...withDemoOrganization,
        entities: withDemoOrganization.entities.map(entity => entity.id === 'demo-organization-client' && entity.kind === 'client' && entity.name === 'Ancien client Démo'
          ? { ...entity, name: 'Groupe Démo' } : entity),
      };
      const taskExamples = parsed.workbookTaskExamplesInitialized ? [] : createWorkbookTaskExamples().filter(task =>
        !withCorrectedClient.tasks.some(existing => existing.id === task.id));
      const withTasks = { ...withCorrectedClient, tasks: [...withCorrectedClient.tasks, ...taskExamples] };
      let withMatrices = withTasks;
      if (!parsed.workbookMatrixExamplesInitialized) {
        const examples = createWorkbookMatrixData();
        const collision = examples.tasks.find(task => withTasks.tasks.some(existing => existing.id === task.id))?.id ||
          examples.matrices.find(matrix => withTasks.matrices.some(existing => existing.id === matrix.id))?.id ||
          withTasks.entities.find(entity => entity.id === examples.auditType.id)?.id;
        if (collision) throw new Error(`L’identifiant d’exemple « ${collision} » existe déjà ; les données existantes n’ont pas été modifiées.`);
        withMatrices = { ...withTasks, tasks: [...withTasks.tasks, ...examples.tasks], matrices: [...withTasks.matrices, ...examples.matrices], entities: [...withTasks.entities, examples.auditType] };
      }
      if (parsed.certificationStatusWorkbookInitialized || previous.specificSettings === undefined) return withMatrices;
      const statusExamples = createCertificationStatusExamples();
      const collision = statusExamples.find(example => withMatrices.specificSettings.some(existing => existing.id === example.id));
      if (collision) throw new Error(`L’identifiant d’exemple « ${collision.id} » existe déjà ; les données existantes n’ont pas été modifiées.`);
      return { ...withMatrices, specificSettings: [...withMatrices.specificSettings, ...statusExamples] };
    };
    const data = migrate(parsed.data);
    let undo: Store['undo'] = null;
    if (parsed.undo) {
      undo = { ...parsed.undo, data: migrate(parsed.undo.data) };
    }
    return {
      store: { version: 1, certificateExamplesInitialized: true, certificateAuditTypesInitialized: true, organizationCertificationExamplesInitialized: true, demoOrganizationInitialized: true, demoClientNameCorrected: true, workbookTaskExamplesInitialized: true, workbookMatrixExamplesInitialized: true, certificationStatusWorkbookInitialized: true, data, history: parsed.history, undo },
      error: null,
    };
  } catch (cause) {
    return { store: null, error: `Impossible de charger la maquette : ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}

export function persistStore(store: Store) {
  localStorage.setItem(storageKey, JSON.stringify(store));
}
