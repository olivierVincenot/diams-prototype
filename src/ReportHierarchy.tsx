import { useState, type ReactNode } from 'react';
import { ChevronRight, GitBranch, Layers, List, Network, RotateCcw } from 'lucide-react';
import { alphabetic, reportPathMatches, unassignedReportScope } from './domain';
import { Badge, Empty } from './ui';

export function ReportHierarchy<T>({ records, pathsFor, children }: {
  records: T[];
  pathsFor: (record: T) => string[][];
  children: (records: T[]) => ReactNode;
}) {
  const [view, setView] = useState('map');
  const [selection, setSelection] = useState<string[]>([]);
  const entries = records.map(record => ({ record, paths: pathsFor(record) }));
  const paths = entries.flatMap(entry => entry.paths);
  const labels = ['Type de norme', 'Norme(s)', 'Types d’audit'];
  const labelFor = (value: string) => value === unassignedReportScope ? 'Non renseigné' : value;
  const validSelection: string[] = [];
  for (const value of selection) {
    if (!paths.some(path => reportPathMatches(path, [...validSelection, value]))) break;
    validSelection.push(value);
  }
  const filtered = entries.filter(entry => entry.paths.some(path => reportPathMatches(path, validSelection))).map(entry => entry.record);

  return <div className="report-hierarchy">
    <div className="panel map-panel">
      <div className="panel-heading">
        <h3><GitBranch size={18} />Cartographie des trames</h3>
        <div className="segmented" aria-label="Mode d’affichage des trames">
          <button className={view === 'map' ? 'selected' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')}><Network size={16} />Cartographie</button>
          <button className={view === 'table' ? 'selected' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={16} />Liste complète</button>
        </div>
      </div>
      {view === 'map' && <div className="tree">
        <div className="tree-hint">TYPE DE NORME <ChevronRight size={12} /> NORME(S) <ChevronRight size={12} /> TYPES D’AUDIT</div>
        <div className="org-chart report-org-chart" aria-label="Cartographie des trames en trois niveaux">
          {labels.map((label, level) => {
            const prefix = validSelection.slice(0, level);
            const available = alphabetic([...new Set(paths.filter(path => reportPathMatches(path, prefix)).map(path => path[level]))], labelFor);
            return <section className="org-column" key={label} aria-label={label}>
              <h4 className="org-column-heading">{label.toLocaleUpperCase('fr')}</h4>
              {validSelection.length >= level ? <div className="org-node-list">
                {available.map(value => {
                  const count = entries.filter(entry => entry.paths.some(path => reportPathMatches(path, [...prefix, value]))).length;
                  return <button type="button" key={value} className={`org-node ${validSelection[level] === value ? 'selected' : ''}`}
                    aria-pressed={validSelection[level] === value}
                    onClick={() => setSelection(validSelection[level] === value ? prefix : [...prefix, value])}>
                    <span className="org-node-icon"><Layers size={17} /></span>
                    <span className="org-node-copy"><strong>{labelFor(value)}</strong><small>{count} enregistrement(s)</small></span>
                    <ChevronRight size={14} />
                  </button>;
                })}
                {!available.length && <p className="org-empty">Aucune trame disponible.</p>}
              </div> : <p className="org-empty">Sélectionnez {level === 1 ? 'un type de norme' : 'une norme'}.</p>}
            </section>;
          })}
        </div>
        {!!validSelection.length && <button type="button" className="btn small" onClick={() => setSelection([])}><RotateCcw size={14} />Effacer la sélection</button>}
      </div>}
    </div>
    {view === 'table' ? children(records) : validSelection.length >= 2 ? <>
      <div className="report-branch-heading"><h3>{validSelection.map(labelFor).join(' → ')}{validSelection.length === 2 && ' → Tous les types d’audit concernés'}</h3><Badge>{filtered.length} enregistrement(s)</Badge></div>
      {children(filtered)}
    </> : <div className="panel"><Empty>{records.length
      ? 'Sélectionnez un type de norme puis une norme pour afficher toutes les trames associées. Le type d’audit permet ensuite d’affiner les résultats.'
      : 'Ajoutez une trame pour commencer le paramétrage.'}</Empty></div>}
  </div>;
}
