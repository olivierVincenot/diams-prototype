import { useState } from 'react';
import { Building2, ChevronRight, MapPin, Users } from 'lucide-react';
import type { Entity } from './types';
import { alphabetic, matches, organizationPaths } from './domain';
import { entityTechnicalId } from './supportConfig';
import { Badge, CheckField, SearchBox, TechnicalInfo, TechnicalInlineId } from './ui';

type Props = {
  entities: Entity[];
  kind: 'site' | 'enterprise';
  mode: 'source' | 'destination';
  search: string;
  onSearch: (value: string) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  destination: string;
  onDestinationChange: (id: string) => void;
  supportMode: boolean;
};

export function OrganizationTree({ entities, kind, mode, search, onSearch, selectedIds, onSelectedIdsChange, destination, onDestinationChange, supportMode }: Props) {
  const [selection, setSelection] = useState<(string | null)[]>([]);
  const paths = organizationPaths(entities).filter(path => {
    const values = [path.client, path.enterprise, path.site].flatMap(entity => entity
      ? [entity.name, entity.id, entityTechnicalId(entity.kind, entity.id),
        ...(entity.details ?? []).flatMap(detail => [detail.label, detail.value])] : []);
    return matches(search, ...values);
  });
  const unique = (items: (Entity | null)[], missing: string) => {
    const result = new Map<string | null, Entity | null>();
    items.forEach(item => result.set(item?.id ?? null, item));
    return alphabetic([...result.values()], item => item?.name ?? missing);
  };
  const clients = unique(paths.map(path => path.client), 'Client non renseigné');
  const clientId = selection.length && clients.some(client => (client?.id ?? null) === selection[0])
    ? selection[0] : search.trim() && clients.length === 1 ? clients[0]?.id ?? null : undefined;
  const clientPaths = clientId === undefined ? [] : paths.filter(path => (path.client?.id ?? null) === clientId);
  const enterprises = unique(clientPaths.map(path => path.enterprise), 'Entreprise non renseignée');
  const enterpriseId = clientId !== undefined && selection.length > 1 && selection[0] === clientId &&
    enterprises.some(enterprise => (enterprise?.id ?? null) === selection[1])
    ? selection[1] : search.trim() && enterprises.length === 1 ? enterprises[0]?.id ?? null : undefined;
  const sites = enterpriseId === undefined ? [] : alphabetic(clientPaths.filter(path =>
    (path.enterprise?.id ?? null) === enterpriseId && path.site).map(path => path.site!), site => site.name);
  const toggleSource = (id: string, checked: boolean) => onSelectedIdsChange(checked
    ? [...selectedIds, id] : selectedIds.filter(item => item !== id));
  const technical = (entity: Entity) => supportMode && <TechnicalInfo
    ids={[{ label: 'Identifiant simulé', value: entityTechnicalId(entity.kind, entity.id) }]}
    fields={[{ label: 'Table historique', value: 'Correspondance à confirmer (aucun nom fourni)' }]}
    tables={[]} />;
  const clientAction = mode === 'destination' && kind === 'enterprise';
  const enterpriseAction = mode === 'destination' && kind === 'site';

  return <div className="transfer-body stack">
    <SearchBox value={search} onChange={onSearch}
      placeholder={mode === 'source' ? 'Rechercher un client, une entreprise, un site ou son ID…' : 'Rechercher une destination ou un ID de site…'} />
    <p className="organization-help">
      {mode === 'source'
        ? `Parcourez les clients et les entreprises, puis cochez ${kind === 'site' ? 'les sites' : 'les entreprises'} à déplacer.`
        : `Parcourez l’arborescence et cliquez sur ${kind === 'site' ? 'l’entreprise' : 'le client'} de destination.`}
      {' '}Les identifiants affichés sont ceux du jeu local fictif.
    </p>
    <div className="organization-tree-scroll">
      <div className="org-chart organization-chart" aria-label={`Arborescence ${mode === 'source' ? 'des éléments à déplacer' : 'de destination'}`}>
        <section className="org-column" aria-label="Clients">
          <h4 className="org-column-heading">CLIENTS</h4>
          <div className="org-node-list">
            {clients.map(client => {
              const id = client?.id ?? null;
              return <button type="button" key={id ?? 'missing-client'} className={`org-node ${clientId === id ? 'selected' : ''}`}
                aria-pressed={clientId === id} onClick={() => {
                  setSelection([id]);
                  if (clientAction && client) onDestinationChange(client.id);
                }}>
                <span className="org-node-icon"><Users size={17} /></span>
                <span className="org-node-copy"><strong>{client?.name ?? 'Client non renseigné'}</strong>{client && <><small>ID local : {client.id}</small>{supportMode && <TechnicalInlineId value={entityTechnicalId(client.kind, client.id)} />}</>}</span>
                {clientAction && client?.id === destination && <Badge tone="green">Destination</Badge>}
                <ChevronRight size={14} />
              </button>;
            })}
            {!clients.length && <p className="org-empty">Aucun résultat pour cette recherche.</p>}
          </div>
        </section>
        <section className="org-column" aria-label="Entreprises">
          <h4 className="org-column-heading">ENTREPRISES</h4>
          {clientId === undefined ? <p className="org-empty">Sélectionnez un client.</p> : <div className="org-node-list">
            {enterprises.map(enterprise => {
              const id = enterprise?.id ?? null;
              return <div key={id ?? 'missing-enterprise'} className="organization-choice">
                <button type="button" className={`org-node ${enterpriseId === id ? 'selected' : ''}`}
                  aria-pressed={enterpriseId === id} onClick={() => {
                    setSelection([clientId, id]);
                    if (enterpriseAction && enterprise) onDestinationChange(enterprise.id);
                  }}>
                  <span className="org-node-icon"><Building2 size={17} /></span>
                  <span className="org-node-copy"><strong>{enterprise?.name ?? (clientId === null ? 'Entreprise non renseignée' : 'Aucune entreprise')}</strong>{enterprise && <><small>ID local : {enterprise.id}</small>{supportMode && <TechnicalInlineId value={entityTechnicalId(enterprise.kind, enterprise.id)} />}</>}</span>
                  {enterpriseAction && enterprise?.id === destination && <Badge tone="green">Destination</Badge>}
                  <ChevronRight size={14} />
                </button>
                {enterprise && mode === 'source' && kind === 'enterprise' && <div className="organization-select">
                  <CheckField checked={selectedIds.includes(enterprise.id)} onChange={checked => toggleSource(enterprise.id, checked)}>Sélectionner {enterprise.name} · {enterprise.id}</CheckField>
                  {technical(enterprise)}
                </div>}
              </div>;
            })}
          </div>}
        </section>
        <section className="org-column" aria-label="Sites">
          <h4 className="org-column-heading">SITES</h4>
          {enterpriseId === undefined ? <p className="org-empty">Sélectionnez une entreprise.</p> : <div className="org-node-list">
            {sites.map(site => <div key={site.id} className={`org-node organization-site ${selectedIds.includes(site.id) && mode === 'source' && kind === 'site' ? 'selected' : ''}`}>
              <span className="org-node-icon"><MapPin size={17} /></span>
              <div className="org-node-copy">
                {mode === 'source' && kind === 'site' ? <CheckField checked={selectedIds.includes(site.id)} onChange={checked => toggleSource(site.id, checked)}>
                  <strong>{site.name}</strong><small>ID local : {site.id}</small>
                </CheckField> : <><strong>{site.name}</strong><small>ID local : {site.id}</small></>}
                {supportMode && <TechnicalInlineId value={entityTechnicalId(site.kind, site.id)} />}
                {site.details?.map((detail, index) => <small key={`${detail.label}-${index}`}>{detail.label} : {detail.value}</small>)}
                {mode === 'source' && kind === 'site' && technical(site)}
              </div>
            </div>)}
            {!sites.length && <p className="org-empty">Aucun site dans cette branche.</p>}
          </div>}
        </section>
      </div>
    </div>
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
