import { useState } from 'react';
import { Building2, ChevronRight, ClipboardList, FileCheck2, Layers, Users } from 'lucide-react';
import type { Entity } from './types';
import { alphabetic, certificationPaths, matches } from './domain';
import { entityTechnicalId } from './supportConfig';
import { Badge, CheckField, SearchBox, TechnicalInfo, TechnicalInlineId } from './ui';

type Props = {
  entities: Entity[];
  kind: 'auditType' | 'certification';
  mode: 'source' | 'destination';
  search: string;
  onSearch: (value: string) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  destination: string;
  onDestinationChange: (id: string) => void;
  companyId: string | null;
  supportMode: boolean;
};

const headings = ['Clients', 'Entreprises', 'Schémas', 'Certifications', 'Types d’audit'];
const singular = ['client', 'entreprise', 'schéma', 'certification', 'type d’audit'];
const withArticle = ['un client', 'une entreprise', 'un schéma', 'une certification', 'un type d’audit'];
const missingLabel = ['Client non renseigné', 'Entreprise non renseignée', 'Schéma non renseigné', 'Certification non renseignée', 'Type d’audit non renseigné'];
const icons = [Users, Building2, Layers, FileCheck2, ClipboardList];

export function CertificationTree({ entities, kind, mode, search, onSearch, selectedIds, onSelectedIdsChange, destination, onDestinationChange, companyId, supportMode }: Props) {
  const [selection, setSelection] = useState<(string | null)[]>([]);
  const last = kind === 'auditType' ? 4 : 3;
  const destinationLevel = last - 1;
  let paths = certificationPaths(entities, kind === 'auditType').filter(path =>
    (mode === 'source' || (!!companyId && path[1]?.id === companyId)) &&
    matches(search, ...path.flatMap(entity => entity ? [entity.name, entity.id, entityTechnicalId(entity.kind, entity.id),
      ...(entity.details ?? []).flatMap(detail => [detail.label, detail.value])] : [])));
  const columns: { items: (Entity | null)[]; selected: string | null | undefined }[] = [];
  for (let level = 0; level <= last; level++) {
    const available = paths.filter(path => path[level] || path.slice(level + 1).some(Boolean));
    const unique = new Map<string | null, Entity | null>();
    available.forEach(path => unique.set(path[level]?.id ?? null, path[level]));
    const items = alphabetic([...unique.values()], item => item?.name ?? missingLabel[level]);
    const selected = selection.length > level && items.some(item => (item?.id ?? null) === selection[level])
      ? selection[level] : search.trim() && items.length === 1 ? items[0]?.id ?? null : undefined;
    columns.push({ items, selected });
    paths = selected === undefined ? [] : paths.filter(path => (path[level]?.id ?? null) === selected);
  }
  const toggleSource = (id: string, checked: boolean) => onSelectedIdsChange(checked
    ? [...selectedIds, id] : selectedIds.filter(item => item !== id));

  return <div className="transfer-body stack">
    <SearchBox value={search} onChange={onSearch} placeholder="Rechercher un nom ou un identifiant…" />
    <p className="organization-help">
      {mode === 'source'
        ? `Parcourez les niveaux, puis cochez les ${kind === 'auditType' ? 'types d’audit' : 'certifications'} à déplacer.`
        : `Choisissez ${kind === 'auditType' ? 'une certification' : 'un schéma'} de la même entreprise que les éléments sélectionnés.`}
      {' '}Les identifiants sont fictifs.
    </p>
    {mode === 'destination' && !companyId ? <p className="org-empty">Sélectionnez des éléments rattachés à une même entreprise pour choisir une destination.</p> :
      <div className="organization-tree-scroll">
        <div className={`org-chart organization-chart certification-chart levels-${last + 1}`} aria-label={`Arborescence ${mode === 'source' ? 'des éléments à déplacer' : 'de destination'}`}>
          {columns.map(({ items, selected }, level) => {
            const Icon = icons[level];
            return <section className="org-column" aria-label={headings[level]} key={headings[level]}>
              <h4 className="org-column-heading">{headings[level].toLocaleUpperCase('fr')}</h4>
              <div className="org-node-list">
                {items.map(entity => {
                  const id = entity?.id ?? null;
                  return <div className="organization-choice" key={id ?? `missing-${level}`}>
                    <button type="button" className={`org-node ${selected === id ? 'selected' : ''}`}
                      aria-pressed={selected === id} onClick={() => {
                        setSelection([...columns.slice(0, level).map(column => column.selected ?? null), id]);
                        if (mode === 'destination' && level === destinationLevel && entity) onDestinationChange(entity.id);
                      }}>
                      <span className="org-node-icon"><Icon size={17} /></span>
                      <span className="org-node-copy"><strong>{entity?.name ?? missingLabel[level]}</strong>{entity && <>
                        <small>ID local : {entity.id}</small>
                        {supportMode && <TechnicalInlineId value={entityTechnicalId(entity.kind, entity.id)} />}
                        {entity.details?.map((detail, index) => <small key={`${detail.label}-${index}`}>{detail.label} : {detail.value}</small>)}
                      </>}</span>
                      {mode === 'destination' && level === destinationLevel && entity?.id === destination && <Badge tone="green">Destination</Badge>}
                      {level < last && <ChevronRight size={14} />}
                    </button>
                    {entity && mode === 'source' && level === last && <div className="organization-select">
                      <CheckField checked={selectedIds.includes(entity.id)} onChange={checked => toggleSource(entity.id, checked)}>
                        Sélectionner {entity.name} · {entity.id}
                      </CheckField>
                      {supportMode && <TechnicalInfo ids={[{ label: 'Identifiant simulé', value: entityTechnicalId(entity.kind, entity.id) }]}
                        fields={[{ label: 'Table historique', value: 'Correspondance à confirmer (aucun nom fourni)' }]} tables={[]} />}
                    </div>}
                  </div>;
                })}
                {!items.length && <p className="org-empty">{level === 0 ? 'Aucun résultat pour cette recherche.' :
                  columns[level - 1].selected === undefined ? `Sélectionnez ${withArticle[level - 1]}.` : `Aucun élément de niveau ${singular[level]} dans cette branche.`}</p>}
              </div>
            </section>;
          })}
        </div>
      </div>}
    {mode === 'source' && !!selectedIds.length && <div className="organization-selected">
      <strong>Éléments sélectionnés</strong>
      <div>{selectedIds.map(id => {
        const entity = entities.find(item => item.id === id);
        return <button type="button" key={id} className="organization-selected-item" onClick={() => toggleSource(id, false)}
          aria-label={`Retirer ${entity?.name ?? id} (${id}) de la sélection`}>{entity?.name ?? id} · {id} ×</button>;
      })}</div>
      <button type="button" className="text-link" onClick={() => onSelectedIdsChange([])}>Effacer la sélection ({selectedIds.length})</button>
    </div>}
  </div>;
}
