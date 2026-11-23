import { useState } from 'react';
import { ArrowDownUp, CalendarDays, Languages, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Commit, Data, DateReference, Impact, Task } from './types';
import { completeMissingTranslations, knownTextTranslations, matches, matchesFilter, sortTasksByFrenchName, taskReferenceError } from './domain';
import { createTaskSettings, references, taskRoles, taskTypes } from './data';
import { Badge, CheckField, CopyValueButton, Empty, Field, FilterDropdown, FormActions, Modal, Notice, SearchBox, SectionTitle, Select, Status, TechnicalInfo, TechnicalInlineId } from './ui';
import { fakeTechnicalId, technicalMappings } from './supportConfig';

export function Tasks({ data, commit, confirm, initialSearch = '', supportMode = false }: { data: Data; commit: Commit; confirm: (impact: Impact) => void; initialSearch?: string; supportMode?: boolean }) {
  const [search, setSearch] = useState(initialSearch);
  const [scope, setScope] = useState<string[]>([]);
  const [role, setRole] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(initialSearch ? [] : ['active']);
  const [descending, setDescending] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const filteredTasks = data.tasks.filter(t => matches(search, t.name, ...Object.values(t.labels)) &&
    matchesFilter(t.scope, scope) && matchesFilter(t.role, role) && matchesFilter(t.type, type) &&
    matchesFilter(t.active ? 'active' : 'inactive', status));
  const tasks = sortTasksByFrenchName(filteredTasks, task => task.name);
  if (descending) tasks.reverse();
  const create = () => setEditing({ ...createTaskSettings(), id: crypto.randomUUID(), name: '', type: 'SIMPLE', scope: 'Type d’audit', role: taskRoles[0], active: true, reference: 'Début d’audit', referenceTaskId: '', offset: 0, labels: { fr: '', en: '', ko: '' } });
  return <>
    <SectionTitle eyebrow="PARAMÉTRAGE / TÂCHES" title="Modèles de tâches" description="Définissez les actions, les responsabilités et les échéances de vos audits." action={<button className="btn primary" onClick={create}><Plus size={18} />Créer une tâche</button>} />
    <div className="panel">
      <div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher une tâche…" /><Badge>{tasks.length} modèle{tasks.length > 1 ? 's' : ''}</Badge></div>
      <div className="filters">
        <FilterDropdown label="Périmètre" values={scope} onChange={setScope} allLabel="Tous les périmètres" options={['Type d’audit', 'Contrat', 'Process']} />
        <FilterDropdown label="Type de tâche" values={type} onChange={setType} allLabel="Tous les types" options={[...new Set([...taskTypes, ...data.tasks.map(t => t.type)])]} />
        <FilterDropdown label="Rôle" values={role} onChange={setRole} allLabel="Tous les rôles" options={[...new Set([...taskRoles, ...data.tasks.map(t => t.role)])]} />
        <FilterDropdown label="Statut" values={status} onChange={setStatus} options={[{ value: 'active', label: 'Actifs' }, { value: 'inactive', label: 'Inactifs' }]} />
      </div>
      <div className="table-scroll"><table><thead><tr><th><button className="sort-btn" onClick={() => setDescending(!descending)}>Modèle de tâche <ArrowDownUp size={13} /></button></th><th>Périmètre / rôle</th><th>Calcul de l’échéance</th><th>Statut</th>{supportMode && <th>Informations techniques</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{tasks.map(t => <tr key={t.id}><td><strong>{t.name}</strong><small>{t.type} · {(['fr', 'en', 'ko'] as const).filter(lang => t.languageActive?.[lang] !== false && t.labels[lang].trim()).map(lang => lang.toUpperCase()).join(' / ') || 'Aucune version active'}</small></td><td><span>{t.scope}</span><small>{t.role}</small></td><td><div className="inline"><CalendarDays size={15} />{t.reference === 'Autre tâche' ? data.tasks.find(x => x.id === t.referenceTaskId)?.name : t.reference}</div><small>{t.offset > 0 ? '+' : ''}{t.offset} jour{Math.abs(t.offset) > 1 ? 's' : ''}</small></td><td><Status active={t.active} /></td>{supportMode && <td><code>{fakeTechnicalId('task-template', t.id)}</code><small>ID tâche · {technicalMappings.taskTemplates.tables[0]}</small><CopyValueButton value={fakeTechnicalId('task-template', t.id)} label="l’identifiant" /><CopyValueButton value={technicalMappings.taskTemplates.tables[0]} label="le nom de table" /></td>}<td><button className="icon-btn" aria-label={`Modifier ${t.name}`} onClick={() => setEditing(t)}><Pencil size={17} /></button></td></tr>)}</tbody>
      </table></div>{!tasks.length && <Empty />}
    </div>
    <Notice>Une tâche est définie une seule fois. Ses documents associés sont disponibles dans toutes les matrices qui l’utilisent.</Notice>
    {editing && <TaskEditor task={editing} data={data} supportMode={supportMode} onClose={() => setEditing(null)} onSave={draft => {
      const save = () => commit(`${data.tasks.some(t => t.id === draft.id) ? 'Modification' : 'Création'} de la tâche « ${draft.name} »`, 'Modèle de tâche · futures créations', d => ({ ...d, tasks: [...d.tasks.filter(t => t.id !== draft.id), draft] }));
      if (data.tasks.some(t => t.id === draft.id)) {
        const matrices = data.matrices.filter(m => !m.deleted && m.taskIds.includes(draft.id));
        confirm({ title: 'Modifier ce modèle de tâche ?', description: `Les paramètres de « ${draft.name} » seront modifiés. Les échéances des audits déjà créés restent inchangées dans cette maquette.`, scope: 'Modèle partagé · futures créations', facts: [{ label: 'matrices utilisant ce modèle', value: matrices.length }, { label: 'documents associés', value: data.documents.filter(d => d.taskIds.includes(draft.id)).length }], technical: { ids: [{ label: 'ID tâche', value: fakeTechnicalId('task-template', draft.id) }], tables: [...technicalMappings.taskTemplates.tables] }, warning: !draft.active ? 'La désactivation conserve les associations existantes ; ce modèle ne sera plus proposé à l’ajout.' : undefined, apply: () => { const ok = save(); if (ok) setEditing(null); return ok; } });
      } else if (save()) setEditing(null);
    }} />}
  </>;
}

function TaskEditor({ task, data, supportMode, onSave, onClose }: { task: Task; data: Data; supportMode: boolean; onSave: (task: Task) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => {
    const defaults = createTaskSettings();
    return {
      ...defaults, ...task, labels: { ...task.labels },
      type: taskTypes.includes(task.type) ? task.type : '',
      descriptions: { ...defaults.descriptions, ...task.descriptions },
      languageActive: { ...defaults.languageActive, ...task.languageActive },
    };
  });
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const patch = (change: Partial<Task>) => setDraft(d => ({ ...d, ...change }));
  const availableRoles = [...new Set([...taskRoles, ...data.tasks.map(t => t.role)])].filter(r => matches(roleSearch, r));
  const translate = () => {
    if (!draft.name.trim() && !draft.descriptions.fr.trim()) { setError('Renseignez le nom ou la description avant de proposer des traductions.'); return; }
    const dictionary = knownTextTranslations(data);
    patch({
      labels: { ...draft.labels, ...completeMissingTranslations(draft.name, draft.labels, dictionary) },
      descriptions: { ...draft.descriptions, ...completeMissingTranslations(draft.descriptions.fr, draft.descriptions, dictionary) },
    });
    setTranslated(true); setError('');
  };
  return <Modal title={task.name ? 'Modifier le modèle de tâche' : 'Créer un modèle de tâche'} subtitle="Un paramétrage commun, des dates calculées automatiquement." wide onClose={onClose}
    headerAside={supportMode && <div className="technical-header-id">
      <small>ID tâche · Identifiant simulé</small>
      <code>{fakeTechnicalId('task-template', task.id)}</code>
      <CopyValueButton value={fakeTechnicalId('task-template', task.id)} label="l’identifiant" />
    </div>}>
    <form onSubmit={e => {
      e.preventDefault();
      const cleaned = { ...draft, name: draft.name.trim(), labels: { ...draft.labels, fr: draft.labels.fr.trim() }, referenceTaskId: draft.reference === 'Autre tâche' ? draft.referenceTaskId : '' };
      const invalid = taskReferenceError(data.tasks, cleaned);
      if (!cleaned.name || !cleaned.labels.fr) { setError('Le nom et le libellé français sont obligatoires.'); return; }
      if (!taskTypes.includes(cleaned.type)) { setError('Choisissez un type de tâche dans la liste de démonstration.'); return; }
      if (!Number.isInteger(cleaned.offset)) { setError('Le décalage doit être un nombre entier de jours.'); return; }
      if (invalid) { setError(invalid); return; }
      onSave(cleaned);
    }}>
      <div className="modal-body stack">
        <div className="form-grid">
          <Field label="Nom du modèle *" wide><input required value={draft.name} onChange={e => patch({ name: e.target.value, labels: { ...draft.labels, fr: e.target.value } })} placeholder="Ex. Transmettre le certificat" /></Field>
          <Field label="Description du modèle" wide hint="Texte français ; les propositions anglaise et coréenne apparaissent dans le tableau des langues."><textarea rows={3} value={draft.descriptions.fr} onChange={e => patch({ descriptions: { ...draft.descriptions, fr: e.target.value } })} placeholder="Décrivez l’objectif et les consignes de la tâche…" /></Field>
          <Select label="Type de tâche *" required value={draft.type} onChange={type => patch({ type })} options={[{ value: '', label: 'Choisir un type de tâche' }, ...taskTypes]} />
          <Select label="Périmètre" value={draft.scope} onChange={scope => patch({ scope })} options={['Type d’audit', 'Contrat', 'Process']} />
          <Field label="Rechercher un rôle"><input type="search" value={roleSearch} onChange={e => setRoleSearch(e.target.value)} placeholder="Filtrer les rôles…" /></Field>
          <Select label="Rôle intervenant" value={draft.role} onChange={role => patch({ role })} options={[...new Set([draft.role, ...availableRoles])]} />
        </div>
        {!taskTypes.includes(task.type) && !draft.type && <Notice warning>Le type existant « {task.type} » est conservé dans vos données. Choisissez un type proposé avant d’enregistrer cette modification.</Notice>}
        {draft.scope === 'Contrat' && <Notice warning>Pour les tâches contrat, sélectionnez le type « CONTRAT » et le rôle « Signataire du contrat ».</Notice>}
        <h3 className="subheading"><CalendarDays size={18} />Calcul de l’échéance</h3>
        <div className="form-grid">
          <Select label="Calculer à partir de" value={draft.reference} options={references} onChange={reference => patch({ reference: reference as DateReference })} />
          <Field label="Décalage en jours" hint="Avant : valeur négative · Après : valeur positive"><input type="number" step="1" required value={Number.isFinite(draft.offset) ? draft.offset : ''} onChange={e => patch({ offset: e.target.valueAsNumber })} /></Field>
          {draft.reference === 'Autre tâche' && <Select label="Tâche de référence *" required value={draft.referenceTaskId} onChange={referenceTaskId => patch({ referenceTaskId })} options={[{ value: '', label: 'Choisir une tâche' }, ...data.tasks.filter(t => t.id !== draft.id).map(t => ({ value: t.id, label: t.name }))]} />}
        </div>
        <div className="formula">Date de la tâche = <strong>{draft.reference === 'Autre tâche' ? data.tasks.find(t => t.id === draft.referenceTaskId)?.name || 'Tâche à choisir' : draft.reference}</strong> <Badge tone="blue">{draft.offset >= 0 ? '+' : ''}{Number.isFinite(draft.offset) ? draft.offset : '…'} jours</Badge></div>
        <h3 className="subheading">Options de fonctionnement</h3>
        <CheckField checked={draft.canCompleteBeforeContractValidation} onChange={canCompleteBeforeContractValidation => patch({ canCompleteBeforeContractValidation })}>La tâche peut être terminée avant que le contrat soit validé</CheckField>
        <CheckField checked={draft.mustCompleteBeforeNextTask} onChange={mustCompleteBeforeNextTask => patch({ mustCompleteBeforeNextTask })}>La tâche doit être terminée avant que la suivante le soit</CheckField>
        <CheckField checked={draft.canCompleteBeforeAuditDateConfirmation} onChange={canCompleteBeforeAuditDateConfirmation => patch({ canCompleteBeforeAuditDateConfirmation })}>La tâche peut être terminée avant que la date de l’audit soit confirmée (pour les modèles de tâche de Process d’audit)</CheckField>
        <CheckField checked={draft.isReferenceTask} onChange={isReferenceTask => patch({ isReferenceTask })}>La tâche est une tâche de référence (autre qu’un audit)</CheckField>
        <div className="split"><h3 className="subheading"><Languages size={18} />Libellés multilingues</h3><button type="button" className="btn small" onClick={translate}><Languages size={15} />Proposer les traductions manquantes (EN / KO)</button></div>
        <div className="table-scroll"><table className="model-language-table"><thead><tr><th>Langue</th><th>Actif</th><th>Titre</th><th>Description</th><th>Effacer</th></tr></thead><tbody>
          {(['fr', 'en', 'ko'] as const).map((lang, i) => {
            const language = ['Français', 'Anglais', 'Coréen'][i];
            return <tr key={lang}><td>{language}{supportMode && <TechnicalInlineId value={fakeTechnicalId('task-template-translation', `${task.id}:${lang}`)} />}</td><td><CheckField checked={draft.languageActive[lang]} onChange={active => patch({ languageActive: { ...draft.languageActive, [lang]: active } })}><span className="sr-only">{language} actif</span></CheckField></td>
              <td><input aria-label={`Titre ${language}${lang === 'fr' ? ' *' : ''}`} required={lang === 'fr'} value={draft.labels[lang]} onChange={e => patch({ labels: { ...draft.labels, [lang]: e.target.value } })} /></td>
              <td><textarea aria-label={`Description ${language}`} rows={2} value={draft.descriptions[lang]} onChange={e => patch({ descriptions: { ...draft.descriptions, [lang]: e.target.value } })} /></td>
              <td><button type="button" className="icon-btn" aria-label={`Effacer la version ${language}`} onClick={() => patch({ labels: { ...draft.labels, [lang]: '' }, descriptions: { ...draft.descriptions, [lang]: '' }, languageActive: { ...draft.languageActive, [lang]: false } })}><Trash2 size={16} /></button></td></tr>;
          })}
        </tbody></table></div>
        <small>Le titre français reste obligatoire. Effacer une version vide son titre et sa description et la désactive, sans supprimer les autres langues.</small>
        {translated && <Notice warning>Propositions du dictionnaire local à relire : les textes inconnus sont signalés « à traduire ». Les traductions existantes sont conservées. Aucun service externe n’est connecté.</Notice>}
        <CheckField checked={draft.active} onChange={active => patch({ active })}>Modèle actif</CheckField>
        {supportMode && <TechnicalInfo
          ids={[
            { label: 'ID tâche', value: fakeTechnicalId('task-template', task.id) },
            ...(draft.reference === 'Autre tâche' && draft.referenceTaskId && data.tasks.some(item => item.id === draft.referenceTaskId)
              ? [{ label: 'Tâche de référence', value: fakeTechnicalId('task-template', draft.referenceTaskId) }] : []),
          ]}
          tables={[...technicalMappings.taskTemplates.tables]}
        />}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><FormActions onClose={onClose} />
    </form>
  </Modal>;
}
