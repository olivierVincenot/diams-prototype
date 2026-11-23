import type { Data, DateReference, DocumentLocale, DocumentVersion, Entity, Language, Task } from './types';
import { createInitialSpecificSettings } from './specificSettingsConfig.ts';
import { workbookTaskExamples } from './taskExamples.ts';
import { workbookMatrixExamples, workbookMatrixTaskExamples } from './matrixExamples.ts';
import { createInitialDocumentTypes } from './documentTypeData.ts';

export function createOrganizationExamples(): Entity[] {
  const client = 'demo-organization-client';
  const enterprise = 'demo-organization-enterprise';
  const mainScheme = 'demo-organization-scheme-alpha';
  const firstCertification = 'demo-organization-certification-a';
  const schemes: [string, string, string][] = [
    [mainScheme, 'Schéma Démo Alpha', 'ISO 14001:2015'],
    ['demo-organization-scheme-beta', 'Schéma Démo Bêta', 'ISO 50001:2018'],
    ['demo-organization-scheme-gamma', 'Schéma Démo Gamma', 'ISO 14001:2015'],
    ['demo-organization-scheme-delta', 'Schéma Démo Delta', 'ISO 14001:2015'],
    ['demo-organization-scheme-epsilon', 'Schéma Démo Epsilon', 'ISO 14001:2015'],
    ['demo-organization-scheme-zeta', 'Schéma Démo Zêta', 'ISO 14001:2015'],
    ['demo-organization-scheme-eta', 'Schéma Démo Êta', 'IATF 16949:2016'],
    ['demo-organization-scheme-theta', 'Schéma Démo Thêta', 'IATF 16949:2016'],
    ['demo-organization-scheme-iota', 'Schéma Démo Iota', 'IATF 16949:2016'],
    ['demo-organization-scheme-kappa', 'Schéma Démo Kappa', 'IATF 16949:2016'],
    ['demo-organization-scheme-lambda', 'Schéma Démo Lambda', 'ISO 50001:2018'],
  ];
  const certificationDetails = [{ label: 'Périodicité', value: '12' }, { label: 'Statut', value: 'Valide' }];
  const cycleDetails = (date: string, days?: string) => [
    { label: 'Date réf. tâches', value: date },
    { label: 'Statut de la certification', value: 'Terminé' },
    ...(days ? [{ label: 'Nombre de jours', value: days }] : []),
  ];
  return [
    { id: client, kind: 'client', name: 'Groupe Démo', parentId: '' },
    { id: enterprise, kind: 'enterprise', name: 'Entreprise Démo', parentId: client },
    { id: 'demo-organization-site-alpha', kind: 'site', name: 'Site Démo Alpha', parentId: enterprise, details: [
      { label: 'Adresse', value: 'Adresse fictive 1' }, { label: 'Code postal', value: '00000' },
      { label: 'Ville', value: 'Ville fictive' }, { label: 'Pays', value: 'Pays fictif' }, { label: 'Fonction', value: 'Production' },
    ] },
    ...schemes.map(([id, name, standard]): Entity => ({ id, kind: 'scheme', name, parentId: enterprise, details: [{ label: 'Norme', value: standard }] })),
    { id: firstCertification, kind: 'certification', name: 'Certification Démo Alpha A', parentId: mainScheme, details: certificationDetails },
    { id: 'demo-organization-certification-b', kind: 'certification', name: 'Certification Démo Alpha B', parentId: mainScheme, details: certificationDetails.map(detail => ({ ...detail })) },
    { id: 'demo-organization-audit-a', kind: 'auditType', name: 'Surveillance Démo A', parentId: firstCertification, details: cycleDetails('15/03/2031', '2') },
    { id: 'demo-organization-audit-b', kind: 'auditType', name: 'Surveillance Démo B', parentId: firstCertification, details: cycleDetails('15/03/2032', '2') },
    { id: 'demo-organization-audit-c', kind: 'auditType', name: 'Contrôle documentaire Démo', parentId: firstCertification, details: cycleDetails('15/03/2033') },
  ];
}

export const references: DateReference[] = ['Autre tâche', 'Date du cycle', 'Début d’audit', 'Décision POV', 'Fin d’audit'];
export const languages: Language[] = ['Anglais', 'Coréen', 'Français'];
export const roles = ['Administrateur', 'Auditeur', 'Chargé de certification', 'Planificateur', 'Responsable de décision'];
export const taskTypes = [
  'SIMPLE', 'AUDIT', 'PLAN_ACTION', 'VALIDATION_PLAN_ACTION', 'PREUVE', 'VALIDATION_PREUVE',
  'EXPERTISE_TECHNIQUE', 'EXERCICE_DROIT_VETO', 'CLOTURE_PLAN_ACTION', 'CLOTURE_PREUVE_PLAN_ACTION',
  'MAJ_PLAN_ACTION', 'VALIDATION_MAJ_PLAN_ACTION', 'DEVIS_DEMO', 'PV_DEMO', 'TECHNICIEN_ATTESTE',
  'CONTRAT', 'PROCESSUS_METIER', 'PRODUIT_IATF', 'CLIENT_AUTOMOBILE', 'ATTRIBUTION_NUM_CERTIFICAT',
  'GEN_COURRIER_NOTIF', 'ACTION_CORRECTIVE_PREUVE', 'CLOTURE_NON_CONFORMITY',
];
export const taskRoles = [...new Set([...roles,
  'Chargé Administratif', 'Chargé commercial', 'Gestionnaire du dossier', 'Correspondant d’audit',
  'Expert', 'Détenteur du droit de véto', 'Responsable d’audit', 'Signataire du contrat',
  'Observateur COFRAC', 'Interprète', 'Observateur OEM', 'Gestionnaire contrat', 'Auditeur témoin IATF',
  'Contract reviewer', 'Auditeur2', 'Auditeur3', 'Auditeur témoin interne', 'Responsable Schéma',
  'Auditeur en formation', 'Expert 2', 'Expert 3', 'Détenteur du droit de Véto2',
])];
export const createTaskSettings = () => ({
  descriptions: { fr: '', en: '', ko: '' },
  languageActive: { fr: true, en: true, ko: true },
  canCompleteBeforeContractValidation: false,
  mustCompleteBeforeNextTask: false,
  canCompleteBeforeAuditDateConfirmation: false,
  isReferenceTask: false,
});
export function createWorkbookTaskExamples(): Task[] {
  return workbookTaskExamples.map(example => ({
    ...createTaskSettings(),
    id: `demo-workbook-task-${example.row}`,
    name: example.title,
    type: example.type,
    scope: example.model === 'AuditProcess' ? 'Process' : 'Type d’audit',
    role: example.role,
    active: true,
    reference: example.fromStart ? 'Début d’audit' : 'Fin d’audit',
    referenceTaskId: '',
    offset: example.offset,
    labels: { fr: example.title, en: '', ko: '' },
    descriptions: { fr: example.description, en: '', ko: '' },
    mustCompleteBeforeNextTask: example.next,
    canCompleteBeforeAuditDateConfirmation: example.beforeDate,
    canCompleteBeforeContractValidation: example.beforeContract,
    isReferenceTask: example.referenceTask,
  }));
}
export function createWorkbookMatrixData(): Pick<Data, 'tasks' | 'matrices'> & { auditType: Entity } {
  const auditType: Entity = { id: 'demo-workbook-iso-recertification', kind: 'auditType', name: 'ISO · Re-certification', parentId: '' };
  const tasks: Task[] = workbookMatrixTaskExamples.map(example => ({
    ...createTaskSettings(),
    id: `demo-matrix-workbook-task-${example.row}`,
    name: example.title,
    type: example.type,
    scope: 'Process',
    role: example.role,
    active: example.active,
    reference: example.fromStart ? 'Début d’audit' : 'Fin d’audit',
    referenceTaskId: '',
    offset: example.offset,
    labels: { fr: example.title, en: '', ko: '' },
    descriptions: { fr: example.description, en: '', ko: '' },
  }));
  const matrices: Data['matrices'] = workbookMatrixExamples.map(example => ({
    id: `demo-matrix-workbook-${example.row}`,
    family: `demo-matrix-workbook-family-${example.row}`,
    name: example.name,
    auditTypeId: auditType.id,
    kind: example.kind === 'AuditProcess' ? 'Audit Process' : 'Audit Cycle',
    standardType: example.standardType,
    certificationType: example.certificationType,
    special: example.special,
    active: example.active,
    deleted: false,
    labels: { fr: example.name, en: '', ko: '' },
    descriptions: { fr: example.description, en: '', ko: '' },
    taskIds: example.row === 4 ? tasks.map(task => task.id) : [],
  }));
  return { tasks, matrices, auditType };
}
export const standardTypes = ['Automobile', 'SM'];
export const matrixStandardTypes = [
  'Automobile', 'Système de management',
  'SMQ', 'SME', 'SMEn', 'SMSST', 'EAD', 'OQ', 'CCC', 'INMETRO', 'COP', 'GPI',
  'INT ISO', 'IATF', 'Cyber', 'INT IATF', 'SM', 'SERMI',
];
export const matrixCertificationTypes = [
  'Produit', 'Système',
  'Système de management', 'Qualification Règlementaire', 'China Compulsory Certification',
  'Autres', 'Inmetro', 'Inspection GPI', 'SERMI',
];
export const standards = ['IATF 16949', 'ISO 14001', 'ISO 50001', 'ISO 9001'];
export const reportAuditTypes = ['Initiale étape 2', 'Recertification', 'Surveillance'];
export const reportStandardsFor = (type: string) =>
  standards.filter(standard => type === 'Automobile' ? standard.startsWith('IATF') : type === 'SM' && standard.startsWith('ISO'));

const task = (id: string, name: string, role: string, reference: DateReference, offset: number, en: string, ko: string): Task => ({
  ...createTaskSettings(),
  id, name, role, reference, offset, type: 'SIMPLE', scope: 'Type d’audit', active: true,
  referenceTaskId: '', labels: { fr: name, en, ko },
});
export interface DemoTagQueryMapping {
  tag: string;
  sourceHint: string | null;
}

export const demoTagQueryMappings: DemoTagQueryMapping[] = [
  { tag: 'AUDIT_REFERENCE', sourceHint: 'Champ fictif A' },
  { tag: 'CLIENT_NAME', sourceHint: 'Champ fictif B' },
  { tag: 'AUDIT_START_DATE', sourceHint: 'Champ fictif C' },
  { tag: 'AUDIT_END_DATE', sourceHint: 'Champ fictif D' },
  { tag: 'LEAD_AUDITOR', sourceHint: 'Champ fictif E' },
  { tag: 'SITE_ADDRESS', sourceHint: null },
];

export const demoTemplateTagFixtures: Record<DocumentLocale, string[]> = {
  fr: ['AUDIT_REFERENCE', 'CLIENT_NAME', 'AUDIT_START_DATE', 'LEAD_AUDITOR'],
  en: ['AUDIT_REFERENCE', 'CLIENT_NAME', 'SUPERVISOR_EMAIL'],
  ko: ['AUDIT_REFERENCE', 'SITE_ADDRESS', 'AUDIT_REFERENCE'],
};

const demoSqlScript = (tags: string[]) => [
  '-- Proposition illustrative : aucun SQL réel ne sera exécuté.',
  '-- Le référentiel et les expressions sources sont fictifs.',
  'SELECT',
  ...tags.map((tag, index) => `  CAST(N'[Valeur simulée: ${tag}]' AS nvarchar(max)) AS [${tag}]${index < tags.length - 1 ? ',' : ''}`),
  ';',
].join('\n');

const documentVersion = (
  language: DocumentLocale,
  label: string,
  templateLogicalName: string,
  fileName: string,
  version: number,
  lastUpdatedAt: string,
  options: Partial<DocumentVersion> = {},
): DocumentVersion => ({
  language,
  label,
  templateLogicalName,
  fileName,
  version,
  archives: [],
  detectedTags: [],
  unmappedTags: [],
  sqlScript: '',
  sqlScriptStatus: 'À générer',
  analyzedFileName: '',
  azureContainer: 'diams-templates-demo',
  azureBlobPath: '',
  azureSyncStatus: 'Non synchronisé',
  lastUpdatedAt,
  azureLastOperation: null,
  ...options,
});

export function createInitialData(): Data {
  const workbookMatrices = createWorkbookMatrixData();
  const tasks: Task[] = [
    task('t1', 'Planifier l’audit', 'Planificateur', 'Début d’audit', -60, 'Schedule the audit', '심사 일정 수립'),
    task('t2', 'Finaliser la planification', 'Planificateur', 'Début d’audit', -30, 'Finalize planning', '계획 확정'),
    task('t3', 'Réaliser l’audit', 'Auditeur', 'Début d’audit', 0, 'Conduct the audit', '심사 수행'),
    task('t4', 'Rédiger le rapport', 'Auditeur', 'Fin d’audit', 15, 'Write the report', '보고서 작성'),
    task('t5', 'Décision POV', 'Responsable de décision', 'Fin d’audit', 30, 'Certification decision', '인증 결정'),
    task('t6', 'Transmettre le certificat', 'Chargé de certification', 'Décision POV', 7, 'Send the certificate', '인증서 전송'),
    { ...task('t7', 'Contrôler le contrat', 'Administrateur', 'Date du cycle', -90, 'Check the contract', '계약 검토'), scope: 'Contrat' },
    { ...task('t8', 'Vérifier les exigences 2027', 'Auditeur', 'Date du cycle', 0, 'Check 2027 requirements', '2027 요구사항 확인'), scope: 'Process' },
    { ...task('t9', 'Archiver le dossier papier', 'Administrateur', 'Fin d’audit', 60, 'Archive the paper file', '서류 보관'), active: false },
    ...createWorkbookTaskExamples(),
    ...workbookMatrices.tasks,
  ];
  const matrices: Data['matrices'] = [
    { id: 'm1', family: 'cycle-iatf', name: 'Cycle de certification IATF', auditTypeId: 'at1', kind: 'Audit Cycle', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Cycle de certification IATF', en: 'IATF certification cycle', ko: 'IATF 인증 주기' }, taskIds: ['t1', 't2', 't3', 't4', 't5', 't6'] },
    { id: 'm2', family: 'planning', name: 'Planification · 1 auditeur', auditTypeId: 'at1', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Planification · 1 auditeur', en: 'Planning · 1 auditor', ko: '계획 · 심사원 1명' }, taskIds: ['t1', 't2'] },
    { id: 'm3', family: 'cycle-iatf', name: 'Cycle de certification IATF', auditTypeId: 'at2', kind: 'Audit Cycle', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Cycle de certification IATF', en: 'IATF certification cycle', ko: 'IATF 인증 주기' }, taskIds: ['t1', 't2', 't3', 't4', 't5', 't6'] },
    { id: 'm4', family: 'planning', name: 'Planification · 1 auditeur', auditTypeId: 'at2', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Planification · 1 auditeur', en: 'Planning · 1 auditor', ko: '계획 · 심사원 1명' }, taskIds: ['t1', 't2'] },
    { id: 'm5', family: 'cycle-iatf', name: 'Cycle de certification IATF', auditTypeId: 'at3', kind: 'Audit Cycle', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Cycle de certification IATF', en: 'IATF certification cycle', ko: 'IATF 인증 주기' }, taskIds: ['t1', 't2', 't3', 't4', 't5', 't6'] },
    { id: 'm6', family: 'decision', name: 'Décision de certification', auditTypeId: 'at4', kind: 'Audit Process', standardType: 'Système de management', certificationType: 'Système', special: true, active: true, deleted: false, labels: { fr: 'Décision de certification', en: 'Certification decision', ko: '인증 결정' }, taskIds: ['t5', 't6'] },
    { id: 'm7', family: 'planning', name: 'IATF Recertification · 1 auditeur', auditTypeId: 'at3', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'IATF Recertification · 1 auditeur', en: 'IATF Recertification · 1 auditor', ko: 'IATF 갱신 · 심사원 1명' }, taskIds: ['t1', 't2'] },
    { id: 'm8', family: 'planning', name: 'IATF Recertification · 2 auditeurs', auditTypeId: 'at3', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'IATF Recertification · 2 auditeurs', en: 'IATF Recertification · 2 auditors', ko: 'IATF 갱신 · 심사원 2명' }, taskIds: ['t1', 't2', 't3'] },
    { id: 'm9', family: 'planning', name: 'IATF Recertification · 3 auditeurs', auditTypeId: 'at3', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'IATF Recertification · 3 auditeurs', en: 'IATF Recertification · 3 auditors', ko: 'IATF 갱신 · 심사원 3명' }, taskIds: ['t1', 't2', 't3', 't4'] },
    { id: 'm10', family: 'cycle-iatf', name: 'Cycle IATF Surveillance 1', auditTypeId: 'at5', kind: 'Audit Cycle', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Cycle IATF Surveillance 1', en: 'IATF Surveillance 1 cycle', ko: 'IATF 사후 심사 1 주기' }, taskIds: ['t1', 't2', 't3', 't4', 't5', 't6'] },
    { id: 'm11', family: 'planning', name: 'Planification IATF Surveillance 1', auditTypeId: 'at5', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Planification IATF Surveillance 1', en: 'IATF Surveillance 1 planning', ko: 'IATF 사후 심사 1 계획' }, taskIds: ['t1', 't2'] },
    { id: 'm12', family: 'planning', name: 'Planification IATF Surveillance 2', auditTypeId: 'at6', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Planification IATF Surveillance 2', en: 'IATF Surveillance 2 planning', ko: 'IATF 사후 심사 2 계획' }, taskIds: ['t1', 't2'] },
    { id: 'm13', family: 'recert-preparation', name: 'Processus de préparation de l’audit', auditTypeId: 'at3', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Processus de préparation de l’audit', en: 'Audit preparation process', ko: '심사 준비 프로세스' }, taskIds: ['t1', 't2'] },
    { id: 'm14', family: 'recert-analysis', name: 'Processus d’analyse et de décision', auditTypeId: 'at3', kind: 'Audit Process', standardType: 'Automobile', certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: 'Processus d’analyse et de décision', en: 'Analysis and decision process', ko: '분석 및 결정 프로세스' }, taskIds: ['t3', 't4', 't5'] },
  ];
  return {
    tasks, matrices: [...matrices, ...workbookMatrices.matrices], documentTypes: createInitialDocumentTypes(),
    audits: matrices.flatMap((m, i) => (['Planifié', 'En cours', 'Terminé'] as const).map((status, j) => ({
      id: `audit-${i}-${j}`, name: `Audit 2027 · ${i + 1}${j + 1}`, matrixId: m.id, status, taskIds: [...m.taskIds],
    }))),
    documents: [
      {
        id: 'd1', type: 'Courrier', active: true, mandatory: true, taskIds: ['t2'],
        versions: {
          fr: documentVersion('fr', "Lettre de confirmation d'audit", 'audit-confirmation-fr', 'Audit_Confirmation_FR_v2.docx', 2, '2026-11-18T09:00:00Z', {
            archives: ['Audit_Confirmation_FR.docx'],
            detectedTags: [...demoTemplateTagFixtures.fr],
            sqlScript: demoSqlScript(demoTemplateTagFixtures.fr),
            sqlScriptStatus: 'Valide',
            analyzedFileName: 'Audit_Confirmation_FR_v2.docx',
            azureBlobPath: 'audit-confirmation/fr/Audit_Confirmation_FR_v2.docx',
            azureSyncStatus: 'Synchronisé',
            azureLastOperation: {
              result: 'Succès', language: 'fr', attemptedFileName: 'Audit_Confirmation_FR_v2.docx', version: 2,
              container: 'diams-templates-demo', blobPath: 'audit-confirmation/fr/Audit_Confirmation_FR_v2.docx',
              previousFileName: 'Audit_Confirmation_FR.docx', previousVersion: 1, archivedPrevious: true,
              at: '2026-11-18T09:00:00Z', author: 'Démo', message: 'Dépôt Azure simulé réussi; l’ancienne version a été archivée.',
            },
          }),
          en: documentVersion('en', 'Audit Confirmation Letter', 'audit-confirmation-en', 'Audit_Confirmation_EN_v2.docx', 2, '2026-11-18T10:00:00Z', {
            archives: ['Audit_Confirmation_EN.docx'],
            detectedTags: [...demoTemplateTagFixtures.en],
            unmappedTags: ['SUPERVISOR_EMAIL'],
            sqlScript: demoSqlScript(['AUDIT_REFERENCE', 'CLIENT_NAME']),
            sqlScriptStatus: 'Brouillon',
            analyzedFileName: 'Audit_Confirmation_EN.docx',
          }),
          ko: documentVersion('ko', '감사 확인서', 'audit-confirmation-ko', 'Audit_Confirmation_KO.docx', 1, '2026-11-18T09:30:00Z', {
            detectedTags: [...demoTemplateTagFixtures.ko],
            sqlScript: demoSqlScript(['AUDIT_REFERENCE']),
            sqlScriptStatus: 'Brouillon',
            analyzedFileName: 'Audit_Confirmation_KO.docx',
          }),
        },
      },
      {
        id: 'd2', type: 'Ordre de mission', active: true, mandatory: true, taskIds: ['t1', 't3'],
        versions: {
          fr: documentVersion('fr', 'Ordre de mission', 'ordre-mission-fr', 'Ordre_de_mission_FR.docx', 1, '2026-11-17T09:00:00Z', {
            detectedTags: [...demoTemplateTagFixtures.fr],
            sqlScript: demoSqlScript(demoTemplateTagFixtures.fr),
            sqlScriptStatus: 'Valide',
            analyzedFileName: 'Ordre_de_mission_FR.docx',
            azureLastOperation: {
              result: 'Échec', language: 'fr', attemptedFileName: 'Ordre_de_mission_FR_v2.docx', version: 2,
              container: 'diams-templates-demo', blobPath: 'ordre-mission/fr/Ordre_de_mission_FR_v2.docx',
              previousFileName: 'Ordre_de_mission_FR.docx', previousVersion: 1, archivedPrevious: false,
              at: '2026-11-17T09:10:00Z', author: 'Démo', message: 'Échec simulé avant activation; le template v1 reste actif.',
            },
            azureBlobPath: 'ordre-mission/fr/Ordre_de_mission_FR.docx',
            azureSyncStatus: 'Échec',
          }),
          en: documentVersion('en', 'Audit Mission Order', 'ordre-mission-en', 'Audit_Mission_Order_EN.docx', 1, '2026-11-17T09:15:00Z', {
          }),
          ko: documentVersion('ko', '심사 지시서', 'ordre-mission-ko', 'Audit_Mission_Order_KO.docx', 1, '2026-11-17T09:30:00Z'),
        },
      },
      {
        id: 'd3', type: 'Rapport', active: true, mandatory: true, taskIds: ['t4'],
        versions: {
          fr: documentVersion('fr', 'Rapport initial étape 2', 'rapport-initial-fr', 'Rapport_SM_FR.docx', 3, '2026-11-16T09:00:00Z'),
          en: documentVersion('en', 'Initial Audit Report - Stage 2', 'rapport-initial-en', 'Initial_Audit_Report_EN.docx', 3, '2026-11-16T09:15:00Z'),
          ko: documentVersion('ko', '초기 심사 보고서 2단계', 'rapport-initial-ko', 'Initial_Audit_Report_KO.docx', 3, '2026-11-16T09:30:00Z'),
        },
      },
    ],
    reports: [
      { id: 'r1', standardType: 'SM', standard: 'Toutes les normes', auditType: 'Initiale étape 2', language: 'Français', template: 'Rapport générique SM.docx', active: true },
      { id: 'r2', standardType: 'SM', standard: 'ISO 9001', auditType: 'Initiale étape 2', language: 'Français', template: 'Rapport ISO 9001.docx', active: true },
      { id: 'r3', standardType: 'SM', standard: 'ISO 14001', auditType: 'Initiale étape 2', language: 'Français', template: 'Rapport ISO 14001.docx', active: true },
      ...['ISO 9001', 'ISO 14001', 'ISO 50001'].map((standard, index) => ({
        id: `demo-sm-surveillance-${index + 1}`,
        groupId: 'demo-sm-all-standards-surveillance',
        standardType: 'SM',
        standard,
        auditType: 'Surveillance',
        language: 'Français' as Language,
        template: 'Rapport de surveillance multi-normes SM.docx',
        active: true,
      })),
      { id: 'demo-auto-iatf-initial', standardType: 'Automobile', standard: 'IATF 16949', auditType: 'Initiale étape 2', language: 'Français', template: 'Rapport IATF 16949.docx', active: true },
    ],
    entities: [
      { id: 'cl1', kind: 'client', name: 'Client Démonstration', parentId: '' },
      { id: 'cl2', kind: 'client', name: 'Groupe Horizon', parentId: '' },
      { id: 'e1', kind: 'enterprise', name: 'Entreprise A', parentId: 'cl1' },
      { id: 'e2', kind: 'enterprise', name: 'Entreprise B', parentId: 'cl1' },
      { id: 'e3', kind: 'enterprise', name: 'Entreprise C', parentId: 'cl2' },
      { id: 's1', kind: 'site', name: 'Site 1 · Lyon', parentId: 'e1' },
      { id: 's2', kind: 'site', name: 'Site 2 · Lille', parentId: 'e1' },
      { id: 's3', kind: 'site', name: 'Site 3 · Bordeaux', parentId: 'e2' },
      { id: 'sc1', kind: 'scheme', name: 'Schéma Automobile', parentId: 'e1' },
      { id: 'sc2', kind: 'scheme', name: 'Schéma Système de management', parentId: 'e1' },
      { id: 'sc3', kind: 'scheme', name: 'Schéma Qualité · Entreprise B', parentId: 'e2' },
      { id: 'c1', kind: 'certification', name: 'Certification IATF 16949', parentId: 'sc1' },
      { id: 'c2', kind: 'certification', name: 'Certification ISO 9001', parentId: 'sc2' },
      { id: 'c3', kind: 'certification', name: 'Certification ISO 14001', parentId: 'sc2' },
      { id: 'c4', kind: 'certification', name: 'Certification Qualité · Entreprise B', parentId: 'sc3' },
      { id: 'at1', kind: 'auditType', name: 'IATF Initial', parentId: 'c1' },
      { id: 'at2', kind: 'auditType', name: 'IATF Surveillance', parentId: 'c1' },
      { id: 'at3', kind: 'auditType', name: 'IATF Recertification', parentId: 'c1' },
      { id: 'at4', kind: 'auditType', name: 'ISO Initiale étape 2', parentId: 'c2' },
      { id: 'at5', kind: 'auditType', name: 'IATF Surveillance 1', parentId: 'c1' },
      { id: 'at6', kind: 'auditType', name: 'IATF Surveillance 2', parentId: 'c1' },
      { id: 'at7', kind: 'auditType', name: 'Audit Qualité · Entreprise B', parentId: 'c4' },
      ...createOrganizationExamples(),
      workbookMatrices.auditType,
    ],
    specificSettings: createInitialSpecificSettings(),
  };
}
