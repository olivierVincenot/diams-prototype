import { useState, type ReactNode } from 'react';
import { FileText, Layers, List } from 'lucide-react';
import { groupRecordsByTemplate, type TemplateAssociation } from './domain';
import { Badge, Empty } from './ui';

export function TemplateName({ name }: { name: string }) {
  return <div className="template-name">
    <FileText size={20} />
    <div><small>Template</small><strong>{name.trim() || 'Template non renseigné'}</strong></div>
  </div>;
}

export function ReportTemplateView<T>({ records, describe, children }: {
  records: T[];
  describe: (record: T) => TemplateAssociation;
  children: (records: T[]) => ReactNode;
}) {
  const [view, setView] = useState('records');
  const groups = groupRecordsByTemplate(records, describe);
  return <div className="report-template-view">
    <div className="template-view-toolbar">
      <div><h3>Détail des associations</h3><p>Regroupement de la sélection courante. Utilisez « Liste complète » pour comparer toutes les normes.</p></div>
      <div className="segmented" aria-label="Présentation des associations">
        <button type="button" aria-pressed={view === 'records'} className={view === 'records' ? 'selected' : ''} onClick={() => setView('records')}><List size={16} />Par fiche</button>
        <button type="button" aria-pressed={view === 'templates'} className={view === 'templates' ? 'selected' : ''} onClick={() => setView('templates')}><Layers size={16} />Par template</button>
      </div>
    </div>
    {view === 'records' ? children(records) : !groups.length ? <Empty /> : <div className="template-group-list">
      {groups.map(group => <section className={`template-group ${group.template && group.auditTypes.length > 1 ? 'shared' : ''}`} key={group.template}>
        <div className="template-group-heading">
          <TemplateName name={group.template} />
          <Badge tone={group.template && group.auditTypes.length > 1 ? 'green' : 'neutral'}>
            {group.template && group.auditTypes.length > 1 ? 'Partagé · ' : ''}{group.auditTypes.length} type{group.auditTypes.length > 1 ? 's' : ''} d’audit renseigné{group.auditTypes.length > 1 ? 's' : ''}
          </Badge>
        </div>
        <dl className="template-association-summary">
          <div><dt>Types d’audit distincts</dt><dd>{group.auditTypes.length
            ? group.auditTypes.map(value => <Badge key={value} tone="blue">{value}</Badge>)
            : 'Non renseigné'}</dd></div>
          <div><dt>Norme(s)</dt><dd>{group.standards.length ? group.standards.map(value => <Badge key={value}>{value}</Badge>) : 'Non renseigné'}</dd></div>
          <div><dt>Langue(s)</dt><dd>{group.languages.length ? group.languages.join(', ') : 'Non renseigné'}</dd></div>
          <div><dt>Fiches associées</dt><dd>{group.records.length}</dd></div>
        </dl>
        {!!group.unassignedAuditRecords && <p className="template-unassigned">{group.unassignedAuditRecords} fiche(s) sans type d’audit renseigné ; elles ne sont pas comptées comme un type d’audit.</p>}
        {!group.template && <p className="template-unassigned">Le nom manquant ne permet pas de conclure que ces fiches utilisent un template identique.</p>}
        <details className="template-group-details">
          <summary>Voir les {group.records.length} fiche(s) associée(s)</summary>
          {children(group.records)}
        </details>
      </section>)}
    </div>}
  </div>;
}
