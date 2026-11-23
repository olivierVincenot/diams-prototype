import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentTemplateDescriptionTechnicalId, documentTemplateTechnicalId, entityTechnicalId, fakeTechnicalId, technicalMappings } from '../src/supportConfig.ts';
import { certificateAuditTypesFor, createCertificateExamples, createInitialSpecificSettings, reportSpecificKinds, settingDefinitions } from '../src/specificSettingsConfig.ts';

test('les identifiants techniques sont fictifs, stables et au format GUID', () => {
  const id = fakeTechnicalId('task-template', 't1');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(fakeTechnicalId('task-template', 't1'), id);
  assert.notEqual(fakeTechnicalId('task-template', 't1'), fakeTechnicalId('document', 't1'));
});

test('les mêmes entités et versions documentaires ont un identifiant cohérent entre écrans', () => {
  assert.equal(entityTechnicalId('auditType', 'at1'), fakeTechnicalId('audit-type', 'at1'));
  assert.equal(entityTechnicalId('site', 's1'), fakeTechnicalId('entity-site', 's1'));
  const template = documentTemplateTechnicalId('doc1');
  assert.equal(template, fakeTechnicalId('document', 'doc1'));
  const descriptions = ['fr', 'en', 'ko'].map(locale => documentTemplateDescriptionTechnicalId('doc1', locale));
  assert.equal(new Set(descriptions).size, 3);
  assert.ok(descriptions.every(id => id !== template));
  assert.notEqual(documentTemplateTechnicalId('doc1'), documentTemplateTechnicalId('doc2'));
  assert.notEqual(descriptions[0], documentTemplateDescriptionTechnicalId('doc2', 'fr'));
});

test('les noms de tables fictives sont centralisés', () => {
  const tables = Object.values(technicalMappings).flatMap(mapping => mapping.tables);
  for (const table of [
    'TableDémo01', 'TableDémo02', 'TableDémo03', 'TableDémo04',
    'TableDémo05', 'TableDémo08', 'TableDémo09',
    'TableDémo10', 'TableDémo11', 'TableDémo12',
    'TableDémo24', 'TableDémo30', 'TableDémo31',
  ]) assert.ok(tables.includes(table), `table manquante : ${table}`);
});

test('les paramétrages spécifiques disposent de domaines, champs et exemples locaux', () => {
  const records = createInitialSpecificSettings();
  assert.equal(new Set(records.map(record => record.kind)).size, Object.keys(settingDefinitions).length);
  for (const [kind, definition] of Object.entries(settingDefinitions)) {
    assert.equal(definition.kind, kind);
    assert.ok(definition.title);
    assert.ok(definition.fields.length > 0);
    if (definition.mapping) assert.ok(technicalMappings[definition.mapping].tables.length > 0);
    assert.ok(records.some(item => item.kind === kind));
  }
  assert.equal(settingDefinitions.workload.mapping, null);
  assert.deepEqual(reportSpecificKinds, [
    'auditPlanningWeft', 'certificateWeft', 'nonConformityDocument', 'notificationLetter', 'specificDocumentTemplate',
  ]);
});

test('les certificats fictifs conservent 19 variantes et leurs rattachements', () => {
  const examples = createCertificateExamples();
  assert.equal(examples.length, 19);
  assert.equal(new Set(examples.map(item => item.id)).size, 19);
  const expectedLanguages = {
    'IATF 16949:2016': ['Français', 'Anglais'],
    'ISO 50001:2018': ['Français', 'Anglais'],
    'ISO 14001:2015': ['Français', 'Anglais', 'Coréen'],
    'IATF 16949:2016 (IATF)': ['Français', 'Anglais', 'Coréen'],
    'ISO 9001:2015': ['Français', 'Anglais', 'Coréen'],
    'ISO 45001:2018': ['Français', 'Anglais', 'Coréen'],
    'ISO 9001:2015 (IATF)': ['Français', 'Anglais', 'Coréen'],
  };
  for (const [standard, languages] of Object.entries(expectedLanguages)) {
    assert.deepEqual(examples.filter(item => item.reportScope.standards.includes(standard)).map(item => item.values.language), languages);
    assert.ok(settingDefinitions.certificateWeft.standardOptions.SM.includes(standard));
  }
  for (const item of examples) {
    assert.equal(item.kind, 'certificateWeft');
    assert.equal(item.reportScope.standardType, 'SM');
    const standard = item.reportScope.standards[0];
    const auditCount = standard.startsWith('IATF') ? 10 : standard === 'ISO 45001:2018' ? 0 : 6;
    assert.equal(item.reportScope.auditTypes.length, auditCount);
    assert.equal(item.values.certificationType, 'Système de management');
    assert.equal(item.values.expertiseVetoVisible, 'Oui');
    assert.equal(item.active, true);
    assert.match(item.values.templateName, /^modele-demo-.*\.docx$/);
  }
  const iatfIso9001 = examples.filter(item => item.reportScope.standards.includes('ISO 9001:2015 (IATF)'));
  assert.equal(iatfIso9001.find(item => item.values.language === 'Français').values.templateName, 'modele-demo-iso-fr.docx');
  assert.equal(iatfIso9001.find(item => item.values.language === 'Anglais').values.templateName, 'modele-demo-iso-en.docx');
  assert.ok(createInitialSpecificSettings().some(item => item.id === 'sp-certificate-1' && item.reportScope === undefined));
});

test('les listes de types d’audit des certificats ont une union sans doublons', () => {
  const iso = [
    'Initial - Stage 1', 'Initial - Stage 2', 'Inmetro', 'Minor modification',
    'Multisites Démo Initial - Stage 1', 'Multisites Démo Initial - Stage 2',
  ];
  const iatf = [
    '(IATF) Initial - Stage 1', '(IATF) Initial - Stage 2', '(IATF) Initial - Stage 2 - Démo B',
    '(IATF) Initial - Step 1- Démo A', '(IATF) Initial - Step 2- Démo A',
    '(IATF) Re-certification', '(IATF) Special', '(IATF) Surveillance',
    '(IATF) Surveillance -Démo A', '(IATF) Transfer',
  ];
  for (const standard of ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 50001:2018', 'ISO 9001:2015 (IATF)', 'ISO 9001']) {
    assert.deepEqual(certificateAuditTypesFor([standard]), iso);
  }
  for (const standard of ['IATF 16949:2016', 'IATF 16949:2016 (IATF)', 'IATF 16949']) {
    assert.deepEqual(certificateAuditTypesFor([standard]), iatf);
  }
  assert.deepEqual(certificateAuditTypesFor(['ISO 9001:2015', 'ISO 14001:2015']), iso);
  assert.deepEqual(certificateAuditTypesFor(['ISO 9001:2015', 'IATF 16949:2016']), [...iso, ...iatf]);
  assert.equal(certificateAuditTypesFor(['Toutes les normes']).length, 16);
  assert.deepEqual(certificateAuditTypesFor(['ISO 45001:2018']), []);
});
