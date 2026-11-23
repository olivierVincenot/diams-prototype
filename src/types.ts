export type Page = 'home' | 'tasks' | 'matrices' | 'documents' | 'reports' | 'transfers' | 'history' | 'specifics' | 'exports';
export type Language = 'Français' | 'Anglais' | 'Coréen';
export type DocumentLocale = 'fr' | 'en' | 'ko';
export type SqlScriptStatus = 'À générer' | 'Brouillon' | 'Valide' | 'En erreur';
export type AzureSyncStatus = 'Non synchronisé' | 'Synchronisé' | 'Échec';
export type Labels = { fr: string; en: string; ko: string };
export type DateReference = 'Début d’audit' | 'Fin d’audit' | 'Date du cycle' | 'Décision POV' | 'Autre tâche';
export interface Task {
  id: string;
  name: string;
  type: string;
  scope: string;
  role: string;
  active: boolean;
  reference: DateReference;
  referenceTaskId: string;
  offset: number;
  labels: Labels;
  descriptions?: Labels;
  languageActive?: Record<DocumentLocale, boolean>;
  canCompleteBeforeContractValidation?: boolean;
  mustCompleteBeforeNextTask?: boolean;
  canCompleteBeforeAuditDateConfirmation?: boolean;
  isReferenceTask?: boolean;
}
export interface Matrix {
  id: string;
  family: string;
  name: string;
  auditTypeId: string;
  kind: 'Audit Cycle' | 'Audit Process';
  standardType: string;
  certificationType: string;
  special: boolean;
  active: boolean;
  deleted: boolean;
  labels: Labels;
  descriptions?: Labels;
  taskIds: string[];
}
export interface Audit {
  id: string;
  name: string;
  matrixId: string;
  status: 'En cours' | 'Planifié' | 'Terminé';
  taskIds: string[];
}
export interface DocumentModel {
  id: string;
  type: string;
  active: boolean;
  mandatory: boolean;
  workDocument?: boolean;
  originDocumentId?: string;
  generationMode?: 'none' | 'before' | 'after';
  visibleInExpertiseAndVeto?: boolean;
  implementationEvidence?: boolean;
  implementationVerification?: boolean;
  taskIds: string[];
  versions: Record<DocumentLocale, DocumentVersion>;
}
export interface DocumentType {
  id: string;
  name: string;
  active: boolean;
  required: boolean;
  companySpace: boolean;
  siteLinked: boolean;
  visibleCorrespondents: boolean;
  visibleExternalAuditors: boolean;
  visibleStaff: boolean;
  labels: Labels;
  descriptions: Labels;
  languageActive: Record<DocumentLocale, boolean>;
}
export interface DocumentVersion {
  language: DocumentLocale;
  label: string;
  description?: string;
  active?: boolean;
  templateLogicalName: string;
  fileName: string;
  version: number;
  archives: string[];
  detectedTags: string[];
  unmappedTags: string[];
  sqlScript: string;
  sqlScriptStatus: SqlScriptStatus;
  analyzedFileName: string;
  azureContainer: string;
  azureBlobPath: string;
  azureSyncStatus: AzureSyncStatus;
  lastUpdatedAt: string;
  azureLastOperation: AzureOperationLog | null;
}
export interface AzureOperationLog {
  result: 'Succès' | 'Échec';
  language: DocumentLocale;
  attemptedFileName: string;
  version: number;
  container: string;
  blobPath: string;
  previousFileName: string;
  previousVersion: number;
  archivedPrevious: boolean;
  at: string;
  author: string;
  message: string;
}
export interface ReportRule {
  id: string;
  groupId?: string;
  standardType: string;
  standard: string;
  auditType: string;
  language: Language;
  template: string;
  active: boolean;
}
export type EntityKind = 'site' | 'enterprise' | 'client' | 'auditType' | 'certification' | 'scheme';
export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  parentId: string;
  details?: { label: string; value: string }[];
}
export interface Data {
  tasks: Task[];
  matrices: Matrix[];
  audits: Audit[];
  documents: DocumentModel[];
  documentTypes: DocumentType[];
  reports: ReportRule[];
  entities: Entity[];
  specificSettings: SpecificSettingRecord[];
}
export type SpecificSettingKind =
  | 'toolBox'
  | 'notice'
  | 'skillProfile'
  | 'auditPlanningWeft'
  | 'certificateWeft'
  | 'nonConformityDocument'
  | 'notificationLetter'
  | 'specificDocumentTemplate'
  | 'certificationStatus'
  | 'equipmentSupplier'
  | 'checklist'
  | 'workload';
export interface SettingTranslation {
  active: boolean;
  title: string;
  description: string;
  fileName: string;
}
export type SettingTranslations = Record<DocumentLocale, SettingTranslation>;
export interface SkillPermission {
  id: string;
  userType: string;
  active: boolean;
  download: boolean;
}
export interface ChecklistSection {
  id: string;
  translations: SettingTranslations;
}
export interface SpecificSettingRecord {
  id: string;
  kind: SpecificSettingKind;
  name: string;
  active: boolean;
  values: Record<string, string>;
  reportScope?: ReportScope;
  translations?: SettingTranslations;
  permissions?: SkillPermission[];
  checklistSections?: ChecklistSection[];
  textTranslations?: Record<string, { en: string; ko: string }>;
}
export interface ReportScope {
  standardType: string;
  standards: string[];
  auditTypes: string[];
}
export interface LogEntry {
  id: string;
  at: string;
  author: string;
  title: string;
  scope: string;
  undone?: boolean;
}
export interface Store {
  version: 1;
  certificateExamplesInitialized?: boolean;
  certificateAuditTypesInitialized?: boolean;
  organizationCertificationExamplesInitialized?: boolean;
  demoOrganizationInitialized?: boolean;
  demoClientNameCorrected?: boolean;
  workbookTaskExamplesInitialized?: boolean;
  workbookMatrixExamplesInitialized?: boolean;
  certificationStatusWorkbookInitialized?: boolean;
  data: Data;
  history: LogEntry[];
  undo: { data: Data; logId: string } | null;
}
export type Commit = (title: string, scope: string, change: (data: Data) => Data) => boolean;
export interface Impact {
  title: string;
  description: string;
  scope: string;
  facts: { label: string; value: string | number }[];
  warning?: string;
  compatibilityWarning?: boolean;
  confirmLabel?: string;
  technical?: { ids: { label: string; value: string }[]; tables: string[] };
  apply: () => boolean;
}
