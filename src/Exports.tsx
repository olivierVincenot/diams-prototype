import { useState } from 'react';
import { Download, FileSpreadsheet, Mail, Search, Settings2 } from 'lucide-react';
import type { Commit, Data, Impact } from './types';
import { demoAuditors, demoExportAudits, filterExportAudits, isoWeek, missionDate, missionEmailDraft, workloadColumns, workloadCsv, workloadValue, type ExportAudit, type WorkloadColumn } from './exportData';
import { fakeTechnicalId } from './supportConfig';
import { Badge, CheckField, CopyValueButton, Empty, Field, Notice, SectionTitle, Select, TechnicalInlineId } from './ui';
import { SpecificSettings } from './SpecificSettings';

type Props = { data: Data; commit: Commit; confirm: (impact: Impact) => void; supportMode: boolean };
type Filters = { start: string; end: string; certificationType: string };
const initialFilters: Filters = { start: '2026-11-23', end: '2027-01-31', certificationType: '' };
const certificationTypes = [...new Set(demoExportAudits.map(audit => audit.certificationType))];

function downloadCsv(audits: ExportAudit[], columns: WorkloadColumn[]) {
  const blob = new Blob([workloadCsv(audits, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plan-de-charge-demo.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function FilterFields({ filters, onChange, periodLabel }: { filters: Filters; onChange: (filters: Filters) => void; periodLabel: string }) {
  return <div className="export-filters">
    <Field label={`${periodLabel} : du`}><input type="date" required value={filters.start} onChange={event => onChange({ ...filters, start: event.target.value })} /></Field>
    <Field label="Au"><input type="date" required value={filters.end} onChange={event => onChange({ ...filters, end: event.target.value })} /></Field>
    <Select label="Type de certifications (facultatif)" value={filters.certificationType}
      options={[{ value: '', label: 'Toutes les certifications' }, ...certificationTypes]}
      onChange={certificationType => onChange({ ...filters, certificationType })} />
  </div>;
}

export function Exports({ data, commit, confirm, supportMode }: Props) {
  const [view, setView] = useState<'workload' | 'mission'>('workload');
  const [columns, setColumns] = useState<WorkloadColumn[]>(() => workloadColumns.map(column => column.key));
  return <>
    <SectionTitle eyebrow="EXTRACTIONS / DONNÉES" title="Exporter" description="Préparez vos extractions et ordres de mission dans un espace dédié." />
    <div className="specific-settings-layout">
      <nav className="panel specific-settings-nav" aria-label="Types d’extraction">
        <button type="button" className={`specific-settings-nav-item ${view === 'workload' ? 'active' : ''}`} aria-current={view === 'workload' ? 'page' : undefined} onClick={() => setView('workload')}><span>Plan de charge</span><FileSpreadsheet size={16} /></button>
        <button type="button" className={`specific-settings-nav-item ${view === 'mission' ? 'active' : ''}`} aria-current={view === 'mission' ? 'page' : undefined} onClick={() => setView('mission')}><span>Ordre de mission</span><Mail size={16} /></button>
      </nav>
      <section className="panel export-panel">
        <Notice>Exemples fictifs indépendants des audits de la maquette : aucune extraction DIAMS ni aucun service d’envoi automatique n’est connecté.</Notice>
        {view === 'workload' ? <Workload supportMode={supportMode} columns={columns} onColumnsChange={setColumns} /> : <Mission supportMode={supportMode} />}
        {view === 'workload' && data.specificSettings.some(item => item.kind === 'workload') && <details className="legacy-workload">
          <summary>Anciennes entrées locales du plan de charge</summary>
          <p>Ces fiches précédemment saisies restent disponibles ici ; elles ne sont pas incluses dans l’extraction fictive.</p>
          <SpecificSettings data={data} commit={commit} confirm={confirm} supportMode={supportMode} allowedKinds={['workload']} showSectionTitle={false} />
        </details>}
      </section>
    </div>
  </>;
}

function Workload({ supportMode, columns, onColumnsChange }: { supportMode: boolean; columns: WorkloadColumn[]; onColumnsChange: (columns: WorkloadColumn[]) => void }) {
  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState<ExportAudit[] | null>(() => filterExportAudits(demoExportAudits, initialFilters.start, initialFilters.end, '', 'cycleStart'));
  const [error, setError] = useState('');
  const search = () => {
    if (filters.start > filters.end) { setError('La date de début doit précéder ou égaler la date de fin.'); setResults(null); return; }
    setError('');
    setResults(filterExportAudits(demoExportAudits, filters.start, filters.end, filters.certificationType, 'cycleStart'));
  };
  const selectedColumns = workloadColumns.filter(column => columns.includes(column.key));
  return <>
    <div className="export-heading"><div><h2>Plan de charge</h2><p>Audits à planifier selon la date de début du cycle.</p></div><Badge tone="blue">Extraction CSV</Badge></div>
    <form onSubmit={event => { event.preventDefault(); search(); }}>
      <FilterFields filters={filters} onChange={next => { setFilters(next); setResults(null); setError(''); }} periodLabel="Période de référence" />
      <div className="export-actions"><button className="btn primary" type="submit"><Search size={16} />Rechercher</button>
        <button className="btn" type="button" disabled={!results?.length || !columns.length} onClick={() => {
          try { downloadCsv(results ?? [], columns); setError(''); }
          catch (cause) { setError(`Export impossible : ${cause instanceof Error ? cause.message : String(cause)}`); }
        }}><Download size={16} />Exporter en CSV</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
    <details className="export-columns"><summary><Settings2 size={16} />Personnaliser les colonnes <Badge>{columns.length} / {workloadColumns.length}</Badge></summary>
      <p>Décochez les colonnes à masquer dans le tableau et le fichier exporté. Les identifiants du mode Support IT ne sont pas inclus dans le CSV.</p>
      <div className="export-column-options">{workloadColumns.map(column => <CheckField key={column.key} checked={columns.includes(column.key)} onChange={checked => onColumnsChange(checked ? [...columns, column.key] : columns.filter(key => key !== column.key))}>{column.label}</CheckField>)}</div>
    </details>
    <div className="export-result-heading"><h3>Liste des audits à planifier</h3><Badge>{results === null ? 'Recherche à lancer' : `${results.length} résultat(s)`}</Badge></div>
    {results === null ? <Empty>Modifiez les critères puis lancez la recherche.</Empty> : !results.length ? <Empty>Aucun audit fictif pour cette sélection.</Empty> : !selectedColumns.length ? <Empty>Sélectionnez au moins une colonne pour afficher et exporter les résultats.</Empty> :
      <div className="table-scroll"><table className="export-table"><thead><tr>{selectedColumns.map(column => <th key={column.key}>{column.label}</th>)}{supportMode && <th>Identifiant simulé</th>}</tr></thead>
        <tbody>{results.map(audit => <tr key={audit.id}>{selectedColumns.map(column => <td key={column.key}>{workloadValue(audit, column.key) || '—'}</td>)}{supportMode && <td><TechnicalInlineId value={fakeTechnicalId('export-demo-audit', audit.id)} /></td>}</tr>)}</tbody></table></div>}
  </>;
}

function Mission({ supportMode }: { supportMode: boolean }) {
  const [filters, setFilters] = useState(initialFilters);
  const [auditorId, setAuditorId] = useState('');
  const [missions, setMissions] = useState<ExportAudit[] | null>(null);
  const [error, setError] = useState('');
  const selectedAuditor = demoAuditors.find(auditor => auditor.id === auditorId);
  const emailDraft = selectedAuditor && missions?.length ? missionEmailDraft(selectedAuditor, missions, filters.start, filters.end) : null;
  const clearPreview = () => { setMissions(null); setError(''); };
  return <>
    <div className="export-heading"><div><h2>Ordre de mission</h2><p>Choisissez une période d’audit et un auditeur actif pour préparer les missions.</p></div><Badge tone="blue">Prévisualisation</Badge></div>
    <form onSubmit={event => {
      event.preventDefault();
      if (filters.start > filters.end) { setError('La date de début doit précéder ou égaler la date de fin.'); return; }
      if (!auditorId) { setError('Sélectionnez un auditeur.'); return; }
      setError('');
      setMissions(filterExportAudits(demoExportAudits, filters.start, filters.end, filters.certificationType, 'auditStart', auditorId)
        .sort((left, right) => left.auditStart.localeCompare(right.auditStart)));
    }}>
      <FilterFields filters={filters} onChange={next => { setFilters(next); clearPreview(); }} periodLabel="Période d’audit" />
      {filters.start && <p className="mission-week">À partir de la semaine n° {isoWeek(filters.start)}</p>}
      <div className="export-result-heading"><h3>Liste des auditeurs actifs</h3><Badge>{demoAuditors.length} auditeurs fictifs</Badge></div>
      <div className="table-scroll"><table className="auditor-table"><thead><tr><th>Sélection</th><th>Civilité</th><th>Nom</th><th>Prénom</th><th>Email</th><th>Entité</th>{supportMode && <th>Identifiants simulés</th>}</tr></thead>
        <tbody>{demoAuditors.map(auditor => <tr key={auditor.id}><td><label className="auditor-radio"><input type="radio" name="auditor" checked={auditorId === auditor.id} onChange={() => { setAuditorId(auditor.id); clearPreview(); }} /><span className="sr-only">Sélectionner {auditor.firstName} {auditor.lastName}</span></label></td><td>{auditor.title}</td><td>{auditor.lastName}</td><td>{auditor.firstName}</td><td>{auditor.email}</td><td>{auditor.entity}</td>
          {supportMode && <td><TechnicalInlineId label="Auditeur" value={fakeTechnicalId('export-demo-auditor', auditor.id)} /><TechnicalInlineId label="Langue utilisateur" value={fakeTechnicalId('export-demo-user-language', auditor.id)} /></td>}</tr>)}</tbody></table></div>
      <div className="export-actions"><button className="btn primary" type="submit"><Search size={16} />Afficher l’ordre de mission</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
    <div className="export-result-heading"><h3>Détail des missions</h3><Badge>{missions === null ? 'En attente' : `${missions.length} mission(s)`}</Badge></div>
    {missions === null ? <Empty>Sélectionnez un auditeur et affichez son ordre de mission.</Empty> : !missions.length ? <Empty>Aucune mission fictive pour cet auditeur et cette période.</Empty> : selectedAuditor && emailDraft && <>
      <p className="mission-caption">Ordre de mission de {selectedAuditor.firstName} {selectedAuditor.lastName} · {selectedAuditor.email}</p>
      <div className="mission-list">{missions.map(audit => <article className="mission-card" key={audit.id}>
        <header className="mission-card-header"><div><Badge tone="blue">Semaine {isoWeek(audit.auditStart)}</Badge><strong>Du {missionDate(audit.auditStart)} ({audit.startPeriod}) au {missionDate(audit.auditEnd)} ({audit.endPeriod})</strong></div><Badge>{audit.durationPA} jour(s)</Badge></header>
        {supportMode && <TechnicalInlineId value={fakeTechnicalId('export-demo-audit', audit.id)} />}
        <dl className="mission-meta"><div><dt>Type d’audit</dt><dd>{audit.auditType}</dd></div><div><dt>Schéma</dt><dd>{audit.scheme}</dd></div><div><dt>Certification</dt><dd>{audit.certification}</dd></div></dl>
        <section><h4>Intervenants</h4><div className="table-scroll"><table className="mission-contacts"><thead><tr><th>Rôle</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Mobile</th></tr></thead><tbody>
          {audit.contacts.map((contact, index) => <tr key={`${contact.role}-${index}`}><td>{contact.role}</td><td>{contact.name}</td><td>{contact.email || 'Non renseigné'}</td><td>{contact.phone || 'Non renseigné'}</td><td>{contact.mobile || 'Non renseigné'}</td></tr>)}
        </tbody></table></div></section>
        <div className="mission-details"><div><h4>Norme(s)</h4><p>{audit.standard}</p></div><div><h4>Entreprise</h4><p>{audit.company}</p></div><div><h4>Site(s)</h4>
          {audit.sites.map((site, index) => <p key={`${site.name}-${index}`}><strong>{site.name}</strong> · {site.activity}<br />{site.address}<br />{site.postalCity} · {site.country}</p>)}</div></div>
      </article>)}</div>
      <div className="export-actions"><a className="btn primary" href={emailDraft.href}><Mail size={16} />Préparer l’email à l’auditeur</a><CopyValueButton value={emailDraft.body} label="le texte de l’ordre de mission" /></div>
      {emailDraft.requiresPaste && <Notice warning>Le détail est trop long pour certains logiciels de messagerie : copiez le texte ci-dessus et collez-le dans le brouillon ouvert.</Notice>}
      <Notice>Le bouton ouvre votre logiciel de messagerie avec un brouillon à vérifier et à envoyer vous-même. Les adresses et missions affichées sont fictives ; aucun envoi automatique n’est effectué.</Notice>
    </>}
  </>;
}
