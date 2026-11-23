import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as domain from '../src/domain.ts';
import * as specificConfig from '../src/specificSettingsConfig.ts';
import * as supportConfig from '../src/supportConfig.ts';
import * as dataModule from '../src/data.ts';
import * as documentTypeData from '../src/documentTypeData.ts';
import * as docxTags from '../src/docxTags.ts';
import { createInitialData } from '../src/data.ts';

const sourceUrl = new URL('../src/ui.tsx', import.meta.url);
const require = createRequire(sourceUrl);
const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const ui = {};
new Function('require', 'exports', compiled.outputText)(
  specifier => specifier === './domain' ? domain : require(specifier), ui,
);

const translatableSourceUrl = new URL('../src/TranslatableField.tsx', import.meta.url);
const compiledField = ts.transpileModule(readFileSync(translatableSourceUrl, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const translatable = {};
new Function('require', 'exports', compiledField.outputText)(
  specifier => specifier === './domain' ? domain : specifier === './ui' ? ui : require(specifier), translatable,
);

const editorSourceUrl = new URL('../src/SpecificSettingsEditor.tsx', import.meta.url);
const compiledEditor = ts.transpileModule(readFileSync(editorSourceUrl, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const editor = {};
new Function('require', 'exports', compiledEditor.outputText)(
  specifier => {
    if (specifier === './domain') return domain;
    if (specifier === './ui') return ui;
    if (specifier === './specificSettingsConfig') return specificConfig;
    if (specifier === './supportConfig') return supportConfig;
    if (specifier === './TranslatableField') return translatable;
    return require(specifier);
  }, editor,
);

const documentsSourceUrl = new URL('../src/Documents.tsx', import.meta.url);
const typeSourceUrl = new URL('../src/DocumentTypes.tsx', import.meta.url);
const compiledTypes = ts.transpileModule(readFileSync(typeSourceUrl, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const documentTypes = {};
new Function('require', 'exports', `${compiledTypes.outputText}\nexports.testDocumentTypeEditor = DocumentTypeEditor;`)(
  specifier => {
    if (specifier === './domain') return domain;
    if (specifier === './documentTypeData') return documentTypeData;
    if (specifier === './ui') return ui;
    if (specifier === './supportConfig') return supportConfig;
    if (specifier === './TranslatableField') return translatable;
    return require(specifier);
  }, documentTypes,
);
const compiledDocuments = ts.transpileModule(readFileSync(documentsSourceUrl, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const documents = {};
new Function('require', 'exports', `${compiledDocuments.outputText}\nexports.testDocumentEditor = DocumentEditor; exports.testReplacement = TemplateReplacement; exports.testAzureConfirmation = AzureReplacementConfirmation; exports.testCreateDocument = createDocument;`)(
  specifier => {
    if (specifier === './domain') return domain;
    if (specifier === './data') return dataModule;
    if (specifier === './docxTags') return docxTags;
    if (specifier === './ui') return ui;
    if (specifier === './supportConfig') return supportConfig;
    if (specifier === './TranslatableField') return translatable;
    if (specifier === './DocumentTypes') return documentTypes;
    return require(specifier);
  }, documents,
);

test('gestion des types : paramètres, traductions, identifiants et suppression protégée', () => {
  const data = createInitialData();
  const item = data.documentTypes.find(type => type.name === data.documents[0].type);
  const list = renderToStaticMarkup(createElement(documentTypes.DocumentTypes, {
    data, supportMode: true, commit: () => true, confirm: () => {},
  }));
  const editorHtml = renderToStaticMarkup(createElement(documentTypes.testDocumentTypeEditor, {
    item, data, supportMode: true, onClose: () => {}, onSave: () => {},
  }));
  assert.match(list, /Suppression bloquée/);
  assert.ok(list.includes(supportConfig.fakeTechnicalId('document-type', item.id)));
  for (const label of ['Obligatoire / requis', 'Visible par le personnel UTAC', 'Visible par les auditeurs externes', 'Visible par les correspondants', 'Rattaché à un site', 'Version FR active', 'Version EN active', 'Version KO active', 'Traductions EN / KO'])
    assert.ok(editorHtml.includes(label), label);
  for (const locale of ['fr', 'en', 'ko'])
    assert.ok(editorHtml.includes(supportConfig.fakeTechnicalId('document-type-description', `${item.id}:${locale}`)));
});

test('les options documentaires et les scripts suivent le mode de génération', () => {
  const data = createInitialData();
  const document = { ...data.documents[0], generationMode: 'none', originDocumentId: data.documents[1].id };
  const props = { document, data, supportMode: true, onClose: () => {}, onSave: () => {} };
  const html = renderToStaticMarkup(createElement(documents.testDocumentEditor, props));
  assert.ok(html.indexOf('Nom du document') < html.indexOf('Paramètres du document'));
  assert.ok(html.indexOf('Description du document') < html.indexOf('Paramètres du document'));
  for (const label of ['Document de travail', 'Document obligatoire', 'Document template d’origine', 'Non généré', 'Avant la tâche', 'Après la tâche', 'Visible en expertise', 'Preuve mise en œuvre', 'Vérification mise en œuvre']) assert.ok(html.includes(label));
  assert.ok(html.includes(supportConfig.fakeTechnicalId('document', data.documents[1].id)));
  assert.doesNotMatch(html, /Balises et script SQL|Configuration linguistique incomplète/);
  const generated = renderToStaticMarkup(createElement(documents.testDocumentEditor, { ...props, document: { ...document, mandatory: false, generationMode: 'after' } }));
  assert.match(generated, /Balises et script SQL/);
  const legacy = renderToStaticMarkup(createElement(documents.testDocumentEditor, { ...props, document: { ...data.documents[0], mandatory: false } }));
  assert.match(legacy, /Balises et script SQL/);
  const replacement = renderToStaticMarkup(createElement(documents.testReplacement, { document, supportMode: false, onClose: () => {}, onLocalSave: () => true, onAzureSave: () => true }));
  assert.doesNotMatch(replacement, /Balises et script SQL|Analyser et valider le script/);
});

test('un nouveau document est actif et les documents obligatoires ou de travail ne sont pas générés', () => {
  const data = createInitialData();
  const fresh = documents.testCreateDocument();
  assert.equal(fresh.active, true);
  for (const flags of [{ mandatory: true, workDocument: false }, { mandatory: false, workDocument: true }]) {
    const document = { ...data.documents[0], ...flags, generationMode: 'after' };
    const html = renderToStaticMarkup(createElement(documents.testDocumentEditor, {
      document, data, supportMode: false, onClose: () => {}, onSave: () => {},
    }));
    assert.match(html, /name="generationMode" checked="" value="none"/);
    assert.match(html, /name="generationMode" disabled="" value="before"/);
    assert.match(html, /name="generationMode" disabled="" value="after"/);
    assert.doesNotMatch(html, /Balises et script SQL/);
    assert.match(html, /Un document obligatoire ou de travail ne peut pas être généré/);
    const replacement = renderToStaticMarkup(createElement(documents.testReplacement, {
      document, supportMode: false, onClose: () => {}, onLocalSave: () => true, onAzureSave: () => true,
    }));
    assert.doesNotMatch(replacement, /Balises et script SQL|Analyser et valider le script/);
  }
});

test('les écrans du document présentent un identifiant commun et un identifiant par description linguistique', () => {
  const data = createInitialData();
  const document = { ...data.documents[0], type: 'Ancien type personnalisé' };
  const template = supportConfig.documentTemplateTechnicalId(document.id);
  const fr = supportConfig.documentTemplateDescriptionTechnicalId(document.id, 'fr');
  const en = supportConfig.documentTemplateDescriptionTechnicalId(document.id, 'en');
  const ko = supportConfig.documentTemplateDescriptionTechnicalId(document.id, 'ko');
  const editorHtml = renderToStaticMarkup(createElement(documents.testDocumentEditor, {
    document, data, supportMode: true, onClose: () => {}, onSave: () => {},
  }));
  const listing = renderToStaticMarkup(createElement(documents.Documents, {
    data: { ...data, documents: [document] }, supportMode: true, commit: () => true, confirm: () => {},
  }));
  const replacement = renderToStaticMarkup(createElement(documents.testReplacement, {
    document, supportMode: true, onClose: () => {}, onLocalSave: () => true, onAzureSave: () => true,
  }));
  const confirmation = renderToStaticMarkup(createElement(documents.testAzureConfirmation, {
    documentId: document.id, supportMode: true, version: document.versions.en, locale: 'en', generated: true,
    fileName: 'nouveau.docx', nextVersion: 3, onClose: () => {}, onConfirm: () => {},
  }));
  for (const html of [listing, editorHtml, replacement, confirmation]) {
    assert.ok(html.includes(template));
    assert.doesNotMatch(html, /ID document (FR|EN|KO)/);
  }
  for (const id of [fr, en, ko]) assert.ok(listing.includes(id) && editorHtml.includes(id));
  assert.ok(replacement.includes(fr) && confirmation.includes(en));
  assert.match(editorHtml, /Ancien type personnalisé/);
});

  test('les identifiants techniques sont visibles sans ouvrir les informations complémentaires', () => {
    const html = renderToStaticMarkup(createElement(ui.TechnicalInfo, {
      ids: [{ label: 'Identifiant simulé', value: 'identifiant-test' }],
      fields: [], tables: ['TableSimulée'],
    }));
    assert.ok(html.indexOf('identifiant-test') < html.indexOf('<details'));
    assert.match(html, /Copier l’identifiant/);
    assert.match(html, /TableSimulée/);
  });

  test('les sections et versions de checklist affichent leurs identifiants seulement en mode support', () => {
    const data = createInitialData();
    const record = data.specificSettings.find(item => item.kind === 'checklist');
    record.checklistSections = [{ id: 'section-test', translations: editor.emptySettingTranslations() }];
    const props = { record, data, tables: [], onClose: () => {}, onSave: () => {} };
    const sectionId = supportConfig.fakeTechnicalId('checklist-section', 'section-test');
    const textId = supportConfig.fakeTechnicalId('checklist-section-translation', 'section-test:fr');
    const withSupport = renderToStaticMarkup(createElement(editor.SpecificSettingsEditor, { ...props, supportMode: true }));
    const withoutSupport = renderToStaticMarkup(createElement(editor.SpecificSettingsEditor, { ...props, supportMode: false }));
    assert.ok(withSupport.includes(sectionId) && withSupport.includes(textId));
    assert.ok(!withoutSupport.includes(sectionId) && !withoutSupport.includes(textId));
  });

test('les nouvelles versions linguistiques sont toutes actives et les choix enregistrés sont conservés', () => {
  const fresh = editor.emptySettingTranslations();
  assert.deepEqual(Object.values(fresh).map(version => version.active), [true, true, true]);
  const record = { id: 'tool', kind: 'toolBox', name: '', active: true, values: {} };
  assert.deepEqual(Object.values(editor.settingTranslationsFor(record)).map(version => version.active), [true, true, true]);
  const stored = structuredClone(fresh);
  stored.en.active = false;
  assert.deepEqual(editor.settingTranslationsFor({ ...record, translations: stored }), stored);
  const legacy = editor.settingTranslationsFor({ ...record, name: 'Titre', values: { language: 'Anglais' } });
  assert.deepEqual(Object.values(legacy).map(version => version.active), [true, true, true]);
  assert.equal(legacy.en.title, 'Titre');
});

test('un texte métier propose des versions modifiables sans traduire une source vide', () => {
  const html = renderToStaticMarkup(createElement(translatable.TranslatableField, {
    label: 'Description', value: '', multiline: true, knownLabels: [],
    translations: { en: 'Texte conservé', ko: '' }, onChange: () => {}, onTranslationsChange: () => {},
  }));
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, /Description · Anglais/);
  assert.match(html, /Texte conservé/);
  assert.match(html, /Dictionnaire local uniquement/);
});

test('un choix unique utilise les cases sans select natif et conserve un champ validable', () => {
  const html = renderToStaticMarkup(createElement(ui.Select, {
    label: 'Type de norme', value: 'SM', options: ['SM', 'IATF'], required: true, onChange: () => {},
  }));
  assert.doesNotMatch(html, /<select\b|<details\b|type="checkbox"/);
  assert.match(html, /<input[^>]*type="text"[^>]*required=""[^>]*value="SM"/);
  assert.match(html, /<button[^>]*aria-expanded="false"/);
  assert.match(html, /Type de norme : SM/);
});

test('une certification non précisée ou désactivée conserve sa valeur et ses contraintes', () => {
  const options = [{ value: '', label: 'Non précisé' }, 'SERMI'];
  const html = renderToStaticMarkup(createElement(ui.Select, {
    label: 'Type de certification', value: '', options, onChange: () => {},
  }));
  assert.doesNotMatch(html, /<select\b|<input[^>]*required=/);
  assert.match(html, /Type de certification : Non précisé/);
  assert.match(html, /<input[^>]*type="text"[^>]*value=""/);
  const disabled = renderToStaticMarkup(createElement(ui.Select, {
    label: 'Type de certification', value: 'SERMI', options, required: true, disabled: true, onChange: () => {},
  }));
  assert.match(disabled, /<input[^>]*type="text"[^>]*disabled=""[^>]*value="SERMI"/);
});
