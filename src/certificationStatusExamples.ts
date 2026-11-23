import type { SpecificSettingRecord } from './types';

const transitions: [string, string, string, string][] = [
  ['Favorable', 'En attente', 'Valide', 'Audit Démo A'],
  ['Défavorable', 'En attente', 'Refusé', 'Audit Démo A'],
  ['Favorable', 'Valide', 'Valide', 'Audit Démo B'],
  ['Défavorable', 'Valide', 'Suspendu', 'Audit Démo B'],
  ['Favorable', 'Suspendu', 'Valide', 'Audit Démo C'],
  ['Défavorable', 'Suspendu', 'Retiré', 'Audit Démo C'],
];

export function createCertificationStatusExamples(): SpecificSettingRecord[] {
  return Array.from({ length: 83 }, (_, index) => {
    const [decision, originStatus, destinationStatus, auditType] =
      index >= 79 ? ['', '', '', 'Audit Démo D'] : transitions[index % transitions.length];
    return {
      id: `demo-certification-status-row-${index + 2}`,
      kind: 'certificationStatus',
      name: `${originStatus || 'Non renseigné'} → ${destinationStatus || 'Non renseigné'} · ${decision || 'Non renseigné'} · ${auditType}`,
      active: true,
      values: { decision, originStatus, destinationStatus, auditType },
    };
  });
}
