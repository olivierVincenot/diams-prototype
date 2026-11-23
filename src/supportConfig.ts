import type { DocumentLocale, EntityKind } from './types';

export const supportModeStorageKey = 'diams-tools-support-it';

export const technicalMappings = {
  taskTemplates: {
    label: 'Modèles de tâches',
    tables: ['TableDémo01', 'TableDémo02'],
  },
  taskMatrices: {
    label: 'Matrices',
    tables: ['TableDémo03', 'TableDémo04'],
  },
  taskMatrixAssociations: {
    label: 'Association tâches / matrices',
    tables: ['TableDémo05'],
  },
  documentTypes: {
    label: 'Types de documents',
    tables: ['TableDémo06', 'TableDémo07'],
  },
  documentTemplates: {
    label: 'Modèles de documents',
    tables: ['TableDémo08', 'TableDémo09', 'TableDémo10'],
  },
  documentTaskAssociations: {
    label: 'Association documents / tâches',
    tables: ['TableDémo11'],
  },
  templateScripts: {
    label: 'Scripts associés aux templates',
    tables: ['TableDémo12'],
  },
  toolBoxes: {
    label: 'Boîte à outils',
    tables: ['TableDémo13', 'TableDémo14'],
  },
  notices: {
    label: 'Notices',
    tables: ['TableDémo15', 'TableDémo16'],
  },
  skillCategories: {
    label: 'Compétences / profils',
    tables: ['TableDémo17', 'TableDémo18'],
  },
  reportFrames: {
    label: 'Trames de rapports',
    tables: ['TableDémo19'],
  },
  auditPlanningWefts: {
    label: 'Trames de planning',
    tables: ['TableDémo20'],
  },
  certificateWefts: {
    label: 'Trames de certificats',
    tables: ['TableDémo21'],
  },
  nonConformityDocuments: {
    label: 'Documents de non-conformité',
    tables: ['TableDémo22'],
  },
  notificationLetters: {
    label: 'Courriers de notification',
    tables: ['TableDémo23'],
  },
  specificDocumentTemplates: {
    label: 'Modèles de documents spécifiques',
    tables: ['TableDémo08', 'TableDémo09'],
  },
  certificationStatusMatrix: {
    label: 'Matrice des statuts de certification',
    tables: ['TableDémo24'],
  },
  equipmentSuppliers: {
    label: 'Équipementiers',
    tables: ['TableDémo25'],
  },
  checklists: {
    label: 'Checklist',
    tables: ['TableDémo26', 'TableDémo27', 'TableDémo28', 'TableDémo29'],
  },
  processTasks: {
    label: 'Tâches de Process',
    tables: ['TableDémo30'],
  },
  comments: {
    label: 'Commentaires',
    tables: ['TableDémo31'],
  },
} as const;

export type TechnicalMappingKey = keyof typeof technicalMappings;

const supportIdSeeds = [2166136261, 2246822519, 3266489917, 668265263];

export function fakeTechnicalId(domain: string, id: string): string {
  const source = `${domain}:${id}`;
  const hex = supportIdSeeds.map(seed => {
    let hash = seed;
    for (let index = 0; index < source.length; index++) {
      hash = Math.imul(hash ^ source.charCodeAt(index), 16777619) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }).join('');
  const uuid = `${hex.slice(0, 12)}4${hex.slice(13, 16)}8${hex.slice(17)}`;
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

export function entityTechnicalId(kind: EntityKind, id: string): string {
  return fakeTechnicalId(kind === 'auditType' ? 'audit-type' : `entity-${kind}`, id);
}

export function documentTemplateTechnicalId(documentId: string): string {
  return fakeTechnicalId('document', documentId);
}

export function documentTemplateDescriptionTechnicalId(documentId: string, locale: DocumentLocale): string {
  return fakeTechnicalId(`document-template-description-${locale}`, documentId);
}

