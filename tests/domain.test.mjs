import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from '../src/data.ts';
import { createDocumentType } from '../src/documentTypeData.ts';
import { demoAuditors, demoExportAudits, filterExportAudits, isoWeek, missionEmailDraft, workloadCsv } from '../src/exportData.ts';
import {
  analyzeDemoDocumentTags, azureBlobPathFor, completeMissingTranslations, documentGenerationMode, documentScriptReadinessError, generateDemoSqlScript, groupRecordsByTemplate, knownTextTranslations,
  certificationEnterpriseId, certificationPath, certificationPaths, matches, matchesFilter, matricesForAuditKind, matrixImpact, matrixKindsForAudit, matrixStandardLabel, organizationPaths,
  allConfiguredAuditTypesOption, deleteMatrix, expandMatrixAuditSelection, expandReportRuleSelection, propagateMatrix, reassign, replaceDocumentVersion, reportConflict, reportPathMatches, reportScopePaths, selectReport, unassignedReportScope,
  simulateAzureReplacement, sortTasksByFrenchName, taskReferenceError, modelTranslationSuggestions, templateError, transferRelations, translationSuggestions,
  validateDocumentSqlScript, saveDocumentType, deleteDocumentType, prepareGeneratedDocumentFile, templateFileNameForLogicalName,
} from '../src/domain.ts';

test('un fichier valide renseigne seulement le nom logique vide de la langue générée', () => {
  const document = createInitialData().documents[0];
  const generated = {
    ...document, mandatory: false, workDocument: false, generationMode: 'after',
    versions: { ...document.versions, en: { ...document.versions.en, templateLogicalName: '  ' } },
  };
  const fileName = 'Audit confirmation letter EN.docx';
  const updated = prepareGeneratedDocumentFile(generated, 'en', fileName);
  assert.equal(updated.versions.en.templateLogicalName, fileName);
  assert.equal(updated.versions.fr, generated.versions.fr);
  assert.equal(updated.versions.ko, generated.versions.ko);
  assert.equal(updated.versions.en.sqlScriptStatus, 'À générer');
  const customized = { ...updated, versions: { ...updated.versions, en: { ...updated.versions.en, templateLogicalName: 'Mon nom personnalisé' } } };
  assert.equal(prepareGeneratedDocumentFile(customized, 'en', 'Autre.docx').versions.en.templateLogicalName, 'Mon nom personnalisé');
  const notGenerated = { ...generated, generationMode: 'none' };
  assert.equal(prepareGeneratedDocumentFile(notGenerated, 'en', fileName), notGenerated);
});

test('le fichier généré doit correspondre au nom logique pour l’envoi simulé', () => {
  assert.equal(templateFileNameForLogicalName('Audit EN'), 'Audit EN.docx');
  assert.equal(templateFileNameForLogicalName('Audit EN.DOCX'), 'Audit EN.DOCX');
  assert.equal(templateFileNameForLogicalName('dossier/fichier'), null);
  const version = { ...createInitialData().documents[0].versions.fr, templateLogicalName: 'Audit FR', analyzedFileName: 'Autre.docx' };
  assert.match(documentScriptReadinessError(version, 'Autre.docx'), /bloqué/);
  assert.equal(documentScriptReadinessError({ ...version, analyzedFileName: 'Audit FR.docx' }, 'Audit FR.docx'), null);
});

test('types documentaires : création, renommage des références et suppression protégée', () => {
  const data = createInitialData();
  const draft = createDocumentType('nouveau', 'Type personnalisé');
  assert.deepEqual(draft.languageActive, { fr: true, en: true, ko: true });
  let next = saveDocumentType(data, draft);
  next = { ...next, documents: [...next.documents, { ...next.documents[0], id: 'custom-document', type: draft.name }] };
  assert.throws(() => deleteDocumentType(next, draft.id), /utilisé/);
  next = saveDocumentType(next, { ...draft, labels: { ...draft.labels, fr: 'Titre modifié', en: 'Changed title' }, active: false });
  assert.equal(next.documents.find(document => document.id === 'custom-document').type, 'Titre modifié');
  assert.equal(next.documentTypes.find(type => type.id === draft.id).labels.en, 'Changed title');
  assert.throws(() => saveDocumentType(next, { ...draft, id: 'duplicate', labels: { ...draft.labels, fr: 'titre modifié' } }), /déjà/);
  next = { ...next, documents: next.documents.filter(document => document.id !== 'custom-document') };
  assert.ok(!deleteDocumentType(next, draft.id).documentTypes.some(type => type.id === draft.id));
});

test('les choix de réaffectation suivent l’ordre demandé', () => {
  assert.deepEqual(transferRelations.map(({ from, to }) => [from, to]), [
    ['auditType', 'certification'], ['certification', 'scheme'], ['site', 'enterprise'], ['enterprise', 'client'],
  ]);
});

test('les exemples fictifs conservent les paramètres nécessaires aux parcours', () => {
  const data = createInitialData();
  const planning = data.tasks.find(task => task.id === 'demo-workbook-task-7');
  assert.equal(planning.name, 'Démo · Planifier un audit');
  assert.equal(planning.type, 'SIMPLE');
  assert.equal(planning.scope, 'Process');
  assert.equal(planning.role, 'Chargé Administratif');
  assert.equal(planning.reference, 'Début d’audit');
  assert.equal(planning.offset, -30);
  assert.equal(planning.mustCompleteBeforeNextTask, true);
  assert.equal(planning.isReferenceTask, true);
  assert.match(planning.descriptions.fr, /durée de l’audit/);
  assert.deepEqual(planning.languageActive, { fr: true, en: true, ko: true });
  assert.equal(planning.labels.en, '');
  const corrective = data.tasks.find(task => task.id === 'demo-workbook-task-1');
  assert.equal(corrective.type, 'ACTION_CORRECTIVE_PREUVE');
  assert.equal(corrective.reference, 'Fin d’audit');
  assert.equal(corrective.offset, 30);
  assert.equal(corrective.mustCompleteBeforeNextTask, false);
});

test('les extractions filtrent les bonnes dates, les bornes incluses, la certification et l’auditeur', () => {
  const rows = demoExportAudits;
  assert.deepEqual(filterExportAudits(rows, '2026-11-23', '2026-12-14', '', 'cycleStart').map(row => row.id), [rows[0].id, rows[1].id]);
  assert.deepEqual(filterExportAudits(rows, '2026-12-03', '2026-12-17', 'Qualification réglementaire', 'auditStart', 'demo-auditor-1').map(row => row.id), [rows[1].id]);
  assert.equal(filterExportAudits(rows, '2026-12-03', '2026-12-17', '', 'auditStart', 'demo-auditor-2').length, 0);
  assert.equal(isoWeek('2021-01-01'), '53');
  assert.equal(isoWeek('2026-11-23'), '48');
  assert.deepEqual(filterExportAudits(rows, '2027-01-13', '2027-01-13', '', 'auditStart', 'demo-auditor-2').map(row => row.id), [rows[2].id]);
});

test('le brouillon de l’ordre de mission reprend le destinataire et le détail des seules missions sélectionnées', () => {
  const selected = [demoExportAudits[0], demoExportAudits[1]];
  const draft = missionEmailDraft(demoAuditors[0], selected, '2026-12-01', '2026-12-31');
  const url = new URL(draft.href);
  const body = draft.body;
  assert.equal(decodeURIComponent(url.pathname), demoAuditors[0].email);
  assert.match(url.searchParams.get('subject'), /01\/12\/2026 au 31\/12\/2026/);
  assert.match(body, /Semaine 49 · du 03\/12\/2026 \(matin\) au 03\/12\/2026 \(après-midi\)/);
  assert.match(body, /Chargé commercial/);
  assert.match(body, /Responsable d’audit : Alex Martin/);
  assert.match(body, /Norme\(s\) : ISO 9001/);
  assert.match(body, /Site Démo Sud \(Production\)/);
  assert.doesNotMatch(body, /Site Démo Ouest/);
  assert.match(body, /démonstration/i);
  assert.equal(draft.requiresPaste, true);
  assert.equal(url.searchParams.get('body'), null);
  const short = missionEmailDraft(demoAuditors[0], [selected[0]], '2026-12-01', '2026-12-31');
  assert.equal(short.requiresPaste, false);
  assert.equal(new URL(short.href).searchParams.get('body'), short.body);
});

test('le CSV reprend uniquement les colonnes affichées et échappe le contenu et les formules', () => {
  const rows = [{ ...demoExportAudits[0], company: '=FORMULE', site: 'Site; "Nord"' }];
  const csv = workloadCsv(rows, ['site', 'company']);
  assert.equal(csv, '\uFEFF"Entreprise";"Site"\r\n"\'=FORMULE";"Site; ""Nord"""');
});

test('les propositions complètent seulement les langues vides et signalent les textes inconnus', () => {
  const known = [
    { fr: 'Préparer un audit', en: '', ko: '[KO · 번역 필요] Préparer un audit' },
    { fr: 'Préparer un audit', en: 'Prepare an audit', ko: '심사 준비' },
  ];
  assert.deepEqual(completeMissingTranslations(' préparer un audit ', { en: 'Traduction personnalisée', ko: '' }, known),
    { en: 'Traduction personnalisée', ko: '심사 준비' });
  assert.deepEqual(completeMissingTranslations('Texte inconnu', { en: '', ko: '' }, known),
    { en: '[EN · à traduire] Texte inconnu', ko: '[KO · 번역 필요] Texte inconnu' });
  assert.deepEqual(completeMissingTranslations('  ', { en: 'Ancien', ko: '' }, known), { en: 'Ancien', ko: '' });
});

test('le dictionnaire local réutilise aussi les textes des paramétrages spécifiques', () => {
  const data = createInitialData();
  const item = data.specificSettings.find(setting => setting.kind === 'notice');
  item.textTranslations = { content: { en: 'Local notice', ko: '지역 안내' } };
  const dictionary = knownTextTranslations(data);
  assert.deepEqual(completeMissingTranslations(item.values.content, { en: '', ko: '' }, dictionary),
    { en: 'Local notice', ko: '지역 안내' });
});

test('la cartographie conserve les branches vides et les sites ou entreprises sans parent', () => {
  const entities = [
    { id: 'c1', kind: 'client', name: 'Client', parentId: '' },
    { id: 'c2', kind: 'client', name: 'Client vide', parentId: '' },
    { id: 'e1', kind: 'enterprise', name: 'Entreprise', parentId: 'c1' },
    { id: 'e2', kind: 'enterprise', name: 'Entreprise isolée', parentId: 'missing' },
    { id: 's1', kind: 'site', name: 'Site', parentId: 'e1' },
    { id: 's2', kind: 'site', name: 'Site isolé', parentId: 'missing' },
  ];
  assert.deepEqual(organizationPaths(entities).map(path => [path.client?.id ?? null, path.enterprise?.id ?? null, path.site?.id ?? null]), [
    ['c2', null, null], ['c1', 'e1', 's1'], [null, 'e2', null], [null, null, 's2'],
  ]);
});

test('la cartographie de certification retrouve les cinq niveaux et les branches sans parent', () => {
  const { entities } = createInitialData();
  assert.deepEqual(certificationPath(entities, entities.find(item => item.id === 'at1')).map(item => item?.id),
    ['cl1', 'e1', 'sc1', 'c1', 'at1']);
  const orphan = { id: 'isolated', kind: 'certification', name: 'Isolée', parentId: 'absent' };
  const paths = certificationPaths([...entities, orphan], true);
  assert.ok(paths.some(path => path.map(item => item?.id ?? null).join(',') === ',,,isolated,'));
  assert.equal(certificationEnterpriseId([...entities, orphan], orphan.id), null);
  assert.ok(certificationPaths(entities, false).every(path => path.length === 4));
});

test('l’organisation fictive conserve les schémas et les cycles associés', () => {
  const { entities } = createInitialData();
  const enterprise = entities.find(entity => entity.id === 'demo-organization-enterprise');
  assert.equal(entities.find(entity => entity.id === 'demo-organization-client').name, 'Groupe Démo');
  const schemes = entities.filter(entity => entity.kind === 'scheme' && entity.parentId === enterprise.id);
  assert.equal(enterprise.parentId, 'demo-organization-client');
  assert.equal(schemes.length, 11);
  const sens = schemes.find(scheme => scheme.id === 'demo-organization-scheme-alpha');
  assert.deepEqual(sens.details, [{ label: 'Norme', value: 'ISO 14001:2015' }]);
  const certifications = entities.filter(entity => entity.kind === 'certification' && entity.parentId === sens.id);
  assert.equal(certifications.length, 2);
  const cycles = entities.filter(entity => entity.kind === 'auditType' && entity.parentId === 'demo-organization-certification-a');
  assert.deepEqual(cycles.map(cycle => [cycle.name, cycle.details[0].value]), [
    ['Surveillance Démo A', '15/03/2031'], ['Surveillance Démo B', '15/03/2032'],
    ['Contrôle documentaire Démo', '15/03/2033'],
  ]);
  assert.ok(cycles.every(cycle => certificationEnterpriseId(entities, cycle.id) === enterprise.id));
  assert.equal(entities.filter(entity => entity.kind === 'auditType' && entity.parentId === 'demo-organization-certification-b').length, 0);
});

test('la suppression logique cible une seule matrice et conserve tous ses audits et ses tâches', () => {
  const data = createInitialData();
  const original = structuredClone(data);
  const matrix = data.matrices[0];
  const result = deleteMatrix(data, matrix.id);
  assert.ok(data.audits.some(audit => audit.matrixId === matrix.id && audit.status === 'Terminé'));
  assert.deepEqual(result, {
    ...original,
    matrices: original.matrices.map(item => item.id === matrix.id ? { ...item, deleted: true, active: false } : item),
  });
  assert.deepEqual(data, original);
  assert.equal(result.audits, data.audits);
  assert.equal(result.tasks, data.tasks);
  const unrelated = result.matrices.filter(item => item.id !== matrix.id);
  assert.deepEqual(unrelated, data.matrices.filter(item => item.id !== matrix.id));
});

test('une matrice sans audit peut être supprimée mais une matrice inconnue ou déjà supprimée est refusée', () => {
  const data = { ...createInitialData(), audits: [] };
  const result = deleteMatrix(data, data.matrices[0].id);
  assert.equal(result.matrices[0].deleted, true);
  assert.throws(() => deleteMatrix(data, 'missing-matrix'), /introuvable/);
  assert.throws(() => deleteMatrix(result, data.matrices[0].id), /déjà supprimée/);
});

test('les anciennes trames restent sans rattachement et les niveaux vides sont explicites', () => {
  assert.deepEqual(reportScopePaths(), [[unassignedReportScope, unassignedReportScope, unassignedReportScope]]);
  assert.deepEqual(reportScopePaths({ standardType: ' SM ', standards: [], auditTypes: ['Surveillance'] }),
    [['SM', unassignedReportScope, 'Surveillance']]);
});

test('les rattachements multiples donnent des branches distinctes filtrables par parent', () => {
  const paths = reportScopePaths({
    standardType: 'SM',
    standards: ['ISO 9001', 'ISO 14001', ' ISO 9001 '],
    auditTypes: ['Surveillance', 'Recertification', 'Surveillance'],
  });
  assert.deepEqual(paths, [
    ['SM', 'ISO 9001', 'Surveillance'], ['SM', 'ISO 9001', 'Recertification'],
    ['SM', 'ISO 14001', 'Surveillance'], ['SM', 'ISO 14001', 'Recertification'],
  ]);
  assert.equal(paths.filter(path => reportPathMatches(path, ['SM'])).length, 4);
  assert.equal(paths.filter(path => reportPathMatches(path, ['SM', 'ISO 9001'])).length, 2);
  assert.deepEqual(paths.filter(path => reportPathMatches(path, ['SM', 'ISO 14001', 'Surveillance'])),
    [['SM', 'ISO 14001', 'Surveillance']]);
  assert.equal(paths.some(path => reportPathMatches(path, ['Automobile'])), false);
  assert.ok(paths.every(path => reportPathMatches(path, [])));
});

test('la vue par template compte les types d’audit distincts et conserve toutes les fiches associées', () => {
  const records = [
    { id: '1', template: 'Certificat commun.docx', language: 'Français', scope: { standardType: 'SM', standards: ['ISO 9001'], auditTypes: ['Surveillance', 'Recertification'] } },
    { id: '2', template: ' Certificat commun.docx ', language: 'Anglais', scope: { standardType: 'SM', standards: ['ISO 9001', 'ISO 14001'], auditTypes: ['Surveillance', 'Initiale étape 2'] } },
    { id: '3', template: 'Certificat commun.docx', language: 'Français', scope: { standardType: 'SM', standards: ['ISO 14001'], auditTypes: [] } },
    { id: '4', template: 'Autre certificat.docx', language: 'Français', scope: { standardType: 'SM', standards: ['ISO 9001'], auditTypes: ['Surveillance'] } },
  ];
  const before = structuredClone(records);
  const groups = groupRecordsByTemplate(records, record => record);
  assert.deepEqual(groups.map(group => group.template), ['Autre certificat.docx', 'Certificat commun.docx']);
  const shared = groups[1];
  assert.deepEqual(shared.records.map(record => record.id), ['1', '2', '3']);
  assert.deepEqual(shared.auditTypes, ['Initiale étape 2', 'Recertification', 'Surveillance']);
  assert.deepEqual(shared.standards, ['ISO 14001', 'ISO 9001']);
  assert.deepEqual(shared.languages, ['Anglais', 'Français']);
  assert.equal(shared.unassignedAuditRecords, 1);
  assert.deepEqual(records, before);
});

test('les templates ressemblants restent distincts et les audits manquants ne gonflent pas les compteurs', () => {
  const records = [
    { template: 'certificat-fr.docx', language: '', scope: { standardType: '', standards: [], auditTypes: [' ', unassignedReportScope] } },
    { template: 'certificat_fr.docx', language: 'Français' },
    { template: ' ', language: '' },
  ];
  const groups = groupRecordsByTemplate(records, record => record);
  assert.equal(groups.length, 3);
  assert.ok(groups.every(group => group.auditTypes.length === 0 && group.unassignedAuditRecords === 1));
  assert.equal(groups.find(group => group.template === '').records.length, 1);
  assert.deepEqual(groupRecordsByTemplate([], record => record), []);
});

test('la recherche tolère casse, accents, espaces et ponctuation', () => {
  assert.equal(matches(' FINALISER-la planification ', 'Finaliser la planification'), true);
  assert.equal(matches('decision pov', 'Décision POV'), true);
  assert.equal(matches('absent', 'Décision POV'), false);
});

test('les filtres combinent plusieurs choix sans doublonner les résultats et un filtre vide les laisse tous passer', () => {
  const records = [
    { id: '1', type: 'Rapport', status: 'active' },
    { id: '2', type: 'Certificat', status: 'active' },
    { id: '3', type: 'Courrier', status: 'active' },
    { id: '4', type: 'Rapport', status: 'inactive' },
  ];
  const filter = (types, statuses) => records.filter(record =>
    matchesFilter(record.type, types) && matchesFilter(record.status, statuses)).map(record => record.id);
  assert.deepEqual(filter(['Rapport', 'Certificat'], ['active']), ['1', '2']);
  assert.deepEqual(filter(['Rapport'], ['active', 'inactive']), ['1', '4']);
  assert.deepEqual(filter([], ['active']), ['1', '2', '3']);
  assert.deepEqual(filter([], []), ['1', '2', '3', '4']);
});

test('le tri des tâches respecte la locale française, ignore la casse et les espaces périphériques', () => {
  const tasks = [{ name: ' zèbre ' }, { name: 'Éclair' }, { name: 'eclair' }, { name: ' école ' }, { name: 'Ecole' }];
  assert.deepEqual(sortTasksByFrenchName(tasks, task => task.name).map(task => task.name),
    ['eclair', 'Éclair', 'Ecole', ' école ', ' zèbre ']);
  assert.equal(sortTasksByFrenchName([{ name: '  Réaliser ' }, { name: 'réaliser' }], task => task.name)[0].name, '  Réaliser ');
  const updated = [...tasks, { name: 'Archiver' }].map(task =>
    task.name === ' zèbre ' ? { name: 'Classer' } : task);
  assert.deepEqual(sortTasksByFrenchName(updated, task => task.name).map(task => task.name),
    ['Archiver', 'Classer', 'eclair', 'Éclair', 'Ecole', ' école ']);
});

test('la traduction des tâches propose séparément le nom et la description dans les deux langues', () => {
  const data = createInitialData();
  data.tasks[0].descriptions = { fr: 'Préparer la mission', en: 'Prepare the assignment', ko: '업무 준비' };
  const result = modelTranslationSuggestions({ name: ' Planifier l’audit ', descriptions: { fr: 'Préparer la mission', en: '', ko: '' } }, data);
  assert.deepEqual(result, {
    labels: { en: 'Schedule the audit', ko: '심사 일정 수립' },
    descriptions: { en: 'Prepare the assignment', ko: '업무 준비' },
  });
  const unknown = modelTranslationSuggestions({ name: 'Nom inconnu', descriptions: { fr: 'Description inconnue', en: '', ko: '' } }, data);
  assert.match(unknown.labels.en, /à traduire.*Nom inconnu/);
  assert.match(unknown.labels.ko, /번역 필요.*Nom inconnu/);
  assert.match(unknown.descriptions.en, /à traduire.*Description inconnue/);
  assert.match(unknown.descriptions.ko, /번역 필요.*Description inconnue/);
});

test('une description vide ne propose aucun remplacement et un nom vide est refusé', () => {
  const data = createInitialData();
  const task = { name: 'Planifier l’audit', descriptions: { fr: '  ', en: 'Consigne personnalisée', ko: '기존 설명' } };
  const before = structuredClone(task);
  assert.equal(modelTranslationSuggestions(task, data).descriptions, undefined);
  assert.deepEqual(task, before);
  assert.throws(() => modelTranslationSuggestions({ name: ' ' }, data), /Renseignez le nom/);
});

test('une sélection multiple crée des matrices indépendantes de même modèle et conserve l’identifiant principal', () => {
  const data = createInitialData();
  const matrix = { ...data.matrices[0], id: 'new-primary', family: 'new-family', descriptions: { fr: 'Consigne', en: 'Instruction', ko: '지침' } };
  const before = structuredClone(matrix);
  let nextId = 0;
  const result = expandMatrixAuditSelection(matrix, ['at2', 'at1', 'at3', 'at2'], data, () => `new-${++nextId}`);
  assert.equal(result.draft.id, matrix.id);
  assert.equal(result.draft.auditTypeId, 'at1');
  assert.deepEqual(result.additions.map(m => m.auditTypeId), ['at2', 'at3']);
  assert.equal(new Set([result.draft.id, ...result.additions.map(m => m.id)]).size, 3);
  assert.deepEqual(result.retained, []);
  for (const item of [result.draft, ...result.additions]) {
    assert.equal(item.family, matrix.family);
    assert.equal(item.name, matrix.name);
    assert.deepEqual(item.taskIds, matrix.taskIds);
    assert.deepEqual(item.descriptions, matrix.descriptions);
  }
  result.additions[0].taskIds.pop();
  result.additions[0].labels.fr = 'Autre nom';
  result.additions[0].descriptions.fr = 'Autre consigne';
  assert.deepEqual(matrix, before);
  assert.deepEqual(result.draft.taskIds, before.taskIds);
  assert.deepEqual(result.additions[1].descriptions, before.descriptions);
});

test('les rattachements existants sont conservés sans doublon et les matrices supprimées ne sont pas réactivées', () => {
  const data = createInitialData();
  const matrix = data.matrices.find(m => m.id === 'm2');
  const before = structuredClone(data);
  const result = expandMatrixAuditSelection(matrix, ['at1', 'at2', 'at4'], data, () => 'added-iso');
  assert.deepEqual(result.retained.map(m => m.id), ['m4']);
  assert.deepEqual(result.additions.map(m => [m.id, m.auditTypeId]), [['added-iso', 'at4']]);
  assert.deepEqual(data, before);
  data.matrices.find(m => m.id === 'm4').deleted = true;
  const afterDeletion = expandMatrixAuditSelection(matrix, ['at1', 'at2'], data, () => 'new-association');
  assert.equal(afterDeletion.retained.length, 0);
  assert.equal(afterDeletion.additions[0].id, 'new-association');
  assert.equal(data.matrices.find(m => m.id === 'm4').deleted, true);
});

test('les sélections d’audit vides ou inconnues sont refusées et un changement conserve l’identité de la matrice', () => {
  const data = createInitialData();
  const matrix = data.matrices[0];
  const before = structuredClone(matrix);
  assert.throws(() => expandMatrixAuditSelection(matrix, [], data), /au moins un type/);
  assert.throws(() => expandMatrixAuditSelection(matrix, ['inconnu'], data), /introuvable/);
  const changed = expandMatrixAuditSelection(matrix, ['at2'], data);
  assert.equal(changed.draft.id, matrix.id);
  assert.equal(changed.draft.auditTypeId, 'at2');
  assert.deepEqual(matrix, before);
});

test('les descriptions de matrices sont traduites depuis les textes locaux et restent propres à la matrice éditée', () => {
  const data = createInitialData();
  const original = data.matrices.find(m => m.id === 'm2');
  const related = data.matrices.find(m => m.id === 'm4');
  original.descriptions = { fr: 'Préparer les étapes', en: 'Prepare the steps', ko: '단계 준비' };
  related.descriptions = { fr: 'Autre description', en: 'Other description', ko: '다른 설명' };
  const proposals = modelTranslationSuggestions(original, data);
  assert.deepEqual(proposals.labels, { en: 'Planning · 1 auditor', ko: '계획 · 심사원 1명' });
  assert.deepEqual(proposals.descriptions, { en: 'Prepare the steps', ko: '단계 준비' });
  const draft = { ...original, special: true, descriptions: { fr: 'Description modifiée', en: 'Changed description', ko: '수정된 설명' } };
  const result = propagateMatrix(data, original, draft, [original.id, related.id], false);
  assert.deepEqual(result.matrices.find(m => m.id === original.id).descriptions, draft.descriptions);
  assert.equal(result.matrices.find(m => m.id === original.id).special, true);
  assert.deepEqual(result.matrices.find(m => m.id === related.id), related);
  assert.deepEqual(result.audits, data.audits);
});

test('les propositions multilingues réutilisent les traductions locales et signalent les textes inconnus', () => {
  const data = createInitialData();
  const knownLabels = [
    ...data.tasks.map(task => task.labels),
    ...data.matrices.map(matrix => matrix.labels),
    ...data.documents.map(document => ({
      fr: document.versions.fr.label,
      en: document.versions.en.label,
      ko: document.versions.ko.label,
    })),
  ];
  assert.deepEqual(translationSuggestions('planifier l’audit', knownLabels), {
    en: 'Schedule the audit',
    ko: '심사 일정 수립',
  });
  assert.deepEqual(translationSuggestions("Lettre de confirmation d'audit", knownLabels), {
    en: 'Audit Confirmation Letter',
    ko: '감사 확인서',
  });
  assert.deepEqual(translationSuggestions('Texte inédit', knownLabels), {
    en: '[EN · à traduire] Texte inédit',
    ko: '[KO · 번역 필요] Texte inédit',
  });
});

test('remplacer un template ne modifie que sa version linguistique', () => {
  const document = createInitialData().documents[0];
  const updated = replaceDocumentVersion(document, 'en', 'Audit_Confirmation_EN_v3.docx', 3, true, '2026-11-19T10:00:00Z');
  assert.deepEqual(updated.versions.fr, document.versions.fr);
  assert.deepEqual(updated.versions.ko, document.versions.ko);
  assert.equal(updated.versions.en.fileName, 'Audit_Confirmation_EN_v3.docx');
  assert.equal(updated.versions.en.version, 3);
  assert.equal(updated.versions.en.templateLogicalName, 'audit-confirmation-en');
  assert.deepEqual(updated.versions.en.archives, ['Audit_Confirmation_EN.docx', 'Audit_Confirmation_EN_v2.docx']);
  assert.equal(updated.versions.en.sqlScriptStatus, 'À générer');
  assert.deepEqual(updated.versions.en.detectedTags, []);
  assert.equal(updated.versions.en.azureSyncStatus, 'Non synchronisé');
  assert.throws(() => replaceDocumentVersion(document, 'en', 'bad.docx', document.versions.en.version, false, '2026-11-19T10:00:00Z'), /invalides/);
});

test('les matrices fictives rattachent les douze tâches au processus à trois auditeurs', () => {
  const data = createInitialData();
  const matrices = data.matrices.filter(matrix => matrix.id.startsWith('demo-matrix-workbook-'));
  const target = matrices.find(matrix => matrix.id === 'demo-matrix-workbook-4');
  assert.equal(matrices.length, 7);
  assert.equal(target.kind, 'Audit Process');
  assert.match(target.name, /3 auditeurs/);
  assert.equal(target.standardType, 'SM');
  assert.equal(target.certificationType, 'Système de management');
  assert.equal(target.taskIds.length, 12);
  assert.ok(matrices.filter(matrix => matrix.id !== target.id).every(matrix => matrix.taskIds.length === 0));
  assert.equal(data.entities.find(entity => entity.id === target.auditTypeId).parentId, '');
  const tasks = target.taskIds.map(id => data.tasks.find(task => task.id === id));
  assert.ok(tasks.every(task => task && task.scope === 'Process'));
  assert.match(tasks[2].name, /mission 1/);
  assert.match(tasks[3].name, /mission 2/);
  assert.match(tasks[4].name, /mission 3/);
  assert.equal(tasks[0].offset, -30);
  assert.equal(tasks[0].reference, 'Début d’audit');
  assert.equal(tasks[9].offset, 1);
  assert.equal(tasks[9].reference, 'Fin d’audit');
  assert.match(tasks[0].descriptions.fr, /référence fictive/);
});

test('un document non généré ne requiert pas de script pour un remplacement Azure', () => {
  const original = createInitialData().documents[0];
  const document = { ...original, generationMode: 'none' };
  const current = document.versions.fr;
  assert.equal(documentScriptReadinessError(current, 'Nouveau.docx', 'none'), null);
  assert.match(documentScriptReadinessError(current, 'Nouveau.docx'), /Analysez/);
  assert.match(documentScriptReadinessError({ ...current, templateLogicalName: '' }, 'Nouveau.docx', 'none'), /nom logique/);
  assert.match(documentScriptReadinessError(current, '', 'none'), /fichier/);
  const result = simulateAzureReplacement(document, 'fr', 'Nouveau.docx', current.version + 1, '2026-11-19T10:00:00Z');
  assert.equal(result.versions.fr.fileName, 'Nouveau.docx');
  assert.equal(result.versions.fr.sqlScript, current.sqlScript);
  assert.equal(result.versions.fr.analyzedFileName, current.analyzedFileName);
  assert.match(documentScriptReadinessError(result.versions.fr, 'Nouveau.docx', 'before'), /Analysez/);
});

test('un document obligatoire ou de travail est toujours non généré, même dans les anciennes données', () => {
  const original = createInitialData().documents[0];
  for (const flags of [
    { mandatory: true, workDocument: false, generationMode: 'after' },
    { mandatory: false, workDocument: true, generationMode: 'before' },
    { mandatory: true, workDocument: true, generationMode: undefined },
  ]) {
    const document = { ...original, ...flags };
    assert.equal(documentGenerationMode(document), 'none');
    const next = simulateAzureReplacement(document, 'fr', 'Nouveau.docx', original.versions.fr.version + 1, '2026-11-19T10:00:00Z');
    assert.equal(next.versions.fr.sqlScript, original.versions.fr.sqlScript);
    assert.equal(next.versions.fr.analyzedFileName, original.versions.fr.analyzedFileName);
  }
  assert.equal(documentGenerationMode({ ...original, mandatory: false, workDocument: false, generationMode: undefined }), 'before');
  assert.equal(documentGenerationMode({ ...original, mandatory: false, workDocument: false, generationMode: 'after' }), 'after');
});

test('les balises et correspondances simulées sont indépendantes et signalent les problèmes', () => {
  const fr = analyzeDemoDocumentTags('fr', 'Planning_FR.docx');
  const en = analyzeDemoDocumentTags('en', 'Planning_EN.docx');
  const ko = analyzeDemoDocumentTags('ko', 'Planning_KO.docx');
  assert.equal(fr.detectedTags.length, fr.recognizedTags.length);
  assert.deepEqual(fr.unmappedTags, []);
  assert.deepEqual(fr.tagsWithoutSql, []);
  assert.deepEqual(en.unmappedTags, ['SUPERVISOR_EMAIL']);
  assert.deepEqual(ko.tagsWithoutSql, ['SITE_ADDRESS']);
  assert.deepEqual(ko.duplicateTags, ['AUDIT_REFERENCE']);
  const script = generateDemoSqlScript(fr.detectedTags, 'fr');
  assert.match(script, /SELECT/);
  assert.match(script, /aucun SQL réel/);
  assert.match(script, /\[Valeur simulée/);
  assert.doesNotMatch(script, /\bFROM\b|\bJOIN\b/i);
  const data = createInitialData();
  assert.equal(validateDocumentSqlScript(data.documents[0].versions.fr).valid, true);
  assert.match(validateDocumentSqlScript({ ...data.documents[0].versions.fr, sqlScript: 'SELECT 1;' }).message, /AUDIT_REFERENCE/);
  assert.match(documentScriptReadinessError(data.documents[0].versions.en, 'Planning_EN.docx'), /Analysez/);
  assert.match(validateDocumentSqlScript(data.documents[0].versions.en).message, /SUPERVISOR_EMAIL/);
  assert.match(validateDocumentSqlScript(data.documents[0].versions.ko).message, /SITE_ADDRESS/);
});

test('l’envoi Azure simulé réussi archive et remplace uniquement la langue ciblée', () => {
  const original = createInitialData().documents[0];
  const document = {
    ...original,
    versions: {
      ...original.versions,
      fr: { ...original.versions.fr, templateLogicalName: 'Audit_Confirmation_FR_v3.docx', analyzedFileName: 'Audit_Confirmation_FR_v3.docx' },
    },
  };
  const nextPath = azureBlobPathFor(document.versions.fr.templateLogicalName, 'fr', 'Audit_Confirmation_FR_v3.docx');
  const updated = simulateAzureReplacement(document, 'fr', 'Audit_Confirmation_FR_v3.docx', 3, '2026-11-19T10:00:00Z');
  assert.deepEqual(updated.versions.en, document.versions.en);
  assert.deepEqual(updated.versions.ko, document.versions.ko);
  assert.equal(updated.versions.fr.fileName, 'Audit_Confirmation_FR_v3.docx');
  assert.equal(updated.versions.fr.version, 3);
  assert.equal(updated.versions.fr.azureContainer, 'diams-templates-demo');
  assert.equal(updated.versions.fr.azureBlobPath, nextPath);
  assert.equal(updated.versions.fr.azureSyncStatus, 'Synchronisé');
  assert.deepEqual(updated.versions.fr.archives, ['Audit_Confirmation_FR.docx', 'Audit_Confirmation_FR_v2.docx']);
  assert.equal(updated.versions.fr.azureLastOperation.archivedPrevious, true);
});

test('un échec Azure simulé journalise la tentative sans perdre le template actif', () => {
  const original = createInitialData().documents[1];
  const document = {
    ...original,
    versions: {
      ...original.versions,
      fr: { ...original.versions.fr, templateLogicalName: 'Ordre_de_mission_FR_v2.docx', analyzedFileName: 'Ordre_de_mission_FR_v2.docx' },
    },
  };
  const current = document.versions.fr;
  const updated = simulateAzureReplacement(document, 'fr', 'Ordre_de_mission_FR_v2.docx', 2, '2026-11-19T10:00:00Z', 'failure');
  assert.deepEqual(updated.versions.en, document.versions.en);
  assert.deepEqual(updated.versions.ko, document.versions.ko);
  assert.equal(updated.versions.fr.fileName, current.fileName);
  assert.equal(updated.versions.fr.version, current.version);
  assert.deepEqual(updated.versions.fr.archives, current.archives);
  assert.equal(updated.versions.fr.azureBlobPath, current.azureBlobPath);
  assert.equal(updated.versions.fr.azureSyncStatus, 'Échec');
  assert.equal(updated.versions.fr.azureLastOperation.attemptedFileName, 'Ordre_de_mission_FR_v2.docx');
  assert.equal(updated.versions.fr.azureLastOperation.archivedPrevious, false);
  const invalidDocument = createInitialData().documents[0];
  const invalidEnglish = {
    ...invalidDocument,
    mandatory: false,
    versions: { ...invalidDocument.versions, en: { ...invalidDocument.versions.en, analyzedFileName: 'New_EN.docx', sqlScriptStatus: 'Valide' } },
  };
  assert.throws(() => simulateAzureReplacement(invalidEnglish, 'en', 'New_EN.docx', 3, '2026-11-19T10:00:00Z'), /SUPERVISOR_EMAIL/);
});

test('la cartographie relie seulement les types et matrices présents pour le type d’audit sélectionné', () => {
  const data = createInitialData();
  assert.deepEqual(matrixKindsForAudit(data.matrices, 'at3'), ['Audit Cycle', 'Audit Process']);
  assert.deepEqual(matrixKindsForAudit(data.matrices, 'at4'), ['Audit Process']);
  const recertificationProcesses = matricesForAuditKind(data.matrices, 'at3', 'Audit Process');
  assert.equal(recertificationProcesses.length, 5);
  assert.deepEqual(new Set(recertificationProcesses.map(matrix => matrix.id)), new Set(['m7', 'm8', 'm9', 'm13', 'm14']));
  assert.ok(recertificationProcesses.every(matrix => matrix.auditTypeId === 'at3' && matrix.kind === 'Audit Process'));
  assert.ok(recertificationProcesses.some(matrix => matrix.name === 'Processus de préparation de l’audit'));
  assert.ok(recertificationProcesses.some(matrix => matrix.name === 'Processus d’analyse et de décision'));
  assert.deepEqual(matricesForAuditKind(data.matrices, 'at4', 'Audit Cycle'), []);
  assert.equal(matrixStandardLabel('SM'), 'Système de management');
});

test('les références de dates détectent les boucles directes et indirectes', () => {
  const { tasks } = createInitialData();
  const first = { ...tasks[0], reference: 'Autre tâche', referenceTaskId: 't2' };
  const second = { ...tasks[1], reference: 'Autre tâche', referenceTaskId: 't1' };
  assert.match(taskReferenceError([first, second], first), /boucle/);
  assert.match(taskReferenceError(tasks, { ...first, referenceTaskId: 't1' }), /boucle/);
  assert.match(taskReferenceError(tasks, { ...first, referenceTaskId: '' }), /Choisissez/);
  assert.match(taskReferenceError(tasks, { ...first, referenceTaskId: 'missing' }), /introuvable/);
  assert.equal(taskReferenceError(tasks, first), null);
});

test('propagation locale et future : seule la matrice source change', () => {
  const data = createInitialData();
  const original = data.matrices[0];
  const draft = { ...original, taskIds: [...original.taskIds, 't8'] };
  const next = propagateMatrix(data, original, draft, ['m1'], false);
  assert.deepEqual(next.matrices[0].taskIds, draft.taskIds);
  assert.deepEqual(next.matrices[2], data.matrices[2]);
  assert.deepEqual(next.audits, data.audits);
  assert.equal(data.matrices[0].taskIds.includes('t8'), false);
  assert.deepEqual(matrixImpact(data, ['m1'], false), { matrices: 1, audits: 0, excluded: 1 });
});

test('propagation sélectionnée : delta sur les correspondantes, terminés strictement inchangés', () => {
  const data = createInitialData();
  const original = data.matrices[0];
  data.matrices[2].taskIds.push('t7', 't8');
  const draft = { ...original, name: 'Nom local', taskIds: [...original.taskIds.filter(id => id !== 't2'), 't8'] };
  const next = propagateMatrix(data, original, draft, ['m1', 'm3'], true);
  assert.equal(next.matrices[2].taskIds.includes('t2'), false);
  assert.equal(next.matrices[2].taskIds.includes('t7'), true);
  assert.equal(next.matrices[2].taskIds.filter(id => id === 't8').length, 1);
  assert.notEqual(next.matrices[2].name, draft.name);
  assert.deepEqual(next.matrices[4], data.matrices[4]);
  for (const audit of next.audits) {
    const before = data.audits.find(a => a.id === audit.id);
    if (['m1', 'm3'].includes(audit.matrixId) && audit.status !== 'Terminé') {
      assert.equal(audit.taskIds.includes('t8'), true);
      assert.equal(audit.taskIds.includes('t2'), false);
    } else assert.deepEqual(audit, before);
  }
  assert.deepEqual(matrixImpact(data, ['m1', 'm3'], true), { matrices: 2, audits: 4, excluded: 2 });
});

test('une matrice ne peut contenir de doublon ou propager hors de sa famille', () => {
  const data = createInitialData();
  const original = data.matrices[0];
  assert.throws(() => propagateMatrix(data, original, { ...original, taskIds: ['t1', 't1'] }, ['m1'], true), /deux fois/);
  assert.throws(() => propagateMatrix(data, original, { ...original, taskIds: ['missing'] }, ['m1'], true), /introuvable/);
  assert.throws(() => propagateMatrix(data, original, original, ['m1', 'm2'], true), /non correspondante/);
  assert.throws(() => propagateMatrix(data, original, original, ['m3'], true), /source/);
});

test('les trames spécifiques priment et le repli respecte langue, type et statut', () => {
  const { reports } = createInitialData();
  assert.equal(selectReport(reports, 'SM', 'ISO 9001', 'Initiale étape 2', 'Français')?.id, 'r2');
  assert.equal(selectReport(reports, 'SM', 'ISO 50001', 'Initiale étape 2', 'Français')?.id, 'r1');
  assert.equal(selectReport(reports, 'SM', 'ISO 50001', 'Initiale étape 2', 'Anglais'), undefined);
  assert.equal(selectReport(reports, 'Automobile', 'IATF 16949', 'Initiale étape 2', 'Français')?.id, 'demo-auto-iatf-initial');
  assert.equal(selectReport(reports.map(r => ({ ...r, active: r.id !== 'r2' })), 'SM', 'ISO 9001', 'Initiale étape 2', 'Français')?.id, 'r1');
});

test('une sélection de trame se développe par norme, type d’audit configuré et langue', () => {
  let nextId = 0;
  const expanded = expandReportRuleSelection({
    groupId: 'selection-1',
    standardType: 'SM',
    standards: ['ISO 9001', 'ISO 14001'],
    auditTypes: [allConfiguredAuditTypesOption],
    languages: ['Français', 'Anglais'],
    template: '  Rapport multi-normes.docx  ',
    active: true,
  }, ['Initiale étape 2', 'Surveillance'], () => `id-${++nextId}`);
  assert.equal(expanded.length, 8);
  assert.ok(expanded.every(rule => rule.groupId === 'selection-1' && rule.template === 'Rapport multi-normes.docx'));
  assert.deepEqual(new Set(expanded.map(rule => rule.standard)), new Set(['ISO 9001', 'ISO 14001']));
  assert.deepEqual(new Set(expanded.map(rule => rule.auditType)), new Set(['Initiale étape 2', 'Surveillance']));
  assert.deepEqual(new Set(expanded.map(rule => rule.language)), new Set(['Français', 'Anglais']));
  assert.throws(() => expandReportRuleSelection({
    standardType: 'SM', standards: ['Toutes les normes', 'ISO 9001'],
    auditTypes: ['Surveillance'], languages: ['Français'], template: 'Rapport.docx', active: true,
  }, ['Surveillance']), /ne peut pas être associé/);
  assert.throws(() => expandReportRuleSelection({
    standardType: 'SM', standards: ['ISO 9001'], auditTypes: [allConfiguredAuditTypesOption],
    languages: ['Français'], template: 'Rapport.docx', active: true,
  }, []), /Aucun type d’audit n’est configuré/);
});

test('les règles de même priorité sont bloquées, hors modification de soi et règles inactives', () => {
  const { reports } = createInitialData();
  assert.equal(reportConflict(reports, { ...reports[1], id: 'new' }), true);
  assert.equal(reportConflict(reports, reports[1]), false);
  assert.equal(reportConflict(reports, { ...reports[1], id: 'new', active: false }), false);
  assert.throws(() => selectReport([...reports, { ...reports[1], id: 'new' }], 'SM', 'ISO 9001', 'Initiale étape 2', 'Français'), /priorité/);
});

test('les quatre relations se réaffectent sans modifier les descendants ni les audits', () => {
  for (const [from, to, sources, destination] of [
    ['site', 'enterprise', ['s1', 's2'], 'e2'],
    ['enterprise', 'client', ['e1'], 'cl2'],
    ['auditType', 'certification', ['at1', 'at2'], 'c2'],
    ['certification', 'scheme', ['c1'], 'sc2'],
  ]) {
    const data = createInitialData();
    const next = reassign(data, from, to, sources, destination);
    for (const entity of next.entities) {
      const before = data.entities.find(e => e.id === entity.id);
      assert.deepEqual(entity, sources.includes(entity.id) ? { ...before, parentId: destination } : before);
    }
    assert.deepEqual(next.audits, data.audits);
    assert.deepEqual(next.matrices, data.matrices);
  }
});

test('réaffectations invalides, vides et destinations actuelles sont refusées', () => {
  const data = createInitialData();
  assert.throws(() => reassign(data, 'site', 'client', ['s1'], 'cl2'), /non autorisée/);
  assert.throws(() => reassign(data, 'site', 'enterprise', [], 'e2'), /sources valides/);
  assert.throws(() => reassign(data, 'site', 'enterprise', ['s1'], 'cl2'), /destination est invalide/);
  assert.throws(() => reassign(data, 'site', 'enterprise', ['s1'], 'e1'), /déjà rattachée/);
});

test('les réaffectations de certification restent dans une même entreprise renseignée', () => {
  const data = createInitialData();
  for (const [from, to, sources, destination] of [
    ['auditType', 'certification', ['at1'], 'c4'],
    ['auditType', 'certification', ['at1', 'at7'], 'c2'],
    ['certification', 'scheme', ['c1'], 'sc3'],
    ['certification', 'scheme', ['c1', 'c4'], 'sc2'],
  ]) assert.throws(() => reassign(data, from, to, sources, destination), /même entreprise/);
  const orphaned = { ...data, entities: data.entities.map(entity => entity.id === 'sc1' ? { ...entity, parentId: '' } : entity) };
  assert.throws(() => reassign(orphaned, 'auditType', 'certification', ['at1'], 'c2'), /même entreprise/);
  assert.throws(() => reassign(orphaned, 'certification', 'scheme', ['c2'], 'sc1'), /même entreprise/);
  assert.equal(reassign(data, 'auditType', 'certification', ['at1', 'at2'], 'c2').entities.find(entity => entity.id === 'at1').parentId, 'c2');
  assert.equal(reassign(data, 'certification', 'scheme', ['c1'], 'sc2').entities.find(entity => entity.id === 'c1').parentId, 'sc2');
});

test('contrôle des templates : extension, type, fichier vide et seuil exact de 10 Mo', () => {
  const file = { name: 'Modèle (révision 3).DOCX', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10 * 1024 * 1024 };
  assert.equal(templateError(file), null);
  assert.equal(templateError({ ...file, type: '' }), null);
  assert.match(templateError({ ...file, size: file.size + 1 }), /10 Mo/);
  assert.match(templateError({ ...file, name: 'test.pdf' }), /\.docx/);
  assert.match(templateError({ ...file, type: 'application/pdf' }), /type/);
  assert.match(templateError({ ...file, size: 0 }), /vide/);
});
