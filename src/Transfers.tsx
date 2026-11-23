import { useState } from 'react';
import { ArrowRight, ArrowRightLeft, Building2, Check, ChevronRight, ShieldCheck } from 'lucide-react';
import type { Commit, Data, EntityKind, Impact } from './types';
import { alphabetic, certificationEnterpriseId, certificationPath, reassign, transferRelations } from './domain';
import { Badge, Notice, SectionTitle, TechnicalInfo } from './ui';
import { entityTechnicalId } from './supportConfig';
import { OrganizationTree } from './OrganizationTree';
import { CertificationTree } from './CertificationTree';

export function Transfers({ data, commit, confirm, initialKind = 'auditType', supportMode = false }: { data: Data; commit: Commit; confirm: (impact: Impact) => void; initialKind?: EntityKind; supportMode?: boolean }) {
  const [kind, setKind] = useState<EntityKind>(initialKind);
  const [search, setSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const relation = transferRelations.find(r => r.from === kind)!;
  const organizationKind = kind === 'site' || kind === 'enterprise' ? kind : null;
  const certificationKind = kind === 'auditType' || kind === 'certification' ? kind : null;
  const commonCompany = (selected: string[]) => {
    const company = selected.length ? certificationEnterpriseId(data.entities, selected[0]) : null;
    return company && selected.every(id => certificationEnterpriseId(data.entities, id) === company) ? company : null;
  };
  const companyId = certificationKind ? commonCompany(ids) : null;
  const name = (id: string) => data.entities.find(e => e.id === id)?.name || 'Aucun rattachement';
  const organizationLabel = (id: string) => {
    const entity = data.entities.find(item => item.id === id);
    if (!entity) return 'Aucun rattachement';
    const parent = data.entities.find(item => item.id === entity.parentId);
    const client = parent?.kind === 'enterprise' ? data.entities.find(item => item.id === parent.parentId) : null;
    return [client && `${client.name} (${client.id})`, parent && `${parent.name} (${parent.id})`, `${entity.name} (${entity.id})`].filter(Boolean).join(' → ');
  };
  const certificationLabel = (id: string) => {
    const entity = data.entities.find(item => item.id === id);
    if (!entity) return 'Élément introuvable';
    const path = certificationPath(data.entities, entity);
    const end = path.findIndex(item => item?.id === id);
    const missing = ['Client non renseigné', 'Entreprise non renseignée', 'Schéma non renseigné', 'Certification non renseignée', 'Type d’audit non renseigné'];
    return path.slice(0, end + 1).map((item, index) => item ? `${item.name} (${item.id})` : missing[index]).join(' → ');
  };
  const destinationLabel = destination ? (organizationKind ? organizationLabel(destination) : certificationLabel(destination)) : '';
  const descendants = new Set(ids);
  for (let i = 0; i < data.entities.length; i++) {
    for (const entity of data.entities) if (descendants.has(entity.parentId)) descendants.add(entity.id);
  }
  const linkedMatrices = data.matrices.filter(m => !m.deleted && descendants.has(m.auditTypeId));
  const linkedAudits = data.audits.filter(a => linkedMatrices.some(m => m.id === a.matrixId));
  return <>
    <SectionTitle eyebrow="ADMINISTRATION / DONNÉES" title="Réaffectations" description="Faites évoluer les rattachements en conservant la cohérence de vos données." />
    <div className="transfer-tabs">{transferRelations.map(r => <button key={r.from} className={kind === r.from ? 'selected' : ''} onClick={() => { setKind(r.from); setIds([]); setDestination(''); setSearch(''); setDestinationSearch(''); setError(''); }}><ArrowRightLeft size={17} />{r.label}</button>)}</div>
    <div className="transfer-flow"><span className="current">1 <strong>Sélectionner</strong></span><ChevronRight size={16} /><span>2 <strong>Mesurer l’impact</strong></span><ChevronRight size={16} /><span>3 <strong>Confirmer</strong></span></div>
    <div className="transfer-layout organization-transfer-layout">
      <div className="panel">
        <div className="panel-heading"><h3><Building2 size={18} />Éléments à déplacer</h3><Badge>{ids.length} sélectionné(s)</Badge></div>
        {organizationKind ? <OrganizationTree key={`source-${organizationKind}`} entities={data.entities} kind={organizationKind} mode="source"
          search={search} onSearch={setSearch} selectedIds={ids} onSelectedIdsChange={value => { setIds(value); setError(''); }}
          destination={destination} onDestinationChange={setDestination} supportMode={supportMode} /> : certificationKind && <CertificationTree
          key={`source-${certificationKind}`} entities={data.entities} kind={certificationKind} mode="source"
          search={search} onSearch={setSearch} selectedIds={ids} onSelectedIdsChange={value => {
            setIds(value);
            if (!commonCompany(value) || certificationEnterpriseId(data.entities, destination) !== commonCompany(value)) setDestination('');
            setError('');
          }} destination={destination} onDestinationChange={setDestination} companyId={companyId} supportMode={supportMode} />}
        {certificationKind && ids.length > 0 && !companyId && <p className="form-error organization-source-error" role="alert">Les éléments sélectionnés doivent appartenir à une même entreprise renseignée.</p>}
      </div>
      <div className="transfer-arrow"><ArrowRight size={25} /></div>
      <div className="panel">
        <div className="panel-heading"><h3><ArrowRightLeft size={18} />Nouvelle destination</h3></div>
        <>
          {organizationKind ? <OrganizationTree key={`destination-${organizationKind}`} entities={data.entities} kind={organizationKind} mode="destination"
            search={destinationSearch} onSearch={setDestinationSearch} selectedIds={ids} onSelectedIdsChange={setIds}
            destination={destination} onDestinationChange={value => { setDestination(value); setError(''); }} supportMode={supportMode} /> : certificationKind && <CertificationTree
            key={`destination-${certificationKind}`} entities={data.entities} kind={certificationKind} mode="destination"
            search={destinationSearch} onSearch={setDestinationSearch} selectedIds={ids} onSelectedIdsChange={setIds}
            destination={destination} onDestinationChange={value => { setDestination(value); setError(''); }} companyId={companyId} supportMode={supportMode} />}
          <div className="organization-destination">
            <strong>Destination choisie</strong>
            <span>{destination ? destinationLabel : 'Aucune destination sélectionnée'}</span>
            {destination && <button type="button" className="text-link" onClick={() => { setDestination(''); setError(''); }}>Effacer la destination</button>}
          </div>
          <div className="organization-destination-notice"><Notice>{organizationKind
            ? 'L’entreprise conserve ses sites lors d’un changement de client. Les relations ne sont pas dupliquées et aucun objet lié n’est supprimé.'
            : 'Les éléments et leur destination doivent appartenir à la même entreprise. Les objets descendants conservent leurs identifiants.'}</Notice></div>
        </>
      </div>
    </div>
    <div className="panel transfer-review">
      <div><h3><ShieldCheck size={18} />Contrôle avant réaffectation</h3><p>Application immédiate dans le jeu local. La date d’effet et les objets liés réels restent à confirmer.</p></div>
      <button className="btn primary" disabled={!ids.length || !destination} onClick={() => {
        if (ids.some(id => data.entities.find(e => e.id === id)?.parentId === destination)) { setError('Un élément sélectionné est déjà rattaché à cette destination. Retirez-le de la sélection.'); return; }
        setError('');
        confirm({
          title: 'Confirmer la réaffectation', description: `${ids.map(organizationKind ? organizationLabel : certificationLabel).join(', ')} → ${destinationLabel}. Les identifiants des objets et les liens descendants sont conservés.`,
          scope: `${relation.label} · application immédiate simulée`,
          facts: [{ label: 'éléments déplacés', value: ids.length }, { label: 'objets descendants conservés', value: descendants.size - ids.length }, { label: 'matrices liées conservées', value: linkedMatrices.length }, { label: 'audits liés conservés', value: linkedAudits.length }],
          technical: { ids: [
            ...ids.map((id, index) => ({ label: `Source ${index + 1} · ${name(id)}`, value: entityTechnicalId(kind, id) })),
            { label: `Destination · ${name(destination)}`, value: entityTechnicalId(relation.to, destination) },
          ], tables: [] },
          warning: 'Impacts calculés uniquement sur les relations du jeu local. Aucun accès à une base de données. Les audits terminés sont conservés sans modification.',
          apply: () => {
            const ok = commit(`Réaffectation vers « ${name(destination)} »`, `${relation.label} · ${ids.map(name).join(', ')}`, d => reassign(d, relation.from, relation.to, ids, destination));
            if (ok) { setIds([]); setDestination(''); } return ok;
          },
        });
      }}>Prévisualiser les impacts<ArrowRight size={17} /></button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="panel organization-overview"><div className="panel-heading"><h3><Check size={17} />Rattachements actuels</h3><Badge tone="green">Données locales</Badge></div><div className="relation-list">{alphabetic(data.entities.filter(e => e.kind === kind), e => e.name).map(e => <div key={e.id}><strong>{e.name}</strong><ArrowRight size={15} /><span>{name(e.parentId)}</span>{supportMode && <TechnicalInfo ids={[
      { label: 'Source', value: entityTechnicalId(e.kind, e.id) },
      ...(e.parentId && data.entities.some(parent => parent.id === e.parentId && parent.kind === relation.to) ? [{ label: 'Rattachement actuel', value: entityTechnicalId(relation.to, e.parentId) }] : []),
    ]} fields={[{ label: 'Table historique', value: 'Correspondance à confirmer (aucun nom fourni)' }]} tables={[]} />}</div>)}</div></div>
    <Notice warning>La duplication de site et les fonctions historiques (équipements, check-lists, matrices de statuts) restent hors parcours détaillé tant que leur périmètre n’est pas validé. Les ordres de mission sont accessibles dans « Exporter ».</Notice>
  </>;
}
