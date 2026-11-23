import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Copy, GitBranch, Languages, Layers, List, Network, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Commit, Data, Impact, Matrix } from './types';
import { alphabetic, completeMissingTranslations, deleteMatrix, expandMatrixAuditSelection, knownTextTranslations, matches, matchesFilter, matricesForAuditKind, matrixImpact, matrixKindsForAudit, matrixStandardLabel, propagateMatrix, type MatrixAuditSelection } from './domain';
import { matrixCertificationTypes, matrixStandardTypes } from './data';
import { Badge, CheckField, CopyValueButton, Empty, Field, FilterDropdown, FormActions, Modal, MultiSelectDropdown, Notice, SearchBox, SectionTitle, Select, Status, TechnicalInfo, TechnicalInlineId } from './ui';
import { documentTemplateTechnicalId, entityTechnicalId, fakeTechnicalId, technicalMappings } from './supportConfig';

type Props = { data: Data; commit: Commit; confirm: (impact: Impact) => void; initialSearch?: string; supportMode?: boolean };
type OrgConnector = { id: string; path: string; active: boolean };
export function Matrices({ data, commit, confirm, initialSearch = '', supportMode = false }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [standard, setStandard] = useState<string[]>([]);
  const [certificationType, setCertificationType] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(initialSearch ? [] : ['active']);
  const [view, setView] = useState('map');
  const [selectedAuditTypeId, setSelectedAuditTypeId] = useState('');
  const [selectedKind, setSelectedKind] = useState<Matrix['kind'] | ''>('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<Matrix | null>(null);
  const [pending, setPending] = useState<({ original: Matrix } & MatrixAuditSelection) | null>(null);
  const [kindListPadding, setKindListPadding] = useState(0);
  const [matrixListPadding, setMatrixListPadding] = useState(0);
  const [orgConnectors, setOrgConnectors] = useState<OrgConnector[]>([]);
  const orgChartRef = useRef<HTMLDivElement>(null);
  const orgNodes = useRef(new Map<string, HTMLElement>());
  const auditName = (id: string) => data.entities.find(e => e.id === id)?.name || 'Type d’audit inconnu';
  const normOptions = alphabetic([...new Set([...matrixStandardTypes, ...data.matrices.filter(m => !m.deleted).map(m => m.standardType)])], norm => norm);
  const certificationOptions = [...new Set([...matrixCertificationTypes, ...data.matrices.filter(m => !m.deleted).map(m => m.certificationType)])].filter(value => value !== '');
  const selectedStandards = standard.map(matrixStandardLabel);
  const visible = alphabetic(data.matrices.filter(m => !m.deleted && matchesFilter(matrixStandardLabel(m.standardType), selectedStandards) &&
    matchesFilter(m.certificationType, certificationType) && matchesFilter(m.active ? 'active' : 'inactive', status) &&
    matches(search, m.name, matrixStandardLabel(m.standardType), auditName(m.auditTypeId), m.kind)), m => m.name);
  const auditTypeIds = new Set(visible.map(m => m.auditTypeId));
  const auditTypes = alphabetic(data.entities.filter(e => e.kind === 'auditType' && auditTypeIds.has(e.id)), e => e.name);
  const hasSelectedAudit = auditTypeIds.has(selectedAuditTypeId);
  const matrixKinds = hasSelectedAudit ? matrixKindsForAudit(visible, selectedAuditTypeId) : [];
  const matricesForSelectedKind = hasSelectedAudit && selectedKind ? matricesForAuditKind(visible, selectedAuditTypeId, selectedKind) : [];
  const auditTypesKey = auditTypes.map(type => type.id).join('|');
  const matrixKindsKey = matrixKinds.join('|');
  const matricesKey = matricesForSelectedKind.map(matrix => matrix.id).join('|');
  const setOrgNode = (key: string, node: HTMLElement | null) => {
    if (node) orgNodes.current.set(key, node);
    else orgNodes.current.delete(key);
  };
  useLayoutEffect(() => {
    const chart = orgChartRef.current;
    if (!chart || view !== 'map') return;

    const alignGroup = (list: HTMLElement | null, selector: string, source: HTMLElement | undefined, setPadding: (value: number) => void) => {
      if (!list || !source) return;
      const nodes = Array.from(list.querySelectorAll<HTMLElement>(selector));
      if (!nodes.length) return;
      const first = nodes[0].getBoundingClientRect();
      const last = nodes[nodes.length - 1].getBoundingClientRect();
      const groupCenter = (first.top + last.bottom) / 2;
      const sourceCenter = (source.getBoundingClientRect().top + source.getBoundingClientRect().bottom) / 2;
      const currentPadding = Number.parseFloat(getComputedStyle(list).paddingTop) || 0;
      const nextPadding = Math.max(0, currentPadding + sourceCenter - groupCenter);
      if (Math.abs(nextPadding - currentPadding) > 0.5) setPadding(nextPadding);
    };

    const updateChart = () => {
      const kindList = chart.querySelector<HTMLElement>('.kind-list');
      const matrixList = chart.querySelector<HTMLElement>('.matrix-list');
      const selectedAudit = orgNodes.current.get(`audit:${selectedAuditTypeId}`);
      const selectedKindNode = orgNodes.current.get(`kind:${selectedKind}`);
      alignGroup(kindList, '.org-kind-node', selectedAudit, setKindListPadding);
      alignGroup(matrixList, '.org-matrix-node', selectedKindNode, setMatrixListPadding);

      const chartRect = chart.getBoundingClientRect();
      const makePath = (from: HTMLElement, to: HTMLElement) => {
        const source = from.getBoundingClientRect();
        const target = to.getBoundingClientRect();
        const startX = source.right - chartRect.left;
        const startY = (source.top + source.bottom) / 2 - chartRect.top;
        const endX = target.left - chartRect.left;
        const endY = (target.top + target.bottom) / 2 - chartRect.top;
        const curve = Math.max(0, (endX - startX) * 0.45);
        return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
      };

      const nextConnectors: OrgConnector[] = [];
      if (selectedAudit) {
        matrixKinds.forEach(kind => {
          const target = orgNodes.current.get(`kind:${kind}`);
          if (target) nextConnectors.push({
            id: `audit:${selectedAuditTypeId}->kind:${kind}`,
            path: makePath(selectedAudit, target),
            active: !selectedKind || selectedKind === kind,
          });
        });
      }
      if (selectedKindNode) {
        matricesForSelectedKind.forEach(matrix => {
          const target = orgNodes.current.get(`matrix:${matrix.id}`);
          if (target) nextConnectors.push({
            id: `kind:${selectedKind}->matrix:${matrix.id}`,
            path: makePath(selectedKindNode, target),
            active: true,
          });
        });
      }
      setOrgConnectors(previous => {
        if (previous.length === nextConnectors.length && previous.every((connector, index) =>
          connector.id === nextConnectors[index].id && connector.path === nextConnectors[index].path && connector.active === nextConnectors[index].active)) return previous;
        return nextConnectors;
      });
    };

    updateChart();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateChart);
    observer?.observe(chart);
    window.addEventListener('resize', updateChart);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateChart);
    };
  }, [view, selectedAuditTypeId, selectedKind, auditTypesKey, matrixKindsKey, matricesKey, kindListPadding, matrixListPadding, supportMode]);
  const selected = data.matrices.find(m => m.id === selectedId && !m.deleted);
  const newMatrix = (auditTypeId?: string, standardType = matrixStandardTypes[0]) => setEditing({
    id: crypto.randomUUID(), family: crypto.randomUUID(), name: '', auditTypeId: auditTypeId || auditTypes[0]?.id || data.entities.find(e => e.kind === 'auditType')?.id || '',
    kind: 'Audit Cycle', standardType, certificationType: 'Système', special: false, active: true, deleted: false, labels: { fr: '', en: '', ko: '' }, descriptions: { fr: '', en: '', ko: '' }, taskIds: [],
  });
  const duplicate = (m: Matrix) => setEditing({ ...m, id: crypto.randomUUID(), name: `${m.name} · copie`, taskIds: [...m.taskIds], labels: { ...m.labels, fr: `${m.name} · copie` } });
  const removeMatrix = (matrix: Matrix) => {
    const linkedAudits = data.audits.filter(audit => audit.matrixId === matrix.id);
    confirm({
      title: 'Supprimer cette matrice ?',
      description: `« ${matrix.name} » sera placée en suppression logique et ne sera plus proposée.`,
      scope: `Uniquement cette matrice · ${auditName(matrix.auditTypeId)}`,
      facts: [
        { label: 'matrice supprimée', value: 1 },
        { label: 'audits existants conservés', value: linkedAudits.length },
        { label: 'audits terminés conservés', value: linkedAudits.filter(audit => audit.status === 'Terminé').length },
        { label: 'modèles de tâches supprimés', value: 0 },
      ],
      warning: 'Les audits existants, leurs tâches et leurs données restent inchangés. Les autres matrices du même modèle sont conservées. Cette suppression peut être annulée depuis le journal.',
      confirmLabel: 'Supprimer la matrice',
      technical: { ids: [{ label: 'ID matrice', value: fakeTechnicalId('task-matrix', matrix.id) }], tables: [...technicalMappings.taskMatrices.tables] },
      apply: () => {
        const ok = commit(`Suppression logique de « ${matrix.name} »`, auditName(matrix.auditTypeId), d => deleteMatrix(d, matrix.id));
        if (ok && selectedId === matrix.id) setSelectedId('');
        return ok;
      },
    });
  };
  const save = (selection: MatrixAuditSelection) => {
    const { draft, additions, retained } = selection;
    const original = data.matrices.find(m => m.id === draft.id);
    if (original) {
      setPending({ original, ...selection });
    } else {
      const created = [draft, ...additions];
      const auditNames = created.map(matrix => auditName(matrix.auditTypeId)).join(', ');
      confirm({
        title: created.length > 1 ? 'Créer ces matrices ?' : 'Créer cette matrice ?', description: `Le modèle « ${draft.name} » sera créé pour : ${auditNames}. Chaque type d’audit dispose de sa matrice, reliée au même modèle.`,
        scope: 'Nouvelles matrices · futures créations', facts: [{ label: 'matrices créées', value: created.length }, { label: 'tâches par matrice', value: draft.taskIds.length }, { label: 'rattachements existants conservés', value: retained.length }, { label: 'audits existants modifiés', value: 0 }],
        technical: { ids: created.map((item, index) => ({ label: `Matrice ${index + 1}`, value: fakeTechnicalId('task-matrix', item.id) })), tables: [...technicalMappings.taskMatrices.tables] },
        apply: () => {
          const ok = commit(`Création de ${created.length} matrice(s) « ${draft.name} »`, auditNames, d => ({ ...d, matrices: [...d.matrices, ...created] }));
          if (ok) {
            setEditing(null);
            setSelectedAuditTypeId(draft.auditTypeId);
            setSelectedKind(draft.kind);
            setSelectedId(draft.id);
          }
          return ok;
        },
      });
    }
  };
  return <>
    <SectionTitle eyebrow="PARAMÉTRAGE / MATRICES" title="Matrices de tâches" description="Explorez les liens entre types de norme, types d’audit, matrices et tâches." action={<button className="btn primary" onClick={() => newMatrix(undefined, standard.length === 1 ? standard[0] : matrixStandardTypes[0])}><Plus size={18} />Créer une matrice</button>} />
    <div className="panel">
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher un type d’audit, une matrice…" /><div className="segmented" aria-label="Mode d’affichage"><button aria-pressed={view === 'map'} className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}><Network size={16} />Cartographie</button><button aria-pressed={view === 'table'} className={view === 'table' ? 'selected' : ''} onClick={() => setView('table')}><List size={16} />Tableau</button></div></div>
      <div className="filters">
        <FilterDropdown label="Type de norme" values={standard} onChange={setStandard} allLabel="Tous les types" options={normOptions} />
        <FilterDropdown label="Type de certification" values={certificationType} onChange={setCertificationType} allLabel="Toutes les certifications" options={certificationOptions} />
        <FilterDropdown label="Statut" values={status} onChange={setStatus} allLabel="Toutes" options={[{ value: 'active', label: 'Actives' }, { value: 'inactive', label: 'Inactives' }]} />
        <div className="filter-note"><span className="status-dot" />{visible.length} matrices · {auditTypes.length} types d’audit</div>
      </div>
    </div>
    <div className="workspace-split">
      <div className="panel map-panel">
        <div className="panel-heading"><h3><GitBranch size={18} />{view === 'map' ? 'Cartographie des paramétrages' : 'Liste des matrices'}</h3><Badge>DEV</Badge></div>
        {view === 'map' ? <div className="tree">
          <div className="tree-hint">TYPE D’AUDIT <ChevronRight size={12} /> TYPE DE MATRICE <ChevronRight size={12} /> NOM DES MATRICES</div>
          <div className="org-chart" ref={orgChartRef} aria-label="Cartographie en trois colonnes">
            <svg className="org-connectors" aria-hidden="true">
              <defs>
                <marker id="org-arrow-active" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
                <marker id="org-arrow-muted" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              {orgConnectors.map(connector => <path key={connector.id} d={connector.path} className={connector.active ? 'org-connector active' : 'org-connector muted'} markerEnd={`url(#org-arrow-${connector.active ? 'active' : 'muted'})`} />)}
            </svg>
            <section className="org-column" aria-label="Types d’audit">
              <h4 className="org-column-heading">TYPE D’AUDIT</h4>
              <div className="org-node-list audit-list">
                {auditTypes.map(auditType => {
                  const matrixCount = visible.filter(matrix => matrix.auditTypeId === auditType.id).length;
                  const matrixNorm = matrixStandardLabel(visible.find(matrix => matrix.auditTypeId === auditType.id)?.standardType || matrixStandardTypes[0]);
                  return <div key={auditType.id} className="org-audit-row">
                    <button ref={node => setOrgNode(`audit:${auditType.id}`, node)} type="button" className={`org-node org-audit-node ${selectedAuditTypeId === auditType.id ? 'selected' : ''} ${hasSelectedAudit && selectedAuditTypeId !== auditType.id ? 'secondary' : ''}`} aria-pressed={selectedAuditTypeId === auditType.id} onClick={() => {
                      setSelectedAuditTypeId(selectedAuditTypeId === auditType.id ? '' : auditType.id);
                      setSelectedKind('');
                      setSelectedId('');
                    }}>
                      <span className="org-node-icon"><GitBranch size={17} /></span><span className="org-node-copy"><strong>{auditType.name}</strong><small>{matrixCount} matrice{matrixCount > 1 ? 's' : ''}</small>{supportMode && <TechnicalInlineId value={entityTechnicalId('auditType', auditType.id)} />}</span>
                    </button>
                    <button type="button" className="icon-btn org-add-matrix" aria-label={`Ajouter une matrice à ${auditType.name}`} title={`Ajouter une matrice à ${auditType.name}`} onClick={() => newMatrix(auditType.id, matrixNorm)}><Plus size={15} /></button>
                  </div>;
                })}
                {!auditTypes.length && <p className="org-empty">Aucun type d’audit disponible avec ces filtres.</p>}
              </div>
            </section>
            <section className="org-column" aria-label="Types de matrice">
              <h4 className="org-column-heading">TYPE DE MATRICE</h4>
              {hasSelectedAudit ? <div className="org-node-list kind-list" style={{ paddingTop: kindListPadding }}>
                {matrixKinds.map(kind => {
                  const matrixCount = matricesForAuditKind(visible, selectedAuditTypeId, kind).length;
                  const label = kind === 'Audit Cycle' ? 'AuditCycle' : 'AuditProcess';
                  return <button ref={node => setOrgNode(`kind:${kind}`, node)} key={kind} type="button" className={`org-node org-kind-node ${selectedKind === kind ? 'selected' : ''}`} aria-pressed={selectedKind === kind} onClick={() => {
                    setSelectedKind(selectedKind === kind ? '' : kind);
                    setSelectedId('');
                  }}>
                    <span className="org-node-icon"><Layers size={17} /></span><span className="org-node-copy"><strong>{label}</strong><small>{matrixCount} matrice{matrixCount > 1 ? 's' : ''}</small></span>
                  </button>;
                })}
              </div> : <p className="org-empty">{selectedAuditTypeId ? 'Aucun type d’audit disponible avec ces filtres.' : 'Sélectionnez un type d’audit.'}</p>}
            </section>
            <section className="org-column" aria-label="Noms des matrices">
              <h4 className="org-column-heading">NOM DES MATRICES</h4>
              {hasSelectedAudit && selectedKind ? <div className="org-node-list matrix-list" style={{ paddingTop: matrixListPadding }}>
                {matricesForSelectedKind.map(matrix => <div key={matrix.id} className="org-matrix-row">
                  <button ref={node => setOrgNode(`matrix:${matrix.id}`, node)} type="button" className={`org-node org-matrix-node ${selectedId === matrix.id ? 'selected' : ''}`} aria-pressed={selectedId === matrix.id} onClick={() => setSelectedId(matrix.id)}>
                    <span className="org-node-icon"><GitBranch size={17} /></span><span className="org-node-copy"><strong>{matrix.name}</strong><small>{matrix.taskIds.length} tâches associées</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-matrix', matrix.id)} />}</span>
                  </button>
                  <button type="button" className="icon-btn danger org-delete-matrix" aria-label={`Supprimer la matrice ${matrix.name}`} title={`Supprimer uniquement « ${matrix.name} »`} onClick={() => removeMatrix(matrix)}><Trash2 size={15} /></button>
                </div>)}
                {!matricesForSelectedKind.length && <p className="org-empty">Aucune matrice ne correspond à cette branche.</p>}
              </div> : <p className="org-empty">Sélectionnez un type de matrice.</p>}
            </section>
          </div>
        </div> : <div className="table-scroll"><table><thead><tr><th>Matrice (A → Z)</th><th>Type d’audit</th><th>Tâches</th></tr></thead><tbody>{visible.map(m => <tr key={m.id} className={m.id === selectedId ? 'selected-row' : ''}><td><button className="text-link" onClick={() => setSelectedId(m.id)}>{m.name}</button><small>{m.kind}</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-matrix', m.id)} />}</td><td>{auditName(m.auditTypeId)}{supportMode && <TechnicalInlineId value={entityTechnicalId('auditType', m.auditTypeId)} />}</td><td>{m.taskIds.length}</td></tr>)}</tbody></table></div>}
        {!visible.length && <Empty />}
      </div>
      <aside className="panel detail-panel">
        {selected ? <>
          <div className="panel-heading"><h3>Détail de la matrice</h3><button className="icon-btn" aria-label="Fermer le détail" onClick={() => setSelectedId('')}><X size={17} /></button></div>
          <div className="detail-content stack">
            <div className="split"><span className="inline"><small>Type de matrice</small><Badge tone="blue">{selected.kind === 'Audit Cycle' ? 'AuditCycle' : 'AuditProcess'}</Badge></span><Status active={selected.active} /></div>
            <div><h2>{selected.name}</h2><p>Type d’audit : {auditName(selected.auditTypeId)}</p><small>Type de norme : {matrixStandardLabel(selected.standardType)}</small></div>
            {supportMode && <TechnicalInfo
              ids={[
                { label: 'ID matrice', value: fakeTechnicalId('task-matrix', selected.id) },
                { label: 'ID type audit fictif', value: fakeTechnicalId('audit-type', selected.auditTypeId) },
                ...selected.taskIds.map((taskId, index) => ({
                  label: `ID tâche associé ${index + 1}`,
                  value: fakeTechnicalId('task-template', taskId),
                })),
              ]}
              fields={[
                { label: 'Type technique', value: selected.kind === 'Audit Cycle' ? 'AuditCycle' : 'AuditProcess' },
              ]}
              tables={[...technicalMappings.taskMatrices.tables, ...technicalMappings.taskMatrixAssociations.tables]}
            />}
            <div className="button-row"><button className="btn primary small" onClick={() => setEditing(selected)}><Pencil size={15} />Modifier</button><button className="btn small" onClick={() => duplicate(selected)}><Copy size={15} />Dupliquer</button></div>
            <div className="detail-section"><h4>TÂCHES ASSOCIÉES <Badge>{selected.taskIds.length}</Badge></h4>
              <ol className="task-timeline">{selected.taskIds.map((id, i) => { const t = data.tasks.find(t => t.id === id); return <li key={id}><span>{i + 1}</span><div><strong>{t?.name}</strong><small>{t?.role} · {t?.offset !== undefined && t.offset > 0 ? '+' : ''}{t?.offset} j</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template', id)} />}</div></li>; })}</ol>
              {!selected.taskIds.length && <p>Aucune tâche associée.</p>}
            </div>
            <div className="detail-section"><h4>RÉUTILISATION DU MÊME MODÈLE</h4>
              {data.matrices.filter(m => !m.deleted && m.family === selected.family && m.id !== selected.id).map(m => <div className="reuse-item" key={m.id}><GitBranch size={14} /><span>{auditName(m.auditTypeId)}{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-matrix', m.id)} />}</span></div>)}
              {!data.matrices.some(m => !m.deleted && m.family === selected.family && m.id !== selected.id) && <p>Uniquement ce type d’audit.</p>}
            </div>
            <div className="detail-section"><h4>DOCUMENTS HÉRITÉS DES TÂCHES</h4>{data.documents.filter(d => d.active && d.taskIds.some(id => selected.taskIds.includes(id))).map(d => <div className="reuse-item" key={d.id}><span>{d.versions.fr.label || d.versions.en.label || d.versions.ko.label}{supportMode && <TechnicalInlineId value={documentTemplateTechnicalId(d.id)} />}</span></div>)}</div>
            <div className="detail-section"><h4>AUDITS FICTIFS LIÉS</h4>{data.audits.filter(a => a.matrixId === selected.id).map(a => <div className="audit-summary" key={a.id}><span>{a.name}<small>{a.taskIds.length} tâches</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('audit', a.id)} />}</span><Badge tone={a.status === 'Terminé' ? 'neutral' : 'blue'}>{a.status}</Badge></div>)}</div>
            <button className="btn danger small" onClick={() => removeMatrix(selected)}><Trash2 size={15} />Supprimer la matrice</button>
          </div>
        </> : <div className="detail-placeholder"><div className="large-icon"><Network size={30} /></div><h3>Parcourez la cartographie</h3><p>Sélectionnez un type d’audit, un type de matrice puis un nom pour afficher ses tâches.</p><div className="mini-steps"><span>Type d’audit</span><ChevronRight size={16} /><span>AuditCycle / AuditProcess</span><ChevronRight size={16} /><span>Nom de matrice</span></div></div>}
      </aside>
    </div>
    <Notice>Hypothèse de maquette : les matrices correspondantes partagent une même source de duplication. Seuls les ajouts et retraits de tâches sont propagés ; les propriétés et l’ordre restent locaux.</Notice>
    {editing && <MatrixEditor matrix={editing} data={data} supportMode={supportMode} onClose={() => setEditing(null)} onSave={save} />}
    {pending && <Propagation data={data} original={pending.original} draft={pending.draft} additions={pending.additions} retained={pending.retained} supportMode={supportMode} confirm={confirm} onClose={() => setPending(null)} onApply={(ids, existing) => {
      const impact = matrixImpact(data, ids, existing);
      const ok = commit(`Modification de la matrice « ${pending.draft.name} »`, `${ids.length} matrices · ${pending.additions.length} nouvelles matrices · ${impact.audits} audits non terminés`, d => {
        const updated = propagateMatrix(d, pending.original, pending.draft, ids, existing);
        return { ...updated, matrices: [...updated.matrices, ...pending.additions] };
      });
      if (ok) { setPending(null); setEditing(null); }
      return ok;
    }} />}
  </>;
}

function MatrixEditor({ matrix, data, supportMode, onSave, onClose }: { matrix: Matrix; data: Data; supportMode: boolean; onSave: (selection: MatrixAuditSelection) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({
    ...matrix, labels: { ...matrix.labels }, taskIds: [...matrix.taskIds],
    descriptions: { fr: '', en: '', ko: '', ...matrix.descriptions },
  });
  const [query, setQuery] = useState('');
  const [auditTypeIds, setAuditTypeIds] = useState(matrix.auditTypeId ? [matrix.auditTypeId] : []);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState(false);
  const patch = (change: Partial<Matrix>) => setDraft(m => ({ ...m, ...change }));
  const normOptions = alphabetic([...new Set([...matrixStandardTypes, ...data.matrices.filter(m => !m.deleted).map(m => m.standardType)])], norm => norm);
  const certificationOptions = [...new Set([...matrixCertificationTypes, ...data.matrices.filter(m => !m.deleted).map(m => m.certificationType)])].filter(value => value !== '');
  const translate = () => {
    if (!draft.name.trim() && !draft.descriptions.fr.trim()) { setError('Renseignez le nom ou la description avant de proposer des traductions.'); return; }
    const dictionary = knownTextTranslations(data);
    patch({
      labels: { ...draft.labels, ...completeMissingTranslations(draft.name, draft.labels, dictionary) },
      descriptions: { ...draft.descriptions, ...completeMissingTranslations(draft.descriptions.fr, draft.descriptions, dictionary) },
    });
    setTranslated(true);
    setError('');
  };
  const available = alphabetic(data.tasks.filter(t => t.active && !draft.taskIds.includes(t.id) && matches(query, t.name)), t => t.name);
  const move = (index: number, direction: number) => {
    const ids = [...draft.taskIds];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    patch({ taskIds: ids });
  };
  return <Modal title={data.matrices.some(m => m.id === matrix.id) ? 'Modifier la matrice' : 'Créer / dupliquer une matrice'} subtitle="Composez le parcours, puis choisissez la portée des modifications." onClose={onClose} wide
    headerAside={supportMode && <div className="technical-header-id">
      <small>ID matrice · Identifiant simulé</small>
      <code>{fakeTechnicalId('task-matrix', matrix.id)}</code>
      <CopyValueButton value={fakeTechnicalId('task-matrix', matrix.id)} label="l’identifiant" />
    </div>}>
    <form onSubmit={e => {
      e.preventDefault();
      if (!draft.name.trim() || !draft.labels.fr.trim()) { setError('Le nom et le libellé français sont obligatoires.'); return; }
      let selection: MatrixAuditSelection;
      try {
        selection = expandMatrixAuditSelection({ ...draft, name: draft.name.trim() }, auditTypeIds, data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de préparer les rattachements de la matrice.');
        return;
      }
      onSave(selection);
    }}>
      <div className="modal-body stack">
        <div className="form-grid">
          <Field label="Nom de la matrice *" wide><input required value={draft.name} onChange={e => patch({ name: e.target.value, labels: { ...draft.labels, fr: e.target.value } })} /></Field>
          <Field label="Description de la matrice" wide hint="Texte français ; les propositions EN/KO sont disponibles dans le tableau des langues."><textarea rows={3} value={draft.descriptions.fr} onChange={e => patch({ descriptions: { ...draft.descriptions, fr: e.target.value } })} /></Field>
          <MultiSelectDropdown label="Type d’audit *" values={auditTypeIds} onChange={ids => { setAuditTypeIds(ids); setError(''); }} options={alphabetic(data.entities.filter(e => e.kind === 'auditType'), e => e.name).map(e => ({ value: e.id, label: supportMode ? `${e.name} · ID simulé ${entityTechnicalId('auditType', e.id)}` : e.name }))} />
          <Select label="Type de matrice" value={draft.kind} onChange={kind => patch({ kind: kind as Matrix['kind'] })} options={[{ value: 'Audit Cycle', label: 'AuditCycle' }, { value: 'Audit Process', label: 'AuditProcess' }]} />
          <Select label="Type de norme" value={draft.standardType} onChange={standardType => patch({ standardType })} options={normOptions} />
          <Select label="Type de certification" value={draft.certificationType} onChange={certificationType => patch({ certificationType })} options={[{ value: '', label: 'Non précisé' }, ...certificationOptions]} />
        </div>
        <small>Cochez un ou plusieurs types d’audit. Une matrice est créée pour chaque nouveau rattachement, avec le même nom, les mêmes tâches et une filiation commune. Les autres listes restent à choix unique ; les rattachements déjà existants sont conservés sans doublon.</small>
        <div className="button-row"><CheckField checked={draft.active} onChange={active => patch({ active })}>Matrice active</CheckField>{draft.kind === 'Audit Process' && <CheckField checked={draft.special} onChange={special => patch({ special })}>Process spécial</CheckField>}</div>
        <div className="split"><h3 className="subheading"><Languages size={18} />Noms et descriptions multilingues</h3><button type="button" className="btn small" onClick={translate}><Languages size={15} />Proposer les traductions manquantes (EN / KO)</button></div>
        <div className="table-scroll"><table className="model-language-table matrix-language-table"><thead><tr><th>Langue</th><th>Nom</th><th>Description</th></tr></thead><tbody>
          {(['fr', 'en', 'ko'] as const).map((lang, i) => <tr key={lang}>
            <td>{['Français', 'Anglais', 'Coréen'][i]}{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-matrix-translation', `${matrix.id}:${lang}`)} />}</td>
            <td><input aria-label={['Libellé français *', 'Libellé anglais', 'Libellé coréen'][i]} required={lang === 'fr'} value={draft.labels[lang]} onChange={e => patch({ labels: { ...draft.labels, [lang]: e.target.value } })} /></td>
            <td><textarea aria-label={`Description ${['Français', 'Anglais', 'Coréen'][i]}`} rows={2} value={draft.descriptions[lang]} onChange={e => patch({ descriptions: { ...draft.descriptions, [lang]: e.target.value } })} /></td>
          </tr>)}
        </tbody></table></div>
        {translated && <Notice warning>Propositions du dictionnaire local à relire : les textes inconnus sont signalés « à traduire ». Les traductions existantes sont conservées. Aucun service externe n’est connecté.</Notice>}
        {supportMode && <TechnicalInfo
          ids={[
            { label: 'ID matrice', value: fakeTechnicalId('task-matrix', matrix.id) },
            ...draft.taskIds.map((taskId, index) => ({
              label: `ID tâche associé ${index + 1}`,
              value: fakeTechnicalId('task-template', taskId),
            })),
          ]}
          fields={[
            { label: 'Type technique', value: draft.kind === 'Audit Cycle' ? 'AuditCycle' : 'AuditProcess' },
          ]}
          tables={[...technicalMappings.taskMatrices.tables, ...technicalMappings.taskMatrixAssociations.tables]}
        />}
        <div className="split"><h3>Tâches associées <Badge>{draft.taskIds.length}</Badge></h3><button className="btn small" type="button" onClick={() => setAdding(!adding)}><Plus size={16} />Ajouter une tâche</button></div>
        <div className="edit-task-list">{draft.taskIds.map((id, i) => { const t = data.tasks.find(t => t.id === id); return <div className="edit-task-row" key={id}><span className="order-number">{i + 1}</span><div><strong>{t?.name}</strong><small>{t?.role} · {t?.reference} {t && t.offset >= 0 ? '+' : ''}{t?.offset} j</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template', id)} />}</div><div className="inline"><button type="button" className="icon-btn" aria-label={`Monter ${t?.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button><button type="button" className="icon-btn" aria-label={`Descendre ${t?.name}`} disabled={i === draft.taskIds.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button><button type="button" className="icon-btn danger" aria-label={`Retirer ${t?.name}`} onClick={() => patch({ taskIds: draft.taskIds.filter(x => x !== id) })}><X size={16} /></button></div></div>; })}</div>
        {adding && <div className="task-picker stack"><SearchBox value={query} onChange={setQuery} placeholder="Rechercher une tâche disponible…" /><small>Les tâches déjà associées et les modèles inactifs sont exclus.</small>{available.map(t => <button type="button" key={t.id} className="picker-item" onClick={() => setDraft(m => ({ ...m, taskIds: [...new Set([...m.taskIds, t.id])] }))}><span>{t.name}<small>{t.role}</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template', t.id)} />}</span><Plus size={17} /></button>)}{!available.length && <p>Aucune tâche disponible pour cette recherche.</p>}</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><FormActions label="Analyser les impacts" onClose={onClose} />
    </form>
  </Modal>;
}

function Propagation({ data, original, draft, additions, retained, supportMode, confirm, onClose, onApply }: { data: Data; original: Matrix; draft: Matrix; additions: Matrix[]; retained: Matrix[]; supportMode: boolean; confirm: (impact: Impact) => void; onClose: () => void; onApply: (ids: string[], existing: boolean) => boolean }) {
  const [mode, setMode] = useState('local');
  const [timing, setTiming] = useState('future');
  const [selected, setSelected] = useState<string[]>([original.id]);
  const family = data.matrices.filter(m => !m.deleted && m.family === original.family);
  const ids = mode === 'all' ? family.map(m => m.id) : mode === 'select' ? selected : [original.id];
  const existing = timing !== 'future';
  const impact = matrixImpact(data, ids, existing);
  const added = draft.taskIds.filter(id => !original.taskIds.includes(id));
  const removed = original.taskIds.filter(id => !draft.taskIds.includes(id));
  return <Modal title="Choisir la propagation" subtitle="Gardez le contrôle sur les matrices et les audits concernés." onClose={onClose}>
    <div className="modal-body stack">
      {supportMode && <TechnicalInfo ids={ids.map((id, index) => ({ label: `Matrice concernée ${index + 1}`, value: fakeTechnicalId('task-matrix', id) }))} tables={[...technicalMappings.taskMatrices.tables]} />}
      <Notice>Les propriétés et le réordonnancement s’appliquent seulement à la matrice ouverte. Les ajouts/retraits de tâches suivent le périmètre ci-dessous.</Notice>
      {!!(additions.length || retained.length) && <Notice>{additions.length} nouvelle(s) matrice(s) seront créées pour les types d’audit supplémentaires. {retained.length} rattachement(s) déjà existant(s) sont conservés ; leurs propriétés ne sont pas écrasées.</Notice>}
      <Select label="Matrices concernées" value={mode} onChange={setMode} options={[{ value: 'local', label: 'Uniquement cette matrice' }, { value: 'all', label: 'Toutes les matrices correspondantes' }, { value: 'select', label: 'Sélectionner les matrices' }]} />
      {mode === 'select' && family.map(m => <CheckField key={m.id} checked={selected.includes(m.id)} disabled={m.id === original.id} onChange={checked => setSelected(ids => checked ? [...ids, m.id] : ids.filter(id => id !== m.id))}>{m.name} · {data.entities.find(e => e.id === m.auditTypeId)?.name}</CheckField>)}
      <Select label="Données concernées" value={timing} onChange={setTiming} options={[{ value: 'future', label: 'Futures créations uniquement' }, { value: 'existing', label: 'Éléments existants non terminés' }, { value: 'applicable', label: 'Tous les éléments applicables (hors terminés)' }]} />
      <small>Dans ce jeu fictif, les deux derniers choix couvrent les mêmes audits planifiés et en cours. Les statuts métier définitifs restent à confirmer.</small>
      <div className="impact-grid"><div><strong>{impact.matrices}</strong><span>matrices</span></div><div><strong>{impact.audits}</strong><span>audits à mettre à jour</span></div><div><strong>{impact.excluded}</strong><span>terminés exclus</span></div></div>
      <div className="change-summary"><span><Check size={15} />{added.length} tâche(s) ajoutée(s)</span><span><X size={15} />{removed.length} tâche(s) retirée(s)</span></div>
    </div>
    <div className="modal-actions"><button className="btn" onClick={onClose}>Retour</button><button className="btn primary" onClick={() => confirm({
      title: 'Confirmer la modification de matrice', description: `Modification de « ${draft.name} » : ${added.length} ajout(s), ${removed.length} retrait(s). Les éléments terminés ne seront jamais modifiés.`,
      scope: `${mode === 'local' ? 'Cette matrice' : `${ids.length} matrices correspondantes`} · ${existing ? 'futur et audits non terminés' : 'futures créations uniquement'}`,
      facts: [{ label: 'matrices concernées', value: impact.matrices }, { label: 'nouvelles matrices', value: additions.length }, { label: 'rattachements existants conservés', value: retained.length }, { label: 'audits modifiés', value: impact.audits }, { label: 'audits terminés exclus', value: impact.excluded }, { label: 'documents liés aux tâches ajoutées', value: data.documents.filter(d => d.taskIds.some(id => added.includes(id))).length }],
      technical: { ids: [...ids, ...additions.map(item => item.id)].map((id, index) => ({ label: `Matrice ${index + 1}`, value: fakeTechnicalId('task-matrix', id) })), tables: [...technicalMappings.taskMatrices.tables] },
      warning: 'La propagation utilise une filiation fictive commune. La règle de correspondance définitive reste à valider.', apply: () => onApply(ids, existing),
    })}>Prévisualiser et confirmer<ChevronRight size={17} /></button></div>
  </Modal>;
}
