import { demoTagQueryMappings, demoTemplateTagFixtures } from './data.ts';
import type { AzureOperationLog, Data, DocumentLocale, DocumentModel, DocumentType, DocumentVersion, Entity, EntityKind, Labels, Language, Matrix, ReportRule, ReportScope, Task } from './types.ts';

export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]/gu, '');
export const isSystemCompatibilityDocument = (...values: string[]) => values.some(value => normalize(value).includes('pourcompatibilitesysteme'));
export const matches = (query: string, ...values: string[]) => values.some(value => normalize(value).includes(normalize(query)));
export const matchesFilter = (value: string, selected: readonly string[]) => !selected.length || selected.includes(value);
export const alphabetic = <T>(items: T[], name: (item: T) => string): T[] => [...items].sort((a, b) => name(a).localeCompare(name(b), 'fr'));
export const compareFrenchTaskNames = (left: string, right: string) =>
  left.trim().localeCompare(right.trim(), 'fr', { sensitivity: 'accent' });
export const sortTasksByFrenchName = <T>(items: T[], name: (item: T) => string): T[] =>
  [...items].sort((left, right) => compareFrenchTaskNames(name(left), name(right)));
export function translationSuggestions(french: string, knownLabels: Labels[]) {
  const known = knownLabels.find(labels => normalize(labels.fr) === normalize(french));
  return {
    en: known?.en || `[EN · à traduire] ${french}`,
    ko: known?.ko || `[KO · 번역 필요] ${french}`,
  };
}
export function completeMissingTranslations(french: string, existing: { en: string; ko: string }, knownLabels: Labels[]) {
  if (!french.trim()) return { en: existing.en, ko: existing.ko };
  const known = knownLabels.filter(labels => normalize(labels.fr) === normalize(french));
  const find = (locale: 'en' | 'ko') => known.map(labels => labels[locale]).find(value =>
    value.trim() && !/^\[(?:EN · à traduire|KO · 번역 필요)\]/.test(value.trim()));
  return {
    en: existing.en.trim() ? existing.en : find('en') || `[EN · à traduire] ${french}`,
    ko: existing.ko.trim() ? existing.ko : find('ko') || `[KO · 번역 필요] ${french}`,
  };
}
export function knownTextTranslations(data: Data): Labels[] {
  const versions = (translations: NonNullable<Data['specificSettings'][number]['translations']>, field: 'title' | 'description'): Labels => ({
    fr: translations.fr[field], en: translations.en[field], ko: translations.ko[field],
  });
  return [
    ...data.tasks.flatMap(item => [item.labels, ...(item.descriptions ? [item.descriptions] : [])]),
    ...data.matrices.flatMap(item => [item.labels, ...(item.descriptions ? [item.descriptions] : [])]),
    ...data.documents.flatMap(item => [
      { fr: item.versions.fr.label, en: item.versions.en.label, ko: item.versions.ko.label },
      { fr: item.versions.fr.description || '', en: item.versions.en.description || '', ko: item.versions.ko.description || '' },
    ]),
    ...data.documentTypes.flatMap(item => [item.labels, item.descriptions]),
    ...data.specificSettings.flatMap(item => [
      ...(item.translations ? [versions(item.translations, 'title'), versions(item.translations, 'description')] : []),
      ...(item.checklistSections ?? []).map(section => versions(section.translations, 'title')),
      ...Object.entries(item.textTranslations ?? {}).map(([key, value]) => ({
        fr: key === 'name' ? item.name : item.values[key] || '', ...value,
      })),
    ]),
  ];
}
export function saveDocumentType(data: Data, draft: DocumentType): Data {
  const name = draft.labels.fr.trim();
  if (!name) throw new Error('Renseignez le titre français du type de document.');
  const previous = data.documentTypes.find(item => item.id === draft.id);
  if ((!previous || previous.name !== name) && data.documentTypes.some(item => item.id !== draft.id && normalize(item.name) === normalize(name)))
    throw new Error('Un type de document porte déjà ce titre.');
  const saved = { ...draft, name, labels: { ...draft.labels, fr: name } };
  return {
    ...data,
    documentTypes: previous ? data.documentTypes.map(item => item.id === draft.id ? saved : item) : [...data.documentTypes, saved],
    documents: previous && previous.name !== name
      ? data.documents.map(item => item.type === previous.name ? { ...item, type: name } : item)
      : data.documents,
  };
}
export function deleteDocumentType(data: Data, id: string): Data {
  const item = data.documentTypes.find(type => type.id === id);
  if (!item) throw new Error('Ce type de document n’existe plus.');
  if (data.documents.some(document => document.type === item.name))
    throw new Error('Ce type est utilisé par des documents : réaffectez-les avant de le supprimer.');
  return { ...data, documentTypes: data.documentTypes.filter(type => type.id !== id) };
}
export function modelTranslationSuggestions(model: Pick<Task | Matrix, 'name' | 'descriptions'>, data: Pick<Data, 'tasks' | 'matrices'>) {
  const name = model.name.trim();
  if (!name) throw new Error('Renseignez le nom du modèle avant de proposer des traductions.');
  const knownNames = [
    ...data.tasks.map(t => ({ ...t.labels, fr: t.name })),
    ...data.matrices.map(m => ({ ...m.labels, fr: m.name })),
  ];
  const description = model.descriptions?.fr.trim();
  return {
    labels: translationSuggestions(name, knownNames),
    descriptions: description ? translationSuggestions(description, [
      ...[...data.tasks, ...data.matrices].flatMap(item => item.descriptions ? [item.descriptions] : []),
      ...knownNames,
    ]) : undefined,
  };
}
export interface DocumentTagAnalysis {
  detectedTags: string[];
  recognizedTags: string[];
  unmappedTags: string[];
  tagsWithoutSql: string[];
  duplicateTags: string[];
}

export function tagAnalysisForTags(detectedTags: string[]): DocumentTagAnalysis {
  const uniqueTags = [...new Set(detectedTags)];
  const mappings = new Map(demoTagQueryMappings.map(mapping => [mapping.tag, mapping]));
  return {
    detectedTags: [...detectedTags],
    recognizedTags: uniqueTags.filter(tag => mappings.has(tag)),
    unmappedTags: uniqueTags.filter(tag => !mappings.has(tag)),
    tagsWithoutSql: uniqueTags.filter(tag => mappings.has(tag) && !mappings.get(tag)?.sourceHint),
    duplicateTags: uniqueTags.filter(tag => detectedTags.filter(detected => detected === tag).length > 1),
  };
}

export function analyzeDemoDocumentTags(locale: DocumentLocale, fileName: string): DocumentTagAnalysis {
  if (!fileName.trim()) throw new Error('Choisissez un fichier .docx avant d’analyser ses balises.');
  return tagAnalysisForTags(demoTemplateTagFixtures[locale]);
}

export function generateDemoSqlScript(tags: string[], locale: DocumentLocale): string {
  const mappings = new Map(demoTagQueryMappings.map(mapping => [mapping.tag, mapping]));
  const mappedTags = [...new Set(tags)].filter(tag => mappings.get(tag)?.sourceHint);
  return [
    `-- Proposition illustrative pour ${locale.toUpperCase()}; aucun SQL réel ne sera exécuté.`,
    '-- Le référentiel et les expressions sources sont fictifs.',
    ...(mappedTags.length
      ? ['SELECT', ...mappedTags.map((tag, index) => `  CAST(N'[Valeur simulée: ${tag}]' AS nvarchar(max)) AS [${tag}]${index < mappedTags.length - 1 ? ',' : ''}`), ';']
      : ['-- Aucune balise ne possède de correspondance SQL fictive.', "SELECT CAST(N'[Valeur simulée]' AS nvarchar(max)) AS [DEMO_VALUE];"]),
  ].join('\n');
}

export function validateDocumentSqlScript(version: DocumentVersion): { valid: boolean; message: string } {
  if (!version.sqlScript.trim()) return { valid: false, message: 'Générez ou saisissez un script avant de le valider.' };
  if (!version.analyzedFileName || !version.detectedTags.length) return { valid: false, message: 'Analysez d’abord les balises du fichier sélectionné.' };
  const analysis = tagAnalysisForTags(version.detectedTags);
  if (analysis.unmappedTags.length) return { valid: false, message: `Balises sans correspondance dans référentiel de démonstration : ${analysis.unmappedTags.join(', ')}.` };
  if (analysis.tagsWithoutSql.length) return { valid: false, message: `Correspondance SQL absente pour : ${analysis.tagsWithoutSql.join(', ')}.` };
  if (!/\bselect\b/i.test(version.sqlScript)) return { valid: false, message: 'Le script doit contenir une instruction SELECT.' };
  const missingOutputs = analysis.recognizedTags.filter(tag => !analysis.tagsWithoutSql.includes(tag) && !version.sqlScript.includes(`[${tag}]`));
  if (missingOutputs.length) return { valid: false, message: `Balises absentes des résultats du script : ${missingOutputs.join(', ')}.` };
  return { valid: true, message: 'Script validé pour cette langue (contrôle local illustratif, sans exécution).' };
}

export function documentGenerationMode(document: Pick<DocumentModel, 'mandatory' | 'workDocument' | 'generationMode'>): NonNullable<DocumentModel['generationMode']> {
  return document.mandatory || document.workDocument ? 'none' : document.generationMode ?? 'before';
}

export function prepareGeneratedDocumentFile(document: DocumentModel, locale: DocumentLocale, fileName: string): DocumentModel {
  if (documentGenerationMode(document) === 'none') return document;
  const version = document.versions[locale];
  return {
    ...document,
    versions: {
      ...document.versions,
      [locale]: {
        ...version,
        templateLogicalName: version.templateLogicalName.trim() ? version.templateLogicalName : fileName,
        detectedTags: [], unmappedTags: [], sqlScript: '', sqlScriptStatus: 'À générer', analyzedFileName: '',
      },
    },
  };
}

export function templateFileNameForLogicalName(logicalName: string): string | null {
  if (!logicalName.trim() || /[/\\\x00-\x1f]/.test(logicalName)) return null;
  return /\.docx$/i.test(logicalName) ? logicalName : `${logicalName}.docx`;
}

export function documentScriptReadinessError(version: DocumentVersion, fileName: string, generationMode: NonNullable<DocumentModel['generationMode']> = 'before'): string | null {
  if (!version.templateLogicalName.trim()) return 'Renseignez le nom logique du template.';
  if (!fileName.trim()) return 'Choisissez un fichier .docx.';
  if (generationMode === 'none') return null;
  if (version.analyzedFileName !== fileName) return 'Analysez les balises du nouveau fichier et validez son script.';
  if (version.sqlScriptStatus !== 'Valide') return 'Le script SQL de cette langue doit être validé avant l’envoi simulé.';
  const validation = validateDocumentSqlScript(version);
  if (!validation.valid) return validation.message;
  const expected = templateFileNameForLogicalName(version.templateLogicalName);
  if (!expected) return 'Le nom logique ne peut pas servir de nom de fichier : retirez les séparateurs ou caractères de contrôle.';
  if (fileName !== expected) return `L’envoi est bloqué : le fichier doit être nommé « ${expected} ».`;
  return null;
}

export function azureBlobPathFor(templateLogicalName: string, locale: DocumentLocale, fileName: string): string {
  const base = templateLogicalName.replace(/-(fr|en|ko)$/i, '');
  return `${base}/${locale}/${fileName}`;
}

type VersionAnalysis = Pick<DocumentVersion, 'detectedTags' | 'unmappedTags' | 'sqlScript' | 'sqlScriptStatus' | 'analyzedFileName'>;

export function replaceDocumentVersion(
  document: DocumentModel,
  locale: DocumentLocale,
  fileName: string,
  version: number,
  archive: boolean,
  updatedAt: string,
  analysis?: VersionAnalysis,
): DocumentModel {
  const current = document.versions[locale];
  if (!fileName.trim() || !Number.isInteger(version) || version <= current.version || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('Les informations du remplacement de template sont invalides.');
  }
  return {
    ...document,
    versions: {
      ...document.versions,
      [locale]: {
        ...current,
        fileName,
        version,
        detectedTags: analysis?.detectedTags ?? [],
        unmappedTags: analysis?.unmappedTags ?? [],
        sqlScript: analysis?.sqlScript ?? '',
        sqlScriptStatus: analysis?.sqlScriptStatus ?? 'À générer',
        analyzedFileName: analysis?.analyzedFileName ?? '',
        lastUpdatedAt: updatedAt,
        azureSyncStatus: 'Non synchronisé',
        archives: archive && current.fileName ? [...current.archives, current.fileName] : current.archives,
      },
    },
  };
}

export function simulateAzureReplacement(
  document: DocumentModel,
  locale: DocumentLocale,
  fileName: string,
  version: number,
  updatedAt: string,
  outcome: 'success' | 'failure' = 'success',
): DocumentModel {
  const current = document.versions[locale];
  if (!fileName.trim() || !Number.isInteger(version) || version <= current.version || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('Les informations du remplacement simulé sont invalides.');
  }
  const readinessError = documentScriptReadinessError(current, fileName, documentGenerationMode(document));
  if (readinessError) throw new Error(readinessError);
  const container = current.azureContainer || 'diams-templates-demo';
  const blobPath = azureBlobPathFor(current.templateLogicalName, locale, fileName);
  const operation: AzureOperationLog = {
    result: outcome === 'success' ? 'Succès' : 'Échec',
    language: locale,
    attemptedFileName: fileName,
    version,
    container,
    blobPath,
    previousFileName: current.fileName,
    previousVersion: current.version,
    archivedPrevious: outcome === 'success' && Boolean(current.fileName),
    at: updatedAt,
    author: 'Démo',
    message: outcome === 'success'
      ? 'Dépôt Azure simulé réussi; l’ancienne version a été archivée.'
      : 'Échec simulé avant activation; l’ancien template reste actif.',
  };
  const nextVersion: DocumentVersion = outcome === 'success'
    ? {
      ...current,
      fileName,
      version,
      archives: current.fileName ? [...current.archives, current.fileName] : current.archives,
      azureContainer: container,
      azureBlobPath: blobPath,
      azureSyncStatus: 'Synchronisé',
      lastUpdatedAt: updatedAt,
      azureLastOperation: operation,
    }
    : { ...current, azureContainer: container, azureSyncStatus: 'Échec', azureLastOperation: operation };
  return {
    ...document,
    versions: { ...document.versions, [locale]: nextVersion },
  };
}
export const matrixStandardLabel = (value: string) => value === 'SM' ? 'Système de management' : value;
export function matrixKindsForAudit(matrices: Matrix[], auditTypeId: string): Matrix['kind'][] {
  return (['Audit Cycle', 'Audit Process'] as const)
    .filter(kind => matrices.some(matrix => !matrix.deleted && matrix.auditTypeId === auditTypeId && matrix.kind === kind));
}
export function matricesForAuditKind(matrices: Matrix[], auditTypeId: string, kind: Matrix['kind']): Matrix[] {
  return alphabetic(matrices.filter(matrix => !matrix.deleted && matrix.auditTypeId === auditTypeId && matrix.kind === kind), matrix => matrix.name);
}
export interface MatrixAuditSelection {
  draft: Matrix;
  additions: Matrix[];
  retained: Matrix[];
}
export function expandMatrixAuditSelection(matrix: Matrix, auditTypeIds: string[], data: Pick<Data, 'entities' | 'matrices'>, createId: () => string = () => crypto.randomUUID()): MatrixAuditSelection {
  const ids = [...new Set(auditTypeIds)];
  if (!ids.length) throw new Error('Choisissez au moins un type d’audit.');
  if (ids.some(id => !data.entities.some(entity => entity.id === id && entity.kind === 'auditType'))) {
    throw new Error('Un type d’audit sélectionné est introuvable.');
  }
  const primaryId = ids.includes(matrix.auditTypeId) ? matrix.auditTypeId : ids[0];
  const clone = (auditTypeId: string, id: string): Matrix => ({
    ...matrix, id, auditTypeId, labels: { ...matrix.labels }, taskIds: [...matrix.taskIds],
    ...(matrix.descriptions && { descriptions: { ...matrix.descriptions } }),
  });
  const result: MatrixAuditSelection = { draft: clone(primaryId, matrix.id), additions: [], retained: [] };
  for (const auditTypeId of ids.filter(id => id !== primaryId)) {
    const existing = data.matrices.filter(m => m.id !== matrix.id && !m.deleted &&
      m.family === matrix.family && m.kind === matrix.kind && m.auditTypeId === auditTypeId);
    if (existing.length) result.retained.push(...existing);
    else result.additions.push(clone(auditTypeId, createId()));
  }
  return result;
}
export function taskReferenceError(tasks: Task[], task: Task): string | null {
  if (task.reference !== 'Autre tâche') return null;
  if (!task.referenceTaskId) return 'Choisissez une tâche de référence.';
  const visited = new Set([task.id]);
  let id = task.referenceTaskId;
  while (id) {
    if (visited.has(id)) return 'Cette référence créerait une boucle de calcul de dates.';
    visited.add(id);
    const ref = tasks.find(t => t.id === id);
    if (!ref) return 'La tâche de référence est introuvable.';
    id = ref.reference === 'Autre tâche' ? ref.referenceTaskId : '';
  }
  return null;
}

export function matrixImpact(data: Data, ids: string[], updateExisting: boolean) {
  const audits = data.audits.filter(a => ids.includes(a.matrixId));
  const targets = audits.filter(a => updateExisting && a.status !== 'Terminé');
  return { matrices: ids.length, audits: targets.length, excluded: audits.filter(a => a.status === 'Terminé').length };
}

export function deleteMatrix(data: Data, matrixId: string): Data {
  if (!data.matrices.some(matrix => matrix.id === matrixId && !matrix.deleted)) {
    throw new Error('La matrice à supprimer est introuvable ou déjà supprimée.');
  }
  return {
    ...data,
    matrices: data.matrices.map(matrix => matrix.id === matrixId ? { ...matrix, deleted: true, active: false } : matrix),
  };
}

export function propagateMatrix(data: Data, original: Matrix, draft: Matrix, ids: string[], updateExisting: boolean): Data {
  if (new Set(draft.taskIds).size !== draft.taskIds.length) throw new Error('Une tâche ne peut pas être associée deux fois.');
  if (draft.taskIds.some(id => !data.tasks.some(t => t.id === id))) throw new Error('Une tâche associée est introuvable.');
  const source = data.matrices.find(m => m.id === original.id);
  if (!source || !ids.includes(source.id)) throw new Error('La matrice source doit faire partie de la sélection.');
  if (ids.some(id => !data.matrices.some(m => m.id === id && !m.deleted && m.family === source.family))) {
    throw new Error('La sélection contient une matrice non correspondante.');
  }
  const added = draft.taskIds.filter(id => !original.taskIds.includes(id));
  const removed = original.taskIds.filter(id => !draft.taskIds.includes(id));
  const applyDelta = (taskIds: string[]) => [...new Set([...taskIds.filter(id => !removed.includes(id)), ...added])];
  return {
    ...data,
    matrices: data.matrices.map(m => m.id === draft.id ? { ...draft } : ids.includes(m.id) ? { ...m, taskIds: applyDelta(m.taskIds) } : m),
    audits: data.audits.map(a => updateExisting && ids.includes(a.matrixId) && a.status !== 'Terminé'
      ? { ...a, taskIds: applyDelta(a.taskIds) } : a),
  };
}

export function reportConflict(rules: ReportRule[], draft: ReportRule): boolean {
  return draft.active && rules.some(r => r.id !== draft.id && r.active && r.standardType === draft.standardType &&
    r.standard === draft.standard && r.auditType === draft.auditType && r.language === draft.language);
}
export const unassignedReportScope = '__UNASSIGNED_REPORT_SCOPE__';
export function reportScopePaths(scope?: ReportScope): string[][] {
  const standards = scope?.standards.length ? [...new Set(scope.standards.map(value => value.trim() || unassignedReportScope))] : [unassignedReportScope];
  const auditTypes = scope?.auditTypes.length ? [...new Set(scope.auditTypes.map(value => value.trim() || unassignedReportScope))] : [unassignedReportScope];
  return standards.flatMap(standard => auditTypes.map(auditType => [
    scope?.standardType.trim() || unassignedReportScope,
    standard.trim() || unassignedReportScope,
    auditType.trim() || unassignedReportScope,
  ]));
}
export function reportPathMatches(path: string[], selection: string[]): boolean {
  return selection.every((value, index) => path[index] === value);
}
export interface TemplateAssociation {
  template: string;
  scope?: ReportScope;
  language: string;
}
export interface TemplateGroup<T> {
  template: string;
  records: T[];
  auditTypes: string[];
  standards: string[];
  languages: string[];
  unassignedAuditRecords: number;
}
export function groupRecordsByTemplate<T>(records: T[], describe: (record: T) => TemplateAssociation): TemplateGroup<T>[] {
  const groups = new Map<string, TemplateGroup<T>>();
  for (const record of records) {
    const association = describe(record);
    const template = association.template.trim();
    const group = groups.get(template) ?? {
      template, records: [], auditTypes: [], standards: [], languages: [], unassignedAuditRecords: 0,
    };
    group.records.push(record);
    const audits = (association.scope?.auditTypes ?? []).map(value => value.trim()).filter(value => value && value !== unassignedReportScope);
    group.auditTypes.push(...audits);
    if (!audits.length) group.unassignedAuditRecords += 1;
    group.standards.push(...(association.scope?.standards ?? []).map(value => value.trim()).filter(Boolean));
    if (association.language.trim()) group.languages.push(association.language.trim());
    groups.set(template, group);
  }
  return alphabetic([...groups.values()], group => group.template).map(group => ({
    ...group,
    auditTypes: alphabetic([...new Set(group.auditTypes)], value => value),
    standards: alphabetic([...new Set(group.standards)], value => value),
    languages: alphabetic([...new Set(group.languages)], value => value),
  }));
}
export const allConfiguredAuditTypesOption = '__ALL_CONFIGURED_AUDIT_TYPES__';
export interface ReportRuleSelection {
  groupId?: string;
  standardType: string;
  standards: string[];
  auditTypes: string[];
  languages: Language[];
  template: string;
  active: boolean;
}
export function expandReportRuleSelection(
  selection: ReportRuleSelection,
  configuredAuditTypes: string[],
  idFactory: () => string = () => crypto.randomUUID(),
): ReportRule[] {
  if (!selection.standards.length || !selection.auditTypes.length || !selection.languages.length) {
    throw new Error('Sélectionnez au moins une norme, un type d’audit et une langue.');
  }
  if (selection.standards.includes('Toutes les normes') && selection.standards.length > 1) {
    throw new Error('« Toutes les normes » ne peut pas être associé à des normes spécifiques.');
  }
  if (selection.auditTypes.includes(allConfiguredAuditTypesOption) && selection.auditTypes.length > 1) {
    throw new Error('« Tous les types d’audits » ne peut pas être associé à des types spécifiques.');
  }
  const auditTypes = selection.auditTypes.includes(allConfiguredAuditTypesOption)
    ? configuredAuditTypes
    : selection.auditTypes;
  if (!auditTypes.length) throw new Error('Aucun type d’audit n’est configuré pour ce type de norme.');
  const groupId = selection.groupId || idFactory();
  return selection.standards.flatMap(standard => auditTypes.flatMap(auditType => selection.languages.map(language => ({
    id: idFactory(),
    groupId,
    standardType: selection.standardType,
    standard,
    auditType,
    language,
    template: selection.template.trim(),
    active: selection.active,
  }))));
}
export function selectReport(rules: ReportRule[], standardType: string, standard: string, auditType: string, language: string): ReportRule | undefined {
  const matching = rules.filter(r => r.active && r.standardType === standardType && r.auditType === auditType && r.language === language);
  const specific = matching.filter(r => r.standard === standard);
  const applicable = specific.length ? specific : matching.filter(r => r.standard === 'Toutes les normes');
  if (applicable.length > 1) throw new Error('Plusieurs trames de même priorité sont applicables.');
  return applicable[0];
}

export const transferRelations: { from: EntityKind; to: EntityKind; label: string }[] = [
  { from: 'auditType', to: 'certification', label: 'Type d’audit → Certification' },
  { from: 'certification', to: 'scheme', label: 'Certification → Schéma' },
  { from: 'site', to: 'enterprise', label: 'Site → Entreprise' },
  { from: 'enterprise', to: 'client', label: 'Entreprise → Client' },
];
export interface OrganizationPath {
  client: Entity | null;
  enterprise: Entity | null;
  site: Entity | null;
}
export function organizationPaths(entities: Entity[]): OrganizationPath[] {
  const clients = entities.filter(entity => entity.kind === 'client');
  const enterprises = entities.filter(entity => entity.kind === 'enterprise');
  const sites = entities.filter(entity => entity.kind === 'site');
  const paths: OrganizationPath[] = [];
  for (const client of clients) {
    if (!enterprises.some(enterprise => enterprise.parentId === client.id)) paths.push({ client, enterprise: null, site: null });
  }
  for (const enterprise of enterprises) {
    const client = clients.find(item => item.id === enterprise.parentId) ?? null;
    const children = sites.filter(site => site.parentId === enterprise.id);
    if (children.length) children.forEach(site => paths.push({ client, enterprise, site }));
    else paths.push({ client, enterprise, site: null });
  }
  sites.filter(site => !enterprises.some(enterprise => enterprise.id === site.parentId))
    .forEach(site => paths.push({ client: null, enterprise: null, site }));
  return paths;
}

const certificationKinds = ['client', 'enterprise', 'scheme', 'certification', 'auditType'] as const;
export function certificationPath(entities: Entity[], entity: Entity): (Entity | null)[] {
  const path: (Entity | null)[] = Array(certificationKinds.length).fill(null);
  const index = certificationKinds.findIndex(kind => kind === entity.kind);
  if (index < 0) return path;
  path[index] = entity;
  for (let i = index - 1; i >= 0; i--) {
    const child = path[i + 1];
    path[i] = child ? entities.find(item => item.id === child.parentId && item.kind === certificationKinds[i]) ?? null : null;
  }
  return path;
}

export function certificationPaths(entities: Entity[], includeAuditTypes: boolean): (Entity | null)[][] {
  const kinds: readonly EntityKind[] = includeAuditTypes ? certificationKinds : certificationKinds.slice(0, 4);
  return entities.filter(entity => {
    const index = kinds.indexOf(entity.kind);
    return index >= 0 && (index === kinds.length - 1 ||
      !entities.some(child => child.kind === kinds[index + 1] && child.parentId === entity.id));
  }).map(entity => certificationPath(entities, entity).slice(0, kinds.length));
}

export function certificationEnterpriseId(entities: Entity[], id: string): string | null {
  const entity = entities.find(item => item.id === id);
  return entity ? certificationPath(entities, entity)[1]?.id ?? null : null;
}

export function reassign(data: Data, from: EntityKind, to: EntityKind, ids: string[], destinationId: string): Data {
  if (!transferRelations.some(r => r.from === from && r.to === to)) throw new Error('Relation non autorisée.');
  if (!ids.length || ids.some(id => !data.entities.some(e => e.id === id && e.kind === from))) throw new Error('Sélectionnez des sources valides.');
  if (!data.entities.some(e => e.id === destinationId && e.kind === to)) throw new Error('La destination est invalide.');
  if (from === 'auditType' || from === 'certification') {
    const company = certificationEnterpriseId(data.entities, destinationId);
    if (!company || ids.some(id => certificationEnterpriseId(data.entities, id) !== company)) {
      throw new Error('Les éléments et leur destination doivent appartenir à la même entreprise renseignée.');
    }
  }
  if (ids.some(id => data.entities.find(e => e.id === id)?.parentId === destinationId)) throw new Error('Une source est déjà rattachée à cette destination.');
  return { ...data, entities: data.entities.map(e => ids.includes(e.id) ? { ...e, parentId: destinationId } : e) };
}

export function templateError(file: { name: string; size: number; type: string }): string | null {
  if (!/\.docx$/i.test(file.name)) return 'Seuls les fichiers .docx sont acceptés.';
  if (file.type && !['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', 'application/zip'].includes(file.type)) return 'Le type de fichier ne correspond pas à un document Word.';
  if (!file.size) return 'Le fichier est vide.';
  if (file.size > 10 * 1024 * 1024) return 'Le fichier dépasse la limite de démonstration de 10 Mo.';
  return null;
}
