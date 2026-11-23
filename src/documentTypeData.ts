import type { DocumentType } from './types';

export function createDocumentType(id: string, name = ''): DocumentType {
  return {
    id, name, active: true, required: false, companySpace: false, siteLinked: false,
    visibleCorrespondents: false, visibleExternalAuditors: false, visibleStaff: false,
    labels: { fr: name, en: '', ko: '' }, descriptions: { fr: '', en: '', ko: '' },
    languageActive: { fr: true, en: true, ko: true },
  };
}

export function createInitialDocumentTypes(): DocumentType[] {
  const examples: [string, boolean, boolean, boolean, boolean, boolean, boolean][] = [
    ['Catégorie Démo 01', true, true, false, true, false, true],
    ['Catégorie Démo 02', true, true, true, true, true, true],
    ['Catégorie Démo 03', true, false, false, true, false, true],
    ['Catégorie Démo 04', true, false, false, true, true, true],
    ['Catégorie Démo 05', true, false, false, false, true, true],
    ['Catégorie Démo 06', true, false, false, false, false, true],
    ['Catégorie Démo 07', true, false, false, true, false, false],
    ['Catégorie Démo 08', false, false, false, false, true, true],
    ['Catégorie Démo 09', true, false, false, false, false, true],
    ['Catégorie Démo 10', false, false, false, true, true, true],
    ['Catégorie Démo 11', true, false, false, false, true, true],
    ['Catégorie Démo 12', true, true, false, true, false, true],
    ['Catégorie Démo 13', false, true, false, true, false, true],
    ['Catégorie Démo 14', true, true, false, false, true, true],
    ['Catégorie Démo 15', true, true, false, true, true, true],
    ['Certificat pour compatibilité système', true, false, false, false, true, true],
    ['Certificat signé', true, false, false, true, true, true],
    ['Courrier de certification', false, true, false, true, true, true],
    ['Courrier de notification pour compatibilité système', true, false, false, false, true, true],
    ['Non conformité pour compatibilité système', true, false, false, true, true, true],
    ["Planning d'audit pour compatibilité système", false, false, false, false, false, false],
    ["Rapport d'audit pour compatibilité système", false, false, false, false, false, false],
    ['Certificat', false, false, false, false, false, false],
    ['Courrier', false, false, false, false, false, false],
    ['Ordre de mission', false, false, false, false, false, false],
    ['Rapport', false, false, false, false, false, false],
  ];
  return examples.map(([name, required, companySpace, siteLinked, visibleCorrespondents, visibleExternalAuditors, visibleStaff], index) => ({
    ...createDocumentType(`demo-document-type-${index + 1}`, name),
    required, companySpace, siteLinked, visibleCorrespondents, visibleExternalAuditors, visibleStaff,
  }));
}
