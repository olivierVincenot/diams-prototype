import { useState } from 'react';
import { ArrowDownUp, FileCheck2, FlaskConical, Pencil, Plus } from 'lucide-react';
import type { Commit, Data, Impact, Language, ReportRule, SpecificSettingKind } from './types';
import {
  allConfiguredAuditTypesOption, alphabetic, expandReportRuleSelection, matches,
  reportConflict, selectReport, type ReportRuleSelection,
} from './domain';
import { languages, reportAuditTypes, reportStandardsFor as standardsFor, standardTypes } from './data';
import { Badge, CheckField, Empty, Field, FormActions, Modal, MultiSelectDropdown, Notice, SearchBox, SectionTitle, Select, Status, TechnicalInfo } from './ui';
import { fakeTechnicalId, technicalMappings } from './supportConfig';
import { reportSpecificKinds, settingDefinitions } from './specificSettingsConfig';
import { SpecificSettings } from './SpecificSettings';
import { ReportHierarchy } from './ReportHierarchy';
import { ReportTemplateView, TemplateName } from './ReportTemplateView';

type ReportsTab = 'reportFrames' | SpecificSettingKind;

const reportTabs: { key: ReportsTab; label: string }[] = [
  { key: 'reportFrames', label: 'Trames de rapports' },
  ...reportSpecificKinds.map(kind => ({ key: kind, label: settingDefinitions[kind].title })),
];

export function Reports({ data, commit, confirm, supportMode = false }: { data: Data; commit: Commit; confirm: (impact: Impact) => void; supportMode?: boolean }) {
  const [tab, setTab] = useState<ReportsTab>('reportFrames');
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);
  const [editing, setEditing] = useState<ReportRule[] | null>(null);
  const [simType, setSimType] = useState('SM');
  const [simStandard, setSimStandard] = useState('ISO 9001');
  const [simAudit, setSimAudit] = useState('Initiale étape 2');
  const [simLanguage, setSimLanguage] = useState('Français');
  const selected = selectReport(data.reports, simType, simStandard, simAudit, simLanguage);
  const rules = alphabetic(data.reports.filter(rule => matches(query, rule.standard, rule.template, rule.auditType, rule.language)), rule => `${rule.standardType} ${rule.standard} ${rule.auditType} ${rule.language}`);
  if (descending) rules.reverse();

  const editGroup = (rule: ReportRule) => setEditing(rule.groupId
    ? data.reports.filter(item => item.groupId === rule.groupId)
    : [rule]);
  const saveGroup = (draft: ReportRuleSelection): string | null => {
    let expanded: ReportRule[];
    try {
      expanded = expandReportRuleSelection(draft, reportAuditTypes);
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }

    const previousRules = editing || [];
    const previousIds = new Set(previousRules.map(rule => rule.id));
    const groupId = draft.groupId || crypto.randomUUID();
    const candidates = expanded.map((candidate, index) => {
      const previous = previousRules.find(rule =>
        rule.standardType === candidate.standardType && rule.standard === candidate.standard &&
        rule.auditType === candidate.auditType && rule.language === candidate.language);
      const draftId = index === 0 && previousRules[0] && !data.reports.some(item => item.id === previousRules[0].id) ? previousRules[0].id : '';
      return { ...candidate, id: previous?.id || draftId || candidate.id, groupId };
    });
    const currentRules = data.reports.filter(rule => !previousIds.has(rule.id));
    const conflict = findConflict(currentRules, candidates);
    if (conflict) return 'Une règle active existe déjà pour au moins une combinaison sélectionnée. Modifiez-la, désactivez-la ou retirez cette sélection.';

    const summary = `${draft.standards.length} norme(s) · ${draft.auditTypes.includes(allConfiguredAuditTypesOption) ? reportAuditTypes.length : draft.auditTypes.length} type(s) d’audit · ${draft.languages.length} langue(s)`;
    confirm({
      title: 'Enregistrer cette trame de rapport ?',
      description: `« ${draft.template.trim()} » sera utilisée pour ${candidates.length} combinaison(s) de norme, type d’audit et langue.`,
      scope: `${draft.standardType} · ${summary}`,
      facts: [{ label: 'combinaisons enregistrées', value: candidates.length }, { label: 'statut', value: draft.active ? 'Actif' : 'Inactif' }],
      technical: { ids: candidates.map((rule, index) => ({ label: `ID trame ${index + 1}`, value: fakeTechnicalId('report-frame', rule.id) })), tables: [...technicalMappings.reportFrames.tables] },
      apply: () => commit(`Enregistrement de la trame « ${draft.template.trim()} »`, `${draft.standardType} · ${summary}`, current => {
        const remaining = current.reports.filter(rule => !previousIds.has(rule.id));
        const conflictNow = findConflict(remaining, candidates);
        if (conflictNow) throw new Error('Une règle active concurrente a été enregistrée entre-temps.');
        return { ...current, reports: [...remaining, ...candidates] };
      }),
    });
    return null;
  };

  const newRule: ReportRule = {
    id: crypto.randomUUID(),
    standardType: 'SM',
    standard: 'ISO 50001',
    auditType: 'Recertification',
    language: 'Français',
    template: '',
    active: true,
  };
  const createRule = () => { setTab('reportFrames'); setEditing([newRule]); };

  return <>
    <SectionTitle
      eyebrow="PARAMÉTRAGE / RAPPORTS"
      title="Trames / documents spécifiques"
      description="Gérez les trames de rapports, de planning et les documents spécifiques depuis un même espace."
      action={tab === 'reportFrames' && <button className="btn primary" onClick={createRule}><Plus size={18} />Créer une règle</button>}
    />
    <nav className="report-settings-tabs" aria-label="Trames et documents spécifiques">
      {reportTabs.map(item => <button key={item.key} className={tab === item.key ? 'selected' : ''} aria-current={tab === item.key ? 'page' : undefined}
        onClick={() => { setTab(item.key); setEditing(null); }}>{item.label}</button>)}
    </nav>
    {tab === 'reportFrames' ? <>
      <div className="panel">
        <div className="toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Rechercher une norme, une trame…" /><Badge>{rules.length} règles</Badge></div>
      </div>
      <ReportHierarchy records={rules} pathsFor={rule => [[rule.standardType, rule.standard, rule.auditType]]}>
        {branchRules => <ReportTemplateView records={branchRules} describe={rule => ({
          template: rule.template, language: rule.language,
          scope: { standardType: rule.standardType, standards: [rule.standard], auditTypes: [rule.auditType] },
        })}>
        {displayedRules => (
      <div className="panel">
        <div className="table-scroll"><table><thead><tr>
          <th><button className="sort-btn" onClick={() => setDescending(!descending)}>Norme <ArrowDownUp size={13} /></button></th>
          <th>Type d’audit</th><th>Langue</th><th>Template</th><th>Statut</th>
          {supportMode && <th>Informations techniques</th>}<th>Action</th>
        </tr></thead><tbody>{displayedRules.map(rule => <tr key={rule.id}>
          <td><strong>{rule.standard}</strong><small>{rule.standardType} · {rule.standard === 'Toutes les normes' ? 'Règle générique' : 'Prioritaire sur la règle générique'}</small></td>
          <td>{rule.auditType}</td><td>{rule.language}</td><td><TemplateName name={rule.template} /></td><td><Status active={rule.active} /></td>
          {supportMode && <td><TechnicalInfo
            ids={[{ label: 'ID trame fictif', value: fakeTechnicalId('report-frame', rule.id) }]}
            fields={[{ label: 'Type d’audit', value: rule.auditType }, { label: 'Langue', value: rule.language }]}
            tables={[...technicalMappings.reportFrames.tables]}
          /></td>}
          <td><button className="icon-btn" aria-label={`Modifier la règle ${rule.standard}`} onClick={() => editGroup(rule)}><Pencil size={17} /></button></td>
        </tr>)}</tbody></table></div>
        {!displayedRules.length && <Empty />}
      </div>
        )}
        </ReportTemplateView>}
      </ReportHierarchy>
      <div className="panel simulator">
        <div className="panel-heading"><h3><FlaskConical size={18} />Tester la sélection d’une trame</h3><Badge tone="blue">Simulation locale</Badge></div>
        <div className="simulator-body stack"><p>Vérifiez quelle règle serait utilisée pour un audit donné.</p><div className="form-grid four">
          <Select label="Type de norme" value={simType} onChange={value => { setSimType(value); setSimStandard(standardsFor(value)[0]); }} options={standardTypes} />
          <Select label="Norme" value={simStandard} onChange={setSimStandard} options={standardsFor(simType)} />
          <Select label="Type d’audit" value={simAudit} onChange={setSimAudit} options={reportAuditTypes} />
          <Select label="Langue" value={simLanguage} onChange={setSimLanguage} options={languages} />
        </div>
          <div className={`report-result ${!selected ? 'no-rule' : ''}`}><FileCheck2 size={26} /><div>
            <small>{selected ? 'TRAME SÉLECTIONNÉE' : 'AUCUNE TRAME APPLICABLE'}</small>
            <strong>{selected?.template || 'Ajoutez une règle pour cette combinaison.'}</strong>
            <span>{selected ? selected.standard === 'Toutes les normes' ? 'Repli sur la règle générique du type de norme.' : 'La règle spécifique surcharge la règle générique.' : 'Aucun rapport ne serait généré.'}</span>
          </div>{selected && <Badge tone="green">{selected.standard === 'Toutes les normes' ? 'Générique' : 'Spécifique'}</Badge>}</div>
          {supportMode && selected && <TechnicalInfo ids={[{ label: 'ID trame sélectionné', value: fakeTechnicalId('report-frame', selected.id) }]} tables={[...technicalMappings.reportFrames.tables]} />}
        </div>
      </div>
      <Notice>Priorité : norme précise, puis « Toutes les normes » du même type. « Tous les types d’audits » développe la règle sur les types configurés dans cette maquette.</Notice>
      {editing && <ReportEditor key={editing.map(rule => rule.id).join(':')} rules={editing} data={data} supportMode={supportMode} onClose={() => setEditing(null)} onSave={saveGroup} />}
    </> : <SpecificSettings
      key={tab}
      data={data}
      commit={commit}
      confirm={confirm}
      supportMode={supportMode}
      allowedKinds={[tab]}
      showSectionTitle={false}
    />}
  </>;
}

function findConflict(existing: ReportRule[], candidates: ReportRule[]): boolean {
  const accumulated = [...existing];
  for (const candidate of candidates) {
    if (reportConflict(accumulated, candidate)) return true;
    accumulated.push(candidate);
  }
  return false;
}

function ReportEditor({ rules, data, supportMode, onSave, onClose }: {
  rules: ReportRule[];
  data: Data;
  supportMode: boolean;
  onSave: (draft: ReportRuleSelection) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ReportRuleSelection>(() => ({
    groupId: rules[0].groupId,
    standardType: rules[0].standardType,
    standards: [...new Set(rules.map(rule => rule.standard))],
    auditTypes: [...new Set(rules.map(rule => rule.auditType))],
    languages: [...new Set(rules.map(rule => rule.language))],
    template: rules[0].template,
    active: rules.every(rule => rule.active),
  }));
  const [error, setError] = useState('');
  const patch = (change: Partial<ReportRuleSelection>) => setDraft(current => ({ ...current, ...change }));
  const auditOptions = [
    { value: allConfiguredAuditTypesOption, label: `Tous les types d’audits configurés pour ${draft.standardType} (${reportAuditTypes.length})` },
    ...reportAuditTypes.map(value => ({ value, label: value })),
  ];
  const optionsForStandards = [
    { value: 'Toutes les normes', label: 'Toutes les normes' },
    ...standardsFor(draft.standardType).map(value => ({ value, label: value })),
  ];

  return <Modal title="Paramétrer une trame de rapport" onClose={onClose}>
    <form onSubmit={event => {
      event.preventDefault();
      if (!draft.template.trim()) { setError('Renseignez le nom du template.'); return; }
      if (!draft.standards.length || !draft.auditTypes.length || !draft.languages.length) {
        setError('Sélectionnez au moins une norme, un type d’audit et une langue.');
        return;
      }
      const result = onSave(draft);
      if (result) setError(result);
    }}>
      <div className="modal-body stack">
        {supportMode && <TechnicalInfo
          ids={rules.map((rule, index) => ({ label: `ID trame ${index + 1} · fictif`, value: fakeTechnicalId('report-frame', rule.id) }))}
          fields={[
            { label: 'Normes', value: draft.standards.join(', ') },
            { label: 'Types d’audit', value: draft.auditTypes.includes(allConfiguredAuditTypesOption) ? `Tous les types configurés (${reportAuditTypes.join(', ')})` : draft.auditTypes.join(', ') },
            { label: 'Langues', value: draft.languages.join(', ') },
          ]}
          tables={[...technicalMappings.reportFrames.tables]}
        />}
        <div className="form-grid">
          <Select label="Type de norme" value={draft.standardType} onChange={standardType => {
            const available = standardsFor(standardType);
            patch({ standardType, standards: draft.standards.filter(value => value === 'Toutes les normes' || available.includes(value)).length
              ? draft.standards.filter(value => value === 'Toutes les normes' || available.includes(value))
              : [available[0]] });
          }} options={standardTypes} />
          <MultiSelectDropdown
            label="Norme(s)"
            options={optionsForStandards}
            values={draft.standards}
            onChange={standards => patch({ standards })}
            exclusiveValue="Toutes les normes"
          />
          <MultiSelectDropdown
            label="Type(s) d’audit"
            options={auditOptions}
            values={draft.auditTypes}
            onChange={auditTypes => patch({ auditTypes })}
            exclusiveValue={allConfiguredAuditTypesOption}
          />
          <MultiSelectDropdown
            label="Langue(s)"
            options={languages.map(value => ({ value, label: value }))}
            values={draft.languages}
            onChange={selectedLanguages => patch({ languages: selectedLanguages as Language[] })}
          />
          <Field label="Nom du template *" wide hint="Référence fictive : aucun téléchargement ni dépôt de fichier."><input required value={draft.template} onChange={event => patch({ template: event.target.value })} placeholder="Ex. Rapport ISO 50001.docx" /></Field>
        </div>
        <CheckField checked={draft.active} onChange={active => patch({ active })}>Règle active</CheckField>
        <Notice>{draft.standards.includes('Toutes les normes')
          ? 'Règle générique : utilisée uniquement en l’absence de règle spécifique applicable.'
          : 'Une règle sera créée pour chaque combinaison de norme, type d’audit et langue sélectionnée.'}</Notice>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <FormActions onClose={onClose} />
    </form>
  </Modal>;
}

