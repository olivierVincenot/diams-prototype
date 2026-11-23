export interface ExportAudit {
  id: string;
  scheme: string;
  certification: string;
  certificationType: string;
  periodicity: string;
  auditType: string;
  durationTA: string;
  cycleStart: string;
  standard: string;
  company: string;
  auditStart: string;
  auditEnd: string;
  startPeriod: string;
  endPeriod: string;
  durationPA: string;
  status: string;
  site: string;
  postalCity: string;
  auditorId: string;
  contacts: MissionContact[];
  sites: MissionSite[];
}

export interface MissionContact {
  role: string;
  name: string;
  email: string;
  phone: string;
  mobile: string;
}

export interface MissionSite {
  name: string;
  activity: string;
  address: string;
  postalCity: string;
  country: string;
}

export interface ExportAuditor {
  id: string;
  title: string;
  lastName: string;
  firstName: string;
  email: string;
  entity: string;
  language: string;
}

export const demoAuditors: ExportAuditor[] = [
  { id: 'demo-auditor-1', title: 'Mme', lastName: 'Martin', firstName: 'Alex', email: 'alex.martin@example.com', entity: 'Équipe Démo', language: 'Français' },
  { id: 'demo-auditor-2', title: 'M.', lastName: 'Durand', firstName: 'Camille', email: 'camille.durand@example.com', entity: 'Équipe Démo', language: 'Anglais' },
];

const demoContacts: MissionContact[] = [
  { role: 'Chargé commercial', name: 'Équipe commerciale Démo', email: 'commercial@example.com', phone: '', mobile: '' },
  { role: 'Correspondant d’audit', name: 'Correspondant Démo', email: 'correspondant@example.com', phone: '', mobile: '' },
  { role: 'Expert', name: 'Expert Démo', email: 'expert@example.com', phone: '', mobile: '' },
];

export const demoExportAudits: ExportAudit[] = [
  { id: 'demo-extraction-audit-1', scheme: 'Schéma Démo Nord', certification: 'Certification Démo Nord', certificationType: 'Système', periodicity: '24', auditType: 'Renouvellement', durationTA: '1,00', cycleStart: '2026-11-23', standard: 'ISO 9001', company: 'Entreprise Démo Nord', auditStart: '2026-12-03', auditEnd: '2026-12-03', startPeriod: 'matin', endPeriod: 'après-midi', durationPA: '1,00', status: 'Planifié', site: 'Site Démo Nord', postalCity: '59000 Lille', auditorId: 'demo-auditor-1', contacts: [...demoContacts, { role: 'Responsable d’audit', name: 'Alex Martin', email: 'alex.martin@example.com', phone: '', mobile: '' }], sites: [{ name: 'Site Démo Nord', activity: 'Production', address: 'Adresse de démonstration', postalCity: '59000 Lille', country: 'France' }] },
  { id: 'demo-extraction-audit-2', scheme: 'Schéma Démo Sud', certification: 'Certification Démo Sud', certificationType: 'Qualification réglementaire', periodicity: '24', auditType: 'Initial', durationTA: '0,50', cycleStart: '2026-12-14', standard: 'Réglementation Démo', company: 'Entreprise Démo Sud', auditStart: '2026-12-17', auditEnd: '2026-12-17', startPeriod: 'matin', endPeriod: 'matin', durationPA: '0,50', status: 'Planifié', site: 'Site Démo Sud', postalCity: '31000 Toulouse', auditorId: 'demo-auditor-1', contacts: [...demoContacts, { role: 'Responsable d’audit', name: 'Alex Martin', email: 'alex.martin@example.com', phone: '', mobile: '' }], sites: [{ name: 'Site Démo Sud', activity: 'Production', address: 'Adresse de démonstration', postalCity: '31000 Toulouse', country: 'France' }] },
  { id: 'demo-extraction-audit-3', scheme: 'Schéma Démo Ouest', certification: 'Certification Démo Ouest', certificationType: 'Système', periodicity: '36', auditType: 'Surveillance', durationTA: '1,50', cycleStart: '2027-01-05', standard: 'ISO 14001', company: 'Entreprise Démo Ouest', auditStart: '2027-01-12', auditEnd: '2027-01-13', startPeriod: 'matin', endPeriod: 'matin', durationPA: '1,50', status: 'Planifié', site: 'Site Démo Ouest', postalCity: '44000 Nantes', auditorId: 'demo-auditor-2', contacts: [...demoContacts, { role: 'Responsable d’audit', name: 'Camille Durand', email: 'camille.durand@example.com', phone: '', mobile: '' }], sites: [{ name: 'Site Démo Ouest', activity: 'Production', address: 'Adresse de démonstration', postalCity: '44000 Nantes', country: 'France' }] },
];

export const workloadColumns = [
  { key: 'scheme', label: 'Schéma' },
  { key: 'certification', label: 'Certification' },
  { key: 'periodicity', label: 'Périodicité (mois)' },
  { key: 'auditType', label: 'Type d’audit' },
  { key: 'durationTA', label: 'Durée TA' },
  { key: 'cycleStart', label: 'Date début cycle' },
  { key: 'week', label: 'Semaine' },
  { key: 'standard', label: 'Norme' },
  { key: 'company', label: 'Entreprise' },
  { key: 'auditStart', label: 'Début audit' },
  { key: 'durationPA', label: 'Durée PA' },
  { key: 'status', label: 'Statut' },
  { key: 'site', label: 'Site' },
  { key: 'postalCity', label: 'CP - Ville' },
] as const;
export type WorkloadColumn = typeof workloadColumns[number]['key'];

export function isoWeek(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return String(Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7));
}

export function filterExportAudits(audits: ExportAudit[], start: string, end: string, certificationType: string, dateField: 'cycleStart' | 'auditStart', auditorId = ''): ExportAudit[] {
  return audits.filter(audit => (dateField === 'auditStart' ? audit.auditStart <= end && audit.auditEnd >= start : audit.cycleStart >= start && audit.cycleStart <= end) &&
    (!certificationType || audit.certificationType === certificationType) && (!auditorId || audit.auditorId === auditorId));
}

export function missionDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function missionEmailDraft(auditor: ExportAuditor, audits: ExportAudit[], start: string, end: string): { href: string; body: string; requiresPaste: boolean } {
  const subject = `Ordre de mission du ${missionDate(start)} au ${missionDate(end)} (démonstration)`;
  const lines = [
    `Bonjour ${auditor.firstName} ${auditor.lastName},`,
    '',
    `Voici votre ordre de mission fictif du ${missionDate(start)} au ${missionDate(end)}.`,
    ...audits.flatMap(audit => [
      '',
      `Semaine ${isoWeek(audit.auditStart)} · du ${missionDate(audit.auditStart)} (${audit.startPeriod}) au ${missionDate(audit.auditEnd)} (${audit.endPeriod}) · ${audit.durationPA} jour(s)`,
      `Type d’audit : ${audit.auditType}`,
      `Schéma : ${audit.scheme}`,
      `Certification : ${audit.certification}`,
      `Intervenants :`,
      ...audit.contacts.map(contact => `- ${contact.role} : ${contact.name} · ${contact.email || 'Email non renseigné'} · Tél. ${contact.phone || 'non renseigné'} · Mobile ${contact.mobile || 'non renseigné'}`),
      `Norme(s) : ${audit.standard}`,
      `Entreprise : ${audit.company}`,
      'Site(s) :',
      ...audit.sites.map(site => `- ${site.name} (${site.activity}) · ${[site.address, site.postalCity, site.country].filter(Boolean).join(', ')}`),
    ]),
    '',
    'Données fictives de démonstration.',
  ];
  const body = lines.join('\r\n');
  const address = `mailto:${encodeURIComponent(auditor.email)}?subject=${encodeURIComponent(subject)}`;
  const full = `${address}&body=${encodeURIComponent(body)}`;
  const requiresPaste = full.length > 1800;
  return { href: requiresPaste ? address : full, body, requiresPaste };
}

export function workloadValue(audit: ExportAudit, column: WorkloadColumn): string {
  return column === 'week' ? isoWeek(audit.cycleStart) : audit[column];
}

export function workloadCsv(audits: ExportAudit[], columns: WorkloadColumn[]): string {
  const safeCell = (value: string) => {
    const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const selected = workloadColumns.filter(column => columns.includes(column.key));
  return '\uFEFF' + [selected.map(column => column.label), ...audits.map(audit => selected.map(column => workloadValue(audit, column.key)))]
    .map(row => row.map(safeCell).join(';')).join('\r\n');
}
