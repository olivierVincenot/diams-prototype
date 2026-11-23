import type { Entity, Language, SpecificSettingKind, SpecificSettingRecord } from './types';
import type { TechnicalMappingKey } from './supportConfig';
import { createCertificationStatusExamples } from './certificationStatusExamples.ts';

export interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  translatable?: boolean;
}

export interface SettingDefinition {
  kind: SpecificSettingKind;
  title: string;
  singular: string;
  description: string;
  mapping: TechnicalMappingKey | null;
  standardOptions?: Record<string, string[]>;
  fields: SettingField[];
}

export const toolBoxVisibilityFields = [
  { key: 'visibleToCorrespondents', label: 'Visible par les correspondants' },
  { key: 'visibleToExternalAuditors', label: 'Visible par les auditeurs externes' },
  { key: 'visibleToUtacMembers', label: 'Visible par les membres de l’UTAC' },
] as const;

export const historicalAuditTypes = [
  'Initial', 'Initial - Etape 2', 'Re-certification', 'Transition', '(IATF) Transfert',
  'Renouvellement', 'Examen de dossier', 'Surveillance', '(IATF) Surveillance', 'Test Expertise',
];

export function checklistAuditTypes(entities: Entity[]): { id: string; name: string }[] {
  const configured = entities.filter(item => item.kind === 'auditType');
  return [...configured, ...historicalAuditTypes.filter(name => !configured.some(item => item.name === name))
    .map(name => ({ id: `example-audit:${name}`, name }))];
}

const iatfCertificateAuditTypes = [
  '(IATF) Initial - Stage 1',
  '(IATF) Initial - Stage 2',
  '(IATF) Initial - Stage 2 - Démo B',
  '(IATF) Initial - Step 1- Démo A',
  '(IATF) Initial - Step 2- Démo A',
  '(IATF) Re-certification',
  '(IATF) Special',
  '(IATF) Surveillance',
  '(IATF) Surveillance -Démo A',
  '(IATF) Transfer',
];
const isoCertificateAuditTypes = [
  'Initial - Stage 1',
  'Initial - Stage 2',
  'Inmetro',
  'Minor modification',
  'Multisites Démo Initial - Stage 1',
  'Multisites Démo Initial - Stage 2',
];
const certificateAuditTypesByStandard: Record<string, string[]> = {
  'IATF 16949': iatfCertificateAuditTypes,
  'IATF 16949:2016': iatfCertificateAuditTypes,
  'IATF 16949:2016 (IATF)': iatfCertificateAuditTypes,
  'ISO 9001': isoCertificateAuditTypes,
  'ISO 9001:2015': isoCertificateAuditTypes,
  'ISO 9001:2015 (IATF)': isoCertificateAuditTypes,
  'ISO 14001': isoCertificateAuditTypes,
  'ISO 14001:2015': isoCertificateAuditTypes,
  'ISO 50001': isoCertificateAuditTypes,
  'ISO 50001:2018': isoCertificateAuditTypes,
};

export function certificateAuditTypesFor(standards: readonly string[]): string[] {
  const lists = !standards.length || standards.includes('Toutes les normes')
    ? Object.values(certificateAuditTypesByStandard)
    : standards.map(standard => certificateAuditTypesByStandard[standard] ?? []);
  return [...new Set(lists.flat())];
}

const isoCertificateTemplates: Record<Language, string> = {
  Français: 'modele-demo-iso-fr.docx',
  Anglais: 'modele-demo-iso-en.docx',
  Coréen: 'modele-demo-iso-ko.docx',
};
const iatfCertificateTemplates: Record<Language, string> = {
  Français: 'modele-demo-auto-fr.docx',
  Anglais: 'modele-demo-auto-en.docx',
  Coréen: 'modele-demo-auto-ko.docx',
};
const certificateExampleGroups: {
  key: string;
  standard: string;
  templates: Partial<Record<Language, string>>;
}[] = [
  { key: 'iatf-2016', standard: 'IATF 16949:2016', templates: {
    Français: iatfCertificateTemplates.Français, Anglais: iatfCertificateTemplates.Anglais,
  } },
  { key: 'iso50001-2018', standard: 'ISO 50001:2018', templates: {
    Français: isoCertificateTemplates.Français, Anglais: isoCertificateTemplates.Anglais,
  } },
  { key: 'iso14001-2015', standard: 'ISO 14001:2015', templates: isoCertificateTemplates },
  { key: 'iatf-2016-iatf', standard: 'IATF 16949:2016 (IATF)', templates: iatfCertificateTemplates },
  { key: 'iso9001-2015', standard: 'ISO 9001:2015', templates: isoCertificateTemplates },
  { key: 'iso45001-2018', standard: 'ISO 45001:2018', templates: isoCertificateTemplates },
  { key: 'iso9001-2015-iatf', standard: 'ISO 9001:2015 (IATF)', templates: isoCertificateTemplates },
];

export function createCertificateExamples(): SpecificSettingRecord[] {
  const locales: { code: string; language: Language }[] = [
    { code: 'fr', language: 'Français' }, { code: 'en', language: 'Anglais' }, { code: 'ko', language: 'Coréen' },
  ];
  return certificateExampleGroups.flatMap(group => locales.flatMap(({ code, language }) => {
    const templateName = group.templates[language];
    if (!templateName) return [];
    return [{
      id: `demo-certificate-${group.key}-${code}`,
      kind: 'certificateWeft',
      name: `Certificat ${group.standard} · ${language}`,
      active: true,
      reportScope: { standardType: 'SM', standards: [group.standard], auditTypes: certificateAuditTypesFor([group.standard]) },
      values: { language, certificationType: 'Système de management', expertiseVetoVisible: 'Oui', templateName },
    }];
  }));
}

export const settingDefinitions: Record<SpecificSettingKind, SettingDefinition> = {
  toolBox: {
    kind: 'toolBox', title: 'Boîte à outils', singular: 'outil', description: 'Gérez les entrées fictives de la boîte à outils.',
    mapping: 'toolBoxes', fields: [
      { key: 'category', label: 'Catégorie', placeholder: 'Ex. Préparation d’audit', translatable: true },
      { key: 'description', label: 'Description', placeholder: 'Description de l’outil', multiline: true, translatable: true },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
    ],
  },
  notice: {
    kind: 'notice', title: 'Notices', singular: 'notice', description: 'Créez et gérez les notices fictives et leurs textes.',
    mapping: 'notices', fields: [
      { key: 'category', label: 'Catégorie', placeholder: 'Ex. Utilisation', translatable: true },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'content', label: 'Contenu', placeholder: 'Texte de la notice', multiline: true, translatable: true },
    ],
  },
  skillProfile: {
    kind: 'skillProfile', title: 'Dossiers de compétences / profils', singular: 'dossier de compétences', description: 'Organisez les dossiers et leurs autorisations fictives.',
    mapping: 'skillCategories', fields: [
      { key: 'category', label: 'Catégorie de compétence', placeholder: 'Ex. Audit qualité', translatable: true },
      { key: 'skills', label: 'Compétences', placeholder: 'Une compétence par ligne', multiline: true, translatable: true },
      { key: 'description', label: 'Description', placeholder: 'Description du profil', multiline: true, translatable: true },
    ],
  },
  auditPlanningWeft: {
    kind: 'auditPlanningWeft', title: 'Trames de planning d’audit', singular: 'trame de planning', description: 'Gérez des modèles fictifs de planning, sans calcul métier intégré.',
    mapping: 'auditPlanningWefts', fields: [
      { key: 'auditType', label: 'Type d’audit indicatif (ancienne valeur)', placeholder: 'Ex. Surveillance', translatable: true },
      { key: 'durationDays', label: 'Durée indicative (jours)', placeholder: '1' },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
    ],
  },
  certificateWeft: {
    kind: 'certificateWeft', title: 'Trames de certificat', singular: 'trame de certificat', description: 'Gérez les trames fictives de démonstration.',
    mapping: 'certificateWefts', fields: [
      { key: 'standard', label: 'Norme indicative (ancienne valeur)', placeholder: 'Ex. ISO 9001' },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'certificationType', label: 'Type de certification', placeholder: 'Système de management', translatable: true },
      { key: 'expertiseVetoVisible', label: 'Visible tâche Expertise/Veto', placeholder: 'Oui / Non' },
      { key: 'templateName', label: 'Template (nom logique ou fichier complet)', placeholder: 'certificat-fr.docx' },
    ],
    standardOptions: { SM: certificateExampleGroups.map(group => group.standard) },
  },
  nonConformityDocument: {
    kind: 'nonConformityDocument', title: 'Trames de non-conformité', singular: 'trame de non-conformité', description: 'Gérez des références fictives de documents de non-conformité.',
    mapping: 'nonConformityDocuments', fields: [
      { key: 'documentKind', label: 'Type de document', placeholder: 'Ex. Fiche de non-conformité', translatable: true },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'templateName', label: 'Nom logique du template', placeholder: 'non-conformite-fr' },
    ],
  },
  notificationLetter: {
    kind: 'notificationLetter', title: 'Trames de courrier de notification', singular: 'courrier de notification', description: 'Gérez les références fictives de courriers de notification.',
    mapping: 'notificationLetters', fields: [
      { key: 'trigger', label: 'Événement indicatif', placeholder: 'Ex. Décision de certification', translatable: true },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'templateName', label: 'Nom logique du template', placeholder: 'notification-fr' },
    ],
  },
  specificDocumentTemplate: {
    kind: 'specificDocumentTemplate', title: 'Modèles de documents spécifiques', singular: 'modèle spécifique', description: 'Gérez des templates fictifs dédiés à des usages spécifiques.',
    mapping: 'specificDocumentTemplates', fields: [
      { key: 'documentKind', label: 'Type de document', placeholder: 'Ex. Document spécifique', translatable: true },
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'templateLogicalName', label: 'Nom logique du template', placeholder: 'document-specifique-fr' },
    ],
  },
  certificationStatus: {
    kind: 'certificationStatus', title: 'Matrice des statuts de certification', singular: 'transition de statut', description: 'Gérez les transitions simulées selon la décision et le type d’audit.',
    mapping: 'certificationStatusMatrix', fields: [
      { key: 'decision', label: 'Veto / décision', placeholder: 'Ex. Favorable' },
      { key: 'originStatus', label: 'Statut d’origine', placeholder: 'Ex. En cours d’acquisition', translatable: true },
      { key: 'destinationStatus', label: 'Statut de destination', placeholder: 'Ex. Valide', translatable: true },
      { key: 'auditType', label: 'Type d’audit', placeholder: 'Ex. Surveillance' },
      { key: 'standard', label: 'Norme', placeholder: 'Ex. ISO 9001' },
      { key: 'certificationType', label: 'Type de certification', placeholder: 'Ex. Système', translatable: true },
      { key: 'status', label: 'Statut', placeholder: 'Ex. Valide', translatable: true },
      { key: 'order', label: 'Ordre d’affichage', placeholder: '1' },
    ],
  },
  equipmentSupplier: {
    kind: 'equipmentSupplier', title: 'Équipementiers', singular: 'équipementier', description: 'Gérez des fournisseurs et techniciens fictifs.',
    mapping: 'equipmentSuppliers', fields: [
      { key: 'company', label: 'Entreprise', placeholder: 'Nom de l’entreprise', translatable: true },
      { key: 'technician', label: 'Technicien', placeholder: 'Nom du technicien', translatable: true },
      { key: 'specialty', label: 'Spécialité', placeholder: 'Domaine de compétence', translatable: true },
      { key: 'contact', label: 'Contact fictif', placeholder: 'contact@example.test' },
    ],
  },
  checklist: {
    kind: 'checklist', title: 'Checklist', singular: 'checklist', description: 'Gérez les chapitres et sections par type d’audit.',
    mapping: 'checklists', fields: [
      { key: 'language', label: 'Langue', placeholder: 'Français' },
      { key: 'sections', label: 'Sections / éléments', placeholder: 'Une section ou question par ligne', multiline: true, translatable: true },
    ],
  },
  workload: {
    kind: 'workload', title: 'Plan de charge', singular: 'entrée de charge', description: 'Suivez des charges indicatives dans un jeu fictif, sans calcul de capacité métier.',
    mapping: null, fields: [
      { key: 'audit', label: 'Audit concerné', placeholder: 'Référence d’audit fictive' },
      { key: 'resource', label: 'Ressource', placeholder: 'Nom de l’auditeur ou équipe', translatable: true },
      { key: 'period', label: 'Période', placeholder: 'Ex. 2027-01' },
      { key: 'plannedDays', label: 'Jours prévus', placeholder: '1' },
    ],
  },
};

export const reportSpecificKinds: SpecificSettingKind[] = [
  'auditPlanningWeft',
  'certificateWeft',
  'nonConformityDocument',
  'notificationLetter',
  'specificDocumentTemplate',
];

const record = (
  id: string,
  kind: SpecificSettingKind,
  name: string,
  values: Record<string, string>,
): SpecificSettingRecord => ({ id, kind, name, values, active: true });

export function createInitialSpecificSettings(): SpecificSettingRecord[] {
  return [
    record('sp-toolbox-1', 'toolBox', 'Préparer un audit', { category: 'Préparation', description: 'Liste de vérification avant la visite.', language: 'Français' }),
    record('sp-notice-1', 'notice', 'Utilisation du portail', { category: 'Portail', language: 'Français', content: 'Notice de démonstration locale.' }),
    record('sp-profile-1', 'skillProfile', 'Auditeur système', { category: 'Audit qualité', skills: 'Audit système\nRédaction de rapport', description: 'Profil fictif de démonstration.' }),
    record('sp-planning-1', 'auditPlanningWeft', 'Planning de surveillance', { auditType: 'Surveillance', durationDays: '2', language: 'Français' }),
    record('sp-certificate-1', 'certificateWeft', 'Certificat ISO 9001', { standard: 'ISO 9001', language: 'Français', templateName: 'certificat-iso9001-fr' }),
    record('sp-nc-1', 'nonConformityDocument', 'Fiche de non-conformité', { documentKind: 'Fiche de non-conformité', language: 'Français', templateName: 'non-conformite-fr' }),
    record('sp-letter-1', 'notificationLetter', 'Notification de décision', { trigger: 'Décision de certification', language: 'Français', templateName: 'notification-decision-fr' }),
    record('sp-specific-doc-1', 'specificDocumentTemplate', 'Document spécifique de démonstration', { documentKind: 'Document spécifique', language: 'Français', templateLogicalName: 'document-specifique-fr' }),
    record('sp-cert-status-1', 'certificationStatus', 'ISO 9001 · Valide', { standard: 'ISO 9001', certificationType: 'Système', status: 'Valide', order: '1' }),
    record('sp-equipment-1', 'equipmentSupplier', 'Métrologie Démo', { company: 'Métrologie Démo', technician: 'Technicien fictif', specialty: 'Équipement de mesure', contact: 'contact@example.test' }),
    record('sp-checklist-1', 'checklist', 'Checklist de préparation', { language: 'Français', sections: 'Documents requis\nÉquipe d’audit\nPlanning confirmé' }),
    record('sp-workload-1', 'workload', 'Préparation · Audit 2027', { audit: 'Audit 2027 · 11', resource: 'Équipe Démo', period: '2027-01', plannedDays: '2' }),
    ...createCertificateExamples(),
    ...createCertificationStatusExamples(),
  ];
}
