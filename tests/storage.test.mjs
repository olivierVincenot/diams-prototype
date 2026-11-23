import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, loadStore, persistStore, storageKey } from '../src/storage.ts';
import { deleteMatrix, expandMatrixAuditSelection, reassign } from '../src/domain.ts';
import { createCertificationStatusExamples } from '../src/certificationStatusExamples.ts';

function mockStorage(t) {
  const values = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  return values;
}

test('les exemples fictifs de statuts incluent des doublons et des valeurs manquantes', () => {
  const examples = createCertificationStatusExamples();
  const row = number => examples.find(item => item.id === `demo-certification-status-row-${number}`);
  assert.equal(examples.length, 83);
  assert.deepEqual(row(2).values, { decision: 'Favorable', originStatus: 'En attente', destinationStatus: 'Valide', auditType: 'Audit Démo A' });
  assert.deepEqual(row(2).values, row(8).values);
  assert.equal(row(5).values.destinationStatus, 'Suspendu');
  assert.equal(examples.filter(item => Object.values(item.values).some(value => !value)).length, 4);
  assert.deepEqual(row(82).values, { decision: '', originStatus: '', destinationStatus: '', auditType: 'Audit Démo D' });
  assert.ok(row(82).name.includes('Non renseigné'));
});

test('le stockage externe est isolé de la version précédente', t => {
  const values = mockStorage(t);
  const previousKey = 'diams-tools-prototype-v1';
  const previous = '{"donnees":"conservées"}';
  values.set(previousKey, previous);
  const loaded = loadStore();
  assert.equal(loaded.error, null);
  assert.equal(values.get(previousKey), previous);
  persistStore(loaded.store);
  assert.equal(values.get(previousKey), previous);
  assert.ok(values.has(storageKey));
  assert.notEqual(storageKey, previousKey);
});

test('les exemples de statuts migrent une fois sans écraser les fiches ou le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.certificationStatusWorkbookInitialized;
  legacy.data.specificSettings = legacy.data.specificSettings.filter(item => !item.id.startsWith('demo-certification-status-row-'));
  legacy.data.specificSettings.find(item => item.id === 'sp-cert-status-1').name = 'Fiche personnalisée';
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  legacy.undo.data.specificSettings.find(item => item.id === 'sp-cert-status-1').name = 'Ancienne fiche';
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.specificSettings.find(item => item.id === 'sp-cert-status-1').name, 'Fiche personnalisée');
  assert.equal(loaded.undo.data.specificSettings.find(item => item.id === 'sp-cert-status-1').name, 'Ancienne fiche');
  assert.equal(loaded.data.specificSettings.filter(item => item.id.startsWith('demo-certification-status-row-')).length, 83);
  assert.equal(loaded.undo.data.specificSettings.filter(item => item.id.startsWith('demo-certification-status-row-')).length, 83);
  loaded.data.specificSettings = loaded.data.specificSettings.filter(item => item.id !== 'demo-certification-status-row-2');
  persistStore(loaded);
  assert.equal(loadStore().store.data.specificSettings.some(item => item.id === 'demo-certification-status-row-2'), false);
});

test('une collision de statut refuse la migration sans modifier les données enregistrées', t => {
  const values = mockStorage(t);
  const legacy = createStore();
  delete legacy.certificationStatusWorkbookInitialized;
  legacy.data.specificSettings = legacy.data.specificSettings.filter(item => !item.id.startsWith('demo-certification-status-row-'));
  legacy.data.specificSettings.push({ ...legacy.data.specificSettings[0], id: 'demo-certification-status-row-2', name: 'Fiche à conserver' });
  const raw = JSON.stringify(legacy);
  values.set(storageKey, raw);
  assert.match(loadStore().error, /identifiant d’exemple/);
  assert.equal(values.get(storageKey), raw);
});

test('migration des types documentaires conserve les valeurs personnalisées et le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  legacy.data.documents[0].type = 'Type personnalisé';
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  legacy.undo.data.documents[0].type = 'Ancien type';
  delete legacy.data.documentTypes;
  delete legacy.undo.data.documentTypes;
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.ok(loaded.data.documentTypes.some(type => type.name === 'Type personnalisé'));
  assert.ok(loaded.undo.data.documentTypes.some(type => type.name === 'Ancien type'));
  assert.equal(loaded.data.documents[0].type, 'Type personnalisé');
  assert.equal(loaded.undo.data.documents[0].type, 'Ancien type');
  loaded.data.documentTypes = loaded.data.documentTypes.filter(type => type.name !== 'Certificat');
  persistStore(loaded);
  assert.equal(loadStore().store.data.documentTypes.some(type => type.name === 'Certificat'), false);
});

test('un type documentaire mal formé est refusé sans remplacer les données locales', t => {
  const values = mockStorage(t);
  const stored = createStore();
  stored.data.documentTypes[0].languageActive.ko = 'oui';
  const raw = JSON.stringify(stored);
  values.set(storageKey, raw);
  const loaded = loadStore();
  assert.equal(loaded.store, null);
  assert.match(loaded.error, /invalide ou incompatible/);
  assert.equal(values.get(storageKey), raw);
});

test('les exemples du classeur sont ajoutés une fois sans écraser les tâches ou le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.workbookTaskExamplesInitialized;
  legacy.data.tasks = legacy.data.tasks.filter(task => !task.id.startsWith('demo-workbook-task-'));
  legacy.data.tasks[0].name = 'Tâche personnalisée';
  legacy.data.tasks.push({ ...legacy.data.tasks[0], id: 'demo-workbook-task-1', name: 'Collision conservée' });
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.tasks[0].name, 'Tâche personnalisée');
  assert.equal(loaded.data.tasks.find(task => task.id === 'demo-workbook-task-1').name, 'Collision conservée');
  assert.ok(loaded.data.tasks.some(task => task.id === 'demo-workbook-task-7'));
  assert.ok(loaded.undo.data.tasks.some(task => task.id === 'demo-workbook-task-7'));
  loaded.data.tasks = loaded.data.tasks.filter(task => task.id !== 'demo-workbook-task-7');
  persistStore(loaded);
  assert.equal(loadStore().store.data.tasks.some(task => task.id === 'demo-workbook-task-7'), false);
});

test('les matrices des classeurs sont initialisées une fois sans modifier les données ni le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.workbookMatrixExamplesInitialized;
  const withoutExamples = data => ({
    ...data,
    tasks: data.tasks.filter(task => !task.id.startsWith('demo-matrix-workbook-task-')),
    matrices: data.matrices.filter(matrix => !matrix.id.startsWith('demo-matrix-workbook-')),
    entities: data.entities.filter(entity => entity.id !== 'demo-workbook-iso-recertification'),
  });
  legacy.data = withoutExamples(legacy.data);
  legacy.data.tasks[0].name = 'Personnalisé';
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.tasks[0].name, 'Personnalisé');
  assert.equal(loaded.data.matrices.find(matrix => matrix.id === 'demo-matrix-workbook-4').taskIds.length, 12);
  assert.equal(loaded.undo.data.matrices.find(matrix => matrix.id === 'demo-matrix-workbook-4').taskIds.length, 12);
  loaded.data.matrices = loaded.data.matrices.filter(matrix => matrix.id !== 'demo-matrix-workbook-4');
  persistStore(loaded);
  assert.equal(loadStore().store.data.matrices.some(matrix => matrix.id === 'demo-matrix-workbook-4'), false);
  legacy.data.tasks.push({ ...legacy.data.tasks[0], id: 'demo-matrix-workbook-task-2' });
  persistStore(legacy);
  assert.match(loadStore().error, /identifiant d’exemple/);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(storageKey)).data.tasks.at(-1).id, 'demo-matrix-workbook-task-2');
});

test('le client organisation fictive est corrigé sans modifier les noms personnalisés et le retour arrière reste cohérent', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.demoClientNameCorrected;
  legacy.data.entities.find(entity => entity.id === 'demo-organization-client').name = 'Ancien client Démo';
  legacy.data.entities.push({ id: 'autre-client', kind: 'client', name: 'Ancien client Démo', parentId: '' });
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.entities.find(entity => entity.id === 'demo-organization-client').name, 'Groupe Démo');
  assert.equal(loaded.undo.data.entities.find(entity => entity.id === 'demo-organization-client').name, 'Groupe Démo');
  assert.equal(loaded.data.entities.find(entity => entity.id === 'autre-client').name, 'Ancien client Démo');
  legacy.data.entities.find(entity => entity.id === 'demo-organization-client').name = 'Nom personnalisé';
  persistStore(legacy);
  assert.equal(loadStore().store.data.entities.find(entity => entity.id === 'demo-organization-client').name, 'Nom personnalisé');
  loaded.data.entities.find(entity => entity.id === 'demo-organization-client').name = 'Nom personnalisé';
  persistStore(loaded);
  assert.equal(loadStore().store.data.entities.find(entity => entity.id === 'demo-organization-client').name, 'Nom personnalisé');
});

test('l’exemple organisation fictive est ajouté une fois sans modifier les données ni le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.demoOrganizationInitialized;
  legacy.data.entities = legacy.data.entities.filter(entity => !entity.id.startsWith('demo-organization-'));
  legacy.data.entities.find(entity => entity.id === 'e1').name = 'Entreprise personnalisée';
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.entities.find(entity => entity.id === 'e1').name, 'Entreprise personnalisée');
  assert.deepEqual(loaded.data.entities.find(entity => entity.id === 'demo-organization-audit-a').details,
    loaded.undo.data.entities.find(entity => entity.id === 'demo-organization-audit-a').details);
  loaded.data.entities.find(entity => entity.id === 'demo-organization-enterprise').name = 'Entreprise modifiée';
  loaded.data.entities = loaded.data.entities.filter(entity => entity.id !== 'demo-organization-audit-c');
  persistStore(loaded);
  const reloaded = loadStore().store;
  assert.equal(reloaded.data.entities.find(entity => entity.id === 'demo-organization-enterprise').name, 'Entreprise modifiée');
  assert.equal(reloaded.data.entities.some(entity => entity.id === 'demo-organization-audit-c'), false);
});

test('une collision d’identifiant ou des détails d’entité invalides ne sont pas écrasés', t => {
  const values = mockStorage(t);
  const legacy = createStore();
  delete legacy.demoOrganizationInitialized;
  values.set(storageKey, JSON.stringify(legacy));
  assert.match(loadStore().error, /identifiant d’exemple.*existe déjà/);
  const invalid = createStore();
  invalid.data.entities[0].details = [{ label: 'Norme', value: 123 }];
  values.set(storageKey, JSON.stringify(invalid));
  assert.match(loadStore().error, /format des données locales est invalide/);
});

test('les exemples de certification sont initialisés une seule fois sans écraser les liens personnalisés ni le retour arrière', t => {
  mockStorage(t);
  const legacy = createStore();
  delete legacy.organizationCertificationExamplesInitialized;
  legacy.data.entities = legacy.data.entities.filter(entity => !['sc3', 'c4', 'at7'].includes(entity.id));
  legacy.data.entities.find(entity => entity.id === 'sc1').parentId = '';
  legacy.data.entities.find(entity => entity.id === 'sc2').parentId = 'e3';
  legacy.undo = { data: structuredClone(legacy.data), logId: 'previous' };
  persistStore(legacy);
  const loaded = loadStore().store;
  assert.equal(loaded.data.entities.find(entity => entity.id === 'sc1').parentId, 'e1');
  assert.equal(loaded.data.entities.find(entity => entity.id === 'sc2').parentId, 'e3');
  assert.equal(loaded.undo.data.entities.find(entity => entity.id === 'sc1').parentId, 'e1');
  assert.equal(loaded.data.entities.find(entity => entity.id === 'c4').parentId, 'sc3');
  loaded.data.entities.find(entity => entity.id === 'sc1').parentId = '';
  loaded.data.entities = loaded.data.entities.filter(entity => entity.id !== 'at7');
  persistStore(loaded);
  const reloaded = loadStore().store;
  assert.equal(reloaded.data.entities.find(entity => entity.id === 'sc1').parentId, '');
  assert.equal(reloaded.data.entities.some(entity => entity.id === 'at7'), false);
});

test('une réaffectation de type d’audit autorisée persiste avec ses objets liés et son retour arrière', t => {
  mockStorage(t);
  const store = createStore();
  const previous = structuredClone(store.data);
  store.data = reassign(store.data, 'auditType', 'certification', ['at1'], 'c2');
  store.undo = { data: previous, logId: 'transfer' };
  persistStore(store);
  const loaded = loadStore().store;
  assert.equal(loaded.data.entities.find(entity => entity.id === 'at1').parentId, 'c2');
  assert.deepEqual(loaded.data.matrices, previous.matrices);
  assert.deepEqual(loaded.data.audits, previous.audits);
  assert.equal(loaded.undo.data.entities.find(entity => entity.id === 'at1').parentId, 'c1');
});

test('les visibilités des boîtes à outils persistent sans modifier les anciennes valeurs', t => {
  mockStorage(t);
  const store = createStore();
  const toolBox = store.data.specificSettings.find(item => item.kind === 'toolBox');
  const originalValues = { ...toolBox.values };
  Object.assign(toolBox.values, {
    visibleToCorrespondents: 'true',
    visibleToExternalAuditors: 'false',
    visibleToUtacMembers: 'true',
  });
  persistStore(store);
  const loaded = loadStore();
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.store.data.specificSettings.find(item => item.id === toolBox.id).values, {
    ...originalValues,
    visibleToCorrespondents: 'true',
    visibleToExternalAuditors: 'false',
    visibleToUtacMembers: 'true',
  });
});

test('les versions linguistiques, autorisations et sections structurées persistent avec les anciennes données', t => {
  mockStorage(t);
  const store = createStore();
  const translation = (title, active = true) => ({ title, active, description: '', fileName: '' });
  const translations = { fr: translation('Chapitre'), en: translation('Chapter', false), ko: translation('', false) };
  const checklist = store.data.specificSettings.find(item => item.kind === 'checklist');
  const skill = store.data.specificSettings.find(item => item.kind === 'skillProfile');
  const notice = store.data.specificSettings.find(item => item.kind === 'notice');
  checklist.translations = translations;
  checklist.checklistSections = [
    { id: 'section-1', translations: { ...translations, fr: translation('Section A') } },
    { id: 'section-2', translations: { ...translations, fr: translation('Section B') } },
  ];
  checklist.values.auditTypeId = store.data.entities.find(item => item.kind === 'auditType').id;
  skill.translations = translations;
  skill.permissions = [{ id: 'permission-1', userType: 'Admin', active: true, download: false }];
  notice.translations = { ...translations, fr: { ...translations.fr, fileName: 'notice.pdf', description: 'Description' } };
  notice.values.toolBoxId = store.data.specificSettings.find(item => item.kind === 'toolBox').id;
  notice.textTranslations = { content: { en: 'Notice', ko: '안내' } };
  persistStore(store);
  assert.deepEqual(loadStore(), { store, error: null });
});

test('les versions linguistiques et sections mal formées sont refusées au chargement', t => {
  const values = mockStorage(t);
  for (const change of [
    { translations: { fr: { title: 'Titre', active: true } } },
    { permissions: [{ id: 'p', userType: 'Admin', active: true, download: 'oui' }] },
    { checklistSections: [{ id: 's', translations: {} }] },
    { checklistSections: [{ id: 's', translations: {} }, { id: 's', translations: {} }] },
    { textTranslations: { content: { en: 'Notice', ko: false } } },
  ]) {
    const store = createStore();
    Object.assign(store.data.specificSettings[0], change);
    values.set(storageKey, JSON.stringify(store));
    const loaded = loadStore();
    assert.equal(loaded.store, null);
    assert.ok(loaded.error);
  }
});

test('la suppression logique d’une matrice utilisée persiste avec ses audits et son retour arrière', t => {
  mockStorage(t);
  const store = createStore();
  const original = structuredClone(store.data);
  const matrixId = store.data.matrices[0].id;
  store.data = deleteMatrix(store.data, matrixId);
  store.history = [{ id: 'delete-matrix', at: new Date().toISOString(), author: 'Démo', title: 'Suppression matrice', scope: 'Local' }];
  store.undo = { data: original, logId: 'delete-matrix' };
  persistStore(store);
  const loaded = loadStore();
  assert.equal(loaded.error, null);
  assert.equal(loaded.store.data.matrices.find(matrix => matrix.id === matrixId).deleted, true);
  assert.deepEqual(loaded.store.data.audits, original.audits);
  assert.deepEqual(loaded.store.undo.data, original);
  loaded.store.data = loaded.store.undo.data;
  loaded.store.undo = null;
  persistStore(loaded.store);
  assert.deepEqual(loadStore().store.data, original);
});

test('les matrices créées pour plusieurs audits persistent ensemble avec leurs tâches et leur retour arrière', t => {
  mockStorage(t);
  const store = createStore();
  const original = structuredClone(store.data);
  const matrix = { ...store.data.matrices[0], id: 'batch-primary', family: 'batch-family', name: 'Matrice multi-audits' };
  let index = 0;
  const selection = expandMatrixAuditSelection(matrix, ['at1', 'at2', 'at3'], store.data, () => `batch-${++index}`);
  store.data.matrices.push(selection.draft, ...selection.additions);
  store.history = [{ id: 'batch-log', at: new Date().toISOString(), author: 'Démo', title: 'Création multi-audits', scope: 'Local' }];
  store.undo = { data: original, logId: 'batch-log' };
  persistStore(store);
  assert.deepEqual(loadStore(), { store, error: null });
  assert.equal(loadStore().store.data.matrices.filter(m => m.family === matrix.family).length, 3);
});

test('les descriptions de matrices et le Process spécial persistent sans modifier les anciennes matrices', t => {
  mockStorage(t);
  const store = createStore();
  const original = structuredClone(store.data);
  const matrix = store.data.matrices.find(m => m.kind === 'Audit Process');
  matrix.special = true;
  matrix.descriptions = { fr: 'Description française', en: 'English description', ko: '한국어 설명' };
  store.history = [{ id: 'matrix-description', at: new Date().toISOString(), author: 'Démo', title: 'Description matrice', scope: 'Local' }];
  store.undo = { data: original, logId: 'matrix-description' };
  persistStore(store);
  assert.deepEqual(loadStore(), { store, error: null });
  assert.equal(loadStore().store.undo.data.matrices.find(m => m.id === matrix.id).descriptions, undefined);
});

test('une description de matrice mal formée est refusée explicitement', t => {
  const values = mockStorage(t);
  for (const descriptions of [null, { fr: 'Texte' }, { fr: 'Texte', en: 42, ko: '' }]) {
    const store = createStore();
    store.data.matrices[0].descriptions = descriptions;
    values.set(storageKey, JSON.stringify(store));
    assert.equal(loadStore().store, null);
    assert.ok(loadStore().error);
  }
});

test('les nouveaux paramètres de tâche et versions linguistiques persistent avec le retour arrière', t => {
  mockStorage(t);
  const store = createStore();
  const original = structuredClone(store.data);
  const task = store.data.tasks[0];
  Object.assign(task, {
    type: 'Contrat', role: 'Signataire du contrat',
    canCompleteBeforeContractValidation: true, mustCompleteBeforeNextTask: true,
    canCompleteBeforeAuditDateConfirmation: true, isReferenceTask: true,
    descriptions: { fr: 'Description française', en: 'English description', ko: '' },
    languageActive: { fr: true, en: false, ko: false },
  });
  store.history = [{ id: 'task-options', at: new Date().toISOString(), author: 'Démo', title: 'Options tâche', scope: 'Local' }];
  store.undo = { data: original, logId: 'task-options' };
  persistStore(store);
  assert.deepEqual(loadStore(), { store, error: null });
});

test('les anciennes tâches reçoivent les options neutres sans écraser leurs paramètres ou leur retour arrière', t => {
  const values = mockStorage(t);
  const store = createStore();
  const keys = ['descriptions', 'languageActive', 'canCompleteBeforeContractValidation', 'mustCompleteBeforeNextTask', 'canCompleteBeforeAuditDateConfirmation', 'isReferenceTask'];
  for (const task of store.data.tasks) for (const key of keys) delete task[key];
  store.data.tasks[0].reference = 'Fin d’audit';
  store.data.tasks[0].offset = -12;
  store.data.tasks[0].role = 'Rôle personnalisé';
  const original = structuredClone(store.data.tasks);
  store.history = [{ id: 'legacy-task', at: new Date().toISOString(), author: 'Démo', title: 'Ancienne tâche', scope: 'Local' }];
  store.undo = { data: structuredClone(store.data), logId: 'legacy-task' };
  values.set(storageKey, JSON.stringify(store));
  const loaded = loadStore();
  assert.equal(loaded.error, null);
  for (const data of [loaded.store.data, loaded.store.undo.data]) {
    assert.deepEqual(data.tasks.map(task => Object.fromEntries(Object.entries(task).filter(([key]) => !keys.includes(key)))), original);
    assert.ok(data.tasks.every(task => keys.slice(2).every(key => task[key] === false)));
    assert.deepEqual(data.tasks[0].descriptions, { fr: '', en: '', ko: '' });
    assert.deepEqual(data.tasks[0].languageActive, { fr: true, en: true, ko: true });
  }
  persistStore(loaded.store);
  assert.deepEqual(loadStore(), loaded);
});

test('les paramètres de tâche mal formés sont refusés explicitement', t => {
  const values = mockStorage(t);
  for (const change of [
    { canCompleteBeforeContractValidation: 'oui' },
    { mustCompleteBeforeNextTask: 1 },
    { canCompleteBeforeAuditDateConfirmation: null },
    { isReferenceTask: [] },
    { descriptions: { fr: 'Texte' } },
    { languageActive: { fr: true, en: 'oui', ko: false } },
  ]) {
    const store = createStore();
    Object.assign(store.data.tasks[0], change);
    values.set(storageKey, JSON.stringify(store));
    const loaded = loadStore();
    assert.equal(loaded.store, null);
    assert.ok(loaded.error);
  }
});

test('les rattachements multiples des trames persistent sans attribuer de valeurs aux anciennes fiches', t => {
  mockStorage(t);
  const store = createStore();
  const unassignedIds = store.data.specificSettings.filter(setting => setting.reportScope === undefined).map(setting => setting.id);
  const item = store.data.specificSettings.find(setting => setting.kind === 'auditPlanningWeft');
  assert.ok(item);
  item.reportScope = {
    standardType: 'SM',
    standards: ['ISO 9001', 'ISO 14001'],
    auditTypes: ['Surveillance', 'Recertification'],
  };
  persistStore(store);
  const loaded = loadStore();
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.store.data.specificSettings, store.data.specificSettings);
  assert.ok(loaded.store.data.specificSettings.filter(setting => unassignedIds.includes(setting.id) && setting.id !== item.id)
    .every(setting => setting.reportScope === undefined));
});

test('les anciens stockages reçoivent les certificats une seule fois sans écraser les fiches, l’historique ou le retour arrière', t => {
  const values = mockStorage(t);
  const store = createStore();
  delete store.certificateExamplesInitialized;
  store.data.specificSettings = store.data.specificSettings.filter(item => !item.id.startsWith('demo-certificate-') || item.id === 'demo-certificate-iatf-2016-fr');
  const customized = store.data.specificSettings.find(item => item.id === 'demo-certificate-iatf-2016-fr');
  customized.values.templateName = 'Certificat personnalisé.docx';
  store.history = [{ id: 'old-log', at: new Date().toISOString(), author: 'Démo', title: 'Modification existante', scope: 'Local' }];
  store.undo = { data: JSON.parse(JSON.stringify(store.data)), logId: 'old-log' };
  const raw = JSON.stringify(store);
  values.set(storageKey, raw);
  const loaded = loadStore().store;
  assert.ok(loaded);
  assert.equal(loaded.data.specificSettings.filter(item => item.id.startsWith('demo-certificate-')).length, 19);
  assert.equal(loaded.data.specificSettings.find(item => item.id === customized.id).values.templateName, 'Certificat personnalisé.docx');
  assert.equal(loaded.undo.data.specificSettings.filter(item => item.id.startsWith('demo-certificate-')).length, 19);
  assert.deepEqual(loaded.history, store.history);
  assert.equal(values.get(storageKey), raw);
  assert.equal(loaded.certificateExamplesInitialized, true);
  persistStore(loaded);
  assert.deepEqual(loadStore().store, loaded);
  loaded.data.specificSettings = loaded.data.specificSettings.filter(item => !item.id.startsWith('demo-certificate-'));
  persistStore(loaded);
  assert.equal(loadStore().store.data.specificSettings.filter(item => item.id.startsWith('demo-certificate-')).length, 0);
  assert.ok(loadStore().store.data.specificSettings.some(item => item.id === 'sp-certificate-1'));
});

test('les types d’audit fournis complètent seulement les exemples non personnalisés et ne sont pas réimposés après suppression', t => {
  mockStorage(t);
  const store = createStore();
  delete store.certificateAuditTypesInitialized;
  for (const item of store.data.specificSettings.filter(item => item.id.startsWith('demo-certificate-'))) item.reportScope.auditTypes = [];
  const custom = store.data.specificSettings.find(item => item.id === 'demo-certificate-iatf-2016-fr');
  custom.reportScope.auditTypes = ['Audit personnalisé'];
  const moved = store.data.specificSettings.find(item => item.id === 'demo-certificate-iso50001-2018-fr');
  moved.reportScope.standards = ['ISO 45001:2018'];
  const iso = store.data.specificSettings.find(item => item.id === 'demo-certificate-iso9001-2015-fr');
  iso.values.templateName = 'Template personnalisé.docx';
  iso.active = false;
  store.data.specificSettings = store.data.specificSettings.filter(item => item.id !== 'demo-certificate-iso9001-2015-en');
  store.history = [{ id: 'audit-log', at: new Date().toISOString(), author: 'Démo', title: 'Personnalisation', scope: 'Local' }];
  store.undo = { data: structuredClone(store.data), logId: 'audit-log' };
  persistStore(store);
  const loaded = loadStore().store;
  assert.ok(loaded);
  const find = id => loaded.data.specificSettings.find(item => item.id === id);
  assert.deepEqual(find(custom.id).reportScope.auditTypes, ['Audit personnalisé']);
  assert.deepEqual(find(moved.id).reportScope, moved.reportScope);
  assert.equal(find(iso.id).reportScope.auditTypes.length, 6);
  assert.equal(find('demo-certificate-iatf-2016-en').reportScope.auditTypes.length, 10);
  assert.deepEqual(find('demo-certificate-iso45001-2018-fr').reportScope.auditTypes, []);
  assert.equal(find(iso.id).values.templateName, 'Template personnalisé.docx');
  assert.equal(find(iso.id).active, false);
  assert.equal(find('demo-certificate-iso9001-2015-en'), undefined);
  assert.equal(find('sp-certificate-1').reportScope, undefined);
  assert.deepEqual(loaded.history, store.history);
  assert.equal(loaded.undo.data.specificSettings.find(item => item.id === iso.id).reportScope.auditTypes.length, 6);
  assert.equal(loaded.certificateAuditTypesInitialized, true);
  persistStore(loaded);
  assert.deepEqual(loadStore().store, loaded);
  find(iso.id).reportScope.auditTypes = [];
  persistStore(loaded);
  assert.deepEqual(loadStore().store.data.specificSettings.find(item => item.id === iso.id).reportScope.auditTypes, []);
});

test('les rattachements mal formés sont refusés explicitement au chargement', t => {
  const values = mockStorage(t);
  for (const scope of [
    null,
    { standardType: 'SM', standards: 'ISO 9001', auditTypes: [] },
    { standardType: 'SM', standards: ['ISO 9001'], auditTypes: [42] },
    { standardType: 42, standards: [], auditTypes: [] },
  ]) {
    const store = createStore();
    store.data.specificSettings[0].reportScope = scope;
    values.set(storageKey, JSON.stringify(store));
    const loaded = loadStore();
    assert.equal(loaded.store, null);
    assert.ok(loaded.error);
  }
});

test('les donnees et le retour arriere persistent apres rechargement', t => {
  mockStorage(t);
  const initial = createStore();
  const log = { id: 'log1', at: new Date().toISOString(), author: 'Démo', title: 'Modification', scope: 'Local' };
  const changed = {
    ...initial,
    data: { ...initial.data, tasks: initial.data.tasks.map(task => ({ ...task, offset: 45 })) },
    history: [log],
    undo: { data: initial.data, logId: log.id },
  };
  persistStore(changed);
  assert.deepEqual(loadStore(), { store: changed, error: null });
});

test('ajoute les exemples de processus et de trames manquants sans remplacer les donnees locales', t => {
  const values = mockStorage(t);
  const oldStore = createStore();
  const exampleIds = new Set(['m13', 'm14']);
  oldStore.data.matrices = oldStore.data.matrices.filter(matrix => !exampleIds.has(matrix.id));
  oldStore.data.audits = oldStore.data.audits.filter(audit => !exampleIds.has(audit.matrixId));
  const demoReportIds = ['demo-sm-surveillance-1', 'demo-sm-surveillance-2', 'demo-sm-surveillance-3', 'demo-auto-iatf-initial'];
  oldStore.data.reports = oldStore.data.reports.filter(report => !demoReportIds.includes(report.id));
  oldStore.data.tasks[0].offset = 17;
  oldStore.history = [{ id: 'legacy', at: new Date().toISOString(), author: 'Démo', title: 'Historique conservé', scope: 'Local' }];
  oldStore.undo = { data: JSON.parse(JSON.stringify(oldStore.data)), logId: 'legacy' };
  const raw = JSON.stringify(oldStore);
  values.set(storageKey, raw);

  const loaded = loadStore().store;
  assert.ok(loaded);
  assert.deepEqual(new Set(loaded.data.matrices.filter(matrix => matrix.auditTypeId === 'at3' && matrix.kind === 'Audit Process').map(matrix => matrix.id)),
    new Set(['m7', 'm8', 'm9', 'm13', 'm14']));
  assert.equal(loaded.data.tasks[0].offset, 17);
  assert.equal(loaded.history[0].title, 'Historique conservé');
  assert.ok([...exampleIds].every(id => loaded.undo.data.matrices.some(matrix => matrix.id === id)));
  assert.ok(demoReportIds.every(id => loaded.data.reports.some(report => report.id === id)));
  assert.ok(demoReportIds.every(id => loaded.undo.data.reports.some(report => report.id === id)));
  assert.equal(values.get(storageKey), raw);
});

test('migre les données locales antérieures en initialisant uniquement les paramétrages spécifiques manquants', t => {
  const values = mockStorage(t);
  const store = createStore();
  delete store.data.specificSettings;
  store.data.tasks[0].offset = 23;
  values.set(storageKey, JSON.stringify(store));

  const migrated = loadStore().store;
  assert.ok(migrated);
  assert.equal(migrated.data.tasks[0].offset, 23);
  assert.ok(migrated.data.specificSettings.length > 0);

  migrated.data.specificSettings[0].name = 'Préférence locale conservée';
  values.set(storageKey, JSON.stringify(migrated));
  assert.equal(loadStore().store.data.specificSettings[0].name, 'Préférence locale conservée');
});

test('normalise les anciens périmètres Audit et Processus sans perdre les autres données', t => {
  const values = mockStorage(t);
  const store = createStore();
  store.data.tasks[0].scope = 'Audit';
  store.data.tasks[1].scope = 'Processus';
  store.data.tasks[2].scope = 'Contrat';
  store.undo = { data: JSON.parse(JSON.stringify(store.data)), logId: 'legacy-scope' };
  values.set(storageKey, JSON.stringify(store));

  const migrated = loadStore().store;
  assert.ok(migrated);
  assert.equal(migrated.data.tasks[0].scope, 'Type d’audit');
  assert.equal(migrated.data.tasks[1].scope, 'Process');
  assert.equal(migrated.data.tasks[2].scope, 'Contrat');
  assert.equal(migrated.undo.data.tasks[0].scope, 'Type d’audit');
  assert.equal(migrated.undo.data.tasks[1].scope, 'Process');
});

test('les paramètres et descriptions documentaires persistent sans modifier les anciens documents', t => {
  const values = mockStorage(t);
  const store = createStore();
  const original = structuredClone(store.data.documents[0]);
  const document = store.data.documents[1];
  Object.assign(document, { workDocument: true, originDocumentId: original.id, generationMode: 'after',
    visibleInExpertiseAndVeto: true, implementationEvidence: true, implementationVerification: false });
  document.versions.fr.description = 'Description';
  document.versions.en.description = 'English description';
  document.versions.ko.description = '';
  document.versions.en.active = false;
  values.set(storageKey, JSON.stringify(store));
  const loaded = loadStore().store;
  assert.deepEqual(loaded.data.documents[0], original);
  assert.deepEqual(loaded.data.documents[1], document);
  for (const [field, invalid] of [['generationMode', 'other'], ['workDocument', 'yes'], ['originDocumentId', 5]]) {
    const invalidStore = structuredClone(store);
    invalidStore.data.documents[1][field] = invalid;
    values.set(storageKey, JSON.stringify(invalidStore));
    assert.equal(loadStore().store, null);
  }
  const invalidStore = structuredClone(store);
  invalidStore.data.documents[1].versions.en.description = 42;
  values.set(storageKey, JSON.stringify(invalidStore));
  assert.equal(loadStore().store, null);
});

test('convertit les anciens documents mono-langue en versions independantes', t => {
  const values = mockStorage(t);
  const store = createStore();
  const original = store.data.documents[0];
  const english = original.versions.en;
  store.data.documents[0] = {
    id: original.id,
    title: english.label,
    type: original.type,
    language: 'Anglais',
    active: original.active,
    mandatory: original.mandatory,
    logicalName: 'audit-confirmation',
    fileName: english.fileName,
    version: english.version,
    updatedAt: english.lastUpdatedAt,
    archives: [...english.archives],
    taskIds: [...original.taskIds],
    query: 'Informations client et audit',
  };
  values.set(storageKey, JSON.stringify(store));

  const migrated = loadStore().store.data.documents[0];
  assert.equal(migrated.versions.en.label, 'Audit Confirmation Letter');
  assert.equal(migrated.versions.en.fileName, 'Audit_Confirmation_EN_v2.docx');
  assert.equal(migrated.versions.en.templateLogicalName, 'audit-confirmation-en');
  assert.equal(migrated.versions.fr.label, '');
  assert.equal(migrated.versions.fr.templateLogicalName, 'audit-confirmation-fr');
  assert.equal(migrated.versions.ko.templateLogicalName, 'audit-confirmation-ko');
  assert.equal(migrated.versions.en.language, 'en');
  assert.equal(migrated.versions.en.sqlScriptStatus, 'À générer');
  assert.match(migrated.versions.en.sqlScript, /Informations client et audit/);
  assert.deepEqual(migrated.taskIds, original.taskIds);
  assert.equal('query' in migrated, false);
});

test('migre le document trilingue precedent sans conserver la requete commune', t => {
  mockStorage(t);
  const store = createStore();
  const original = store.data.documents[0];
  const oldVersion = locale => {
    const version = original.versions[locale];
    return {
      label: version.label,
      templateName: version.templateLogicalName,
      fileName: version.fileName,
      version: version.version,
      updatedAt: version.lastUpdatedAt,
      archives: [...version.archives],
    };
  };
  store.data.documents[0] = {
    id: original.id,
    type: original.type,
    active: original.active,
    mandatory: original.mandatory,
    taskIds: [...original.taskIds],
    query: 'Informations client et audit',
    versions: { fr: oldVersion('fr'), en: oldVersion('en'), ko: oldVersion('ko') },
  };
  globalThis.localStorage.setItem(storageKey, JSON.stringify(store));

  const migrated = loadStore().store.data.documents[0];
  assert.equal('query' in migrated, false);
  assert.equal(migrated.versions.fr.fileName, original.versions.fr.fileName);
  assert.equal(migrated.versions.en.fileName, original.versions.en.fileName);
  assert.equal(migrated.versions.ko.fileName, original.versions.ko.fileName);
  assert.equal(migrated.versions.fr.templateLogicalName, original.versions.fr.templateLogicalName);
  assert.equal(migrated.versions.en.templateLogicalName, original.versions.en.templateLogicalName);
  assert.equal(migrated.versions.ko.templateLogicalName, original.versions.ko.templateLogicalName);
  assert.ok(['fr', 'en', 'ko'].every(locale => migrated.versions[locale].sqlScriptStatus === 'À générer'));
  assert.ok(['fr', 'en', 'ko'].every(locale => migrated.versions[locale].sqlScript.includes('Informations client et audit')));
});

test('un stockage corrompu est signale sans ecraser les donnees', t => {
  const values = mockStorage(t);
  for (const raw of ['{broken', '{"version":99}', JSON.stringify({ ...createStore(), data: { tasks: [] } })]) {
    values.set(storageKey, raw);
    const loaded = loadStore();
    assert.equal(loaded.store, null);
    assert.match(loaded.error, /Impossible de charger/);
    assert.equal(values.get(storageKey), raw);
  }
});

test('les dates et les objets invalides des donnees persistantes sont refuses', t => {
  const values = mockStorage(t);
  const store = createStore();
  store.data.documents[0].versions.fr.lastUpdatedAt = 'invalid-date';
  values.set(storageKey, JSON.stringify(store));
  assert.equal(loadStore().store, null);
  store.data.documents[0].versions.fr.lastUpdatedAt = new Date().toISOString();
  store.data.tasks[0].labels = null;
  values.set(storageKey, JSON.stringify(store));
  assert.equal(loadStore().store, null);
});

test('une erreur de stockage est explicite et ne devient pas un succes fictif', t => {
  mockStorage(t);
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => persistStore(createStore()), /QuotaExceeded/);
  globalThis.localStorage.getItem = () => { throw new Error('SecurityError'); };
  assert.match(loadStore().error, /SecurityError/);
});
