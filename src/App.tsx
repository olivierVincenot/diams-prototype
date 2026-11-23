import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowRightLeft, Building2, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, Database, Diamond, Download, FileCheck2, FileText, History, Home, LayoutGrid, LockKeyhole, Network, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Wrench, X, type LucideIcon } from 'lucide-react';
import type { Commit, EntityKind, Impact, Page, Store } from './types';
import { alphabetic, matches } from './domain';
import { createStore, loadStore, persistStore } from './storage';
import { Badge, Confirmation, Empty, Modal, Notice, SearchBox, SectionTitle, TechnicalInlineId, formatDate } from './ui';
import { Tasks } from './Tasks';
import { Matrices } from './Matrices';
import { Documents } from './Documents';
import { Reports } from './Reports';
import { Transfers } from './Transfers';
import { SpecificSettings } from './SpecificSettings';
import { Exports } from './Exports';
import { fakeTechnicalId, supportModeStorageKey } from './supportConfig';

const pageNames: Record<Page, string> = { home: 'Vue d’ensemble', tasks: 'Modèles de tâches', matrices: 'Matrices de tâches', documents: 'Gérer les documents', reports: 'Trames / documents spécifiques', transfers: 'Réaffectations', history: 'Journal des modifications', specifics: 'Paramétrages spécifiques', exports: 'Exporter' };
type Navigation = { page: Page; query?: string; kind?: EntityKind; key: number };
type Navigate = (page: Page, query?: string, kind?: EntityKind) => void;
const navItems: { page: Page; icon: LucideIcon; label: string }[] = [
  { page: 'tasks', icon: ClipboardList, label: 'Créer / modifier / supprimer une tâche' },
  { page: 'matrices', icon: Network, label: 'Rattacher des tâches à une matrice' },
  { page: 'documents', icon: FileText, label: 'Gérer les documents' },
  { page: 'reports', icon: FileCheck2, label: 'Trames / documents spécifiques' },
];

export default function App() {
  const [loaded] = useState(loadStore);
  const [store, setStore] = useState<Store | null>(loaded.store);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(loaded.error ? { text: loaded.error, error: true } : null);
  const [nav, setNav] = useState<Navigation>({ page: 'home', key: 0 });
  const [impact, setImpact] = useState<Impact | null>(null);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState('');
  const [supportMode, setSupportMode] = useState(false);
  const navigate: Navigate = (page, query, kind) => { setNav(n => ({ page, query, kind, key: n.key + 1 })); setSearch(''); };
  useEffect(() => {
    try {
      setSupportMode(localStorage.getItem(supportModeStorageKey) === 'true');
    } catch (cause) {
      setMessage({ text: `Impossible de lire le mode Support IT local : ${cause instanceof Error ? cause.message : String(cause)}`, error: true });
    }
  }, []);
  const toggleSupportMode = () => {
    const next = !supportMode;
    try {
      localStorage.setItem(supportModeStorageKey, String(next));
      setSupportMode(next);
    } catch (cause) {
      setMessage({ text: `Impossible d’enregistrer le mode Support IT : ${cause instanceof Error ? cause.message : String(cause)}`, error: true });
    }
  };
  const write = (next: Store, success: string) => {
    try {
      persistStore(next);
      setStore(next);
      setMessage({ text: success, error: false });
      return true;
    } catch (cause) {
      setMessage({ text: `Enregistrement impossible. Aucune modification appliquée : ${cause instanceof Error ? cause.message : String(cause)}`, error: true });
      return false;
    }
  };
  const commit: Commit = (title, scope, change) => {
    if (!store) return false;
    try {
      const data = change(store.data);
      const log = { id: crypto.randomUUID(), at: new Date().toISOString(), author: 'Administrateur démo', title, scope };
      return write({ ...store, data, history: [log, ...store.history], undo: { data: store.data, logId: log.id } }, `${title} — enregistré dans ce navigateur.`);
    } catch (cause) {
      setMessage({ text: `Modification refusée : ${cause instanceof Error ? cause.message : String(cause)}`, error: true });
      return false;
    }
  };
  const reset = () => setImpact({
    title: 'Réinitialiser la démonstration ?', description: 'Les données locales et le journal seront remplacés par le jeu d’exemples initial. Les autres applications du navigateur ne sont pas concernées.',
    scope: 'Uniquement les données de cette maquette dans ce navigateur', facts: [{ label: 'connexions externes', value: 0 }], warning: 'Cette réinitialisation ne peut pas être annulée.', confirmLabel: 'Réinitialiser les données',
    apply: () => { const ok = write(createStore(), 'Le jeu de démonstration a été réinitialisé.'); if (ok) navigate('home'); return ok; },
  });
  const undo = () => {
    if (!store?.undo) return;
    const snapshot = store.undo;
    const previous = store.history.find(h => h.id === snapshot.logId);
    setImpact({
      title: 'Annuler la dernière modification ?', description: previous?.title || 'Restaurer le dernier état local.',
      scope: 'Restauration du jeu local avant la dernière opération', facts: [{ label: 'opération annulée', value: 1 }], apply: () => write({
        ...store, data: snapshot.data, undo: null,
        history: [{ id: crypto.randomUUID(), at: new Date().toISOString(), author: 'Administrateur démo', title: `Retour arrière : ${previous?.title || 'dernière opération'}`, scope: 'Restauration locale' }, ...store.history.map(h => h.id === snapshot.logId ? { ...h, undone: true } : h)],
      }, 'La dernière modification a été annulée. Le journal est conservé.'),
    });
  };
  if (!store) return <div className="fatal-screen"><ShieldCheck size={44} /><h1>Données locales indisponibles</h1><p role="alert">{message?.text}</p><p>Vos données ne sont pas écrasées automatiquement. Réinitialisez uniquement si vous acceptez de perdre le jeu local.</p><button className="btn primary" onClick={reset}>Réinitialiser la maquette</button>{impact && <Confirmation impact={impact} onClose={() => setImpact(null)} />}</div>;
  const data = store.data;
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('home')} aria-label="DIAMS Tools par UTAC, accueil"><img className="utac-logo" src="/utac-logo.png" alt="UTAC" /><span className="brand-product">DIAMS<span className="brand-tools">tools</span></span></button>
      <div className="workspace-label">ESPACE ADMINISTRATEUR</div>
      <nav aria-label="Navigation principale">
        <button className={`nav-item ${nav.page === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><LayoutGrid size={18} />Vue d’ensemble</button>
        <div className="nav-heading">PARAMÉTRAGE</div>
        {navItems.map(item => <button key={item.page} className={`nav-item ${nav.page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)}><item.icon size={18} /><span className="nav-label">{item.label}{item.page === 'documents' && <small>Types, modèles et associations aux tâches</small>}</span>{item.page === 'matrices' && <span className="nav-count">{data.matrices.filter(m => !m.deleted).length}</span>}</button>)}
        <button className={`nav-item ${nav.page === 'specifics' ? 'active' : ''}`} onClick={() => navigate('specifics')}><Settings2 size={18} />Paramétrages spécifiques</button>
        <button className={`nav-item ${nav.page === 'exports' ? 'active' : ''}`} onClick={() => navigate('exports')}><Download size={18} />Exporter</button>
        <div className="nav-heading">ADMINISTRATION DES DONNÉES</div>
        <button className={`nav-item ${nav.page === 'transfers' ? 'active' : ''}`} onClick={() => navigate('transfers')}><ArrowRightLeft size={18} />Réaffectations</button>
        <button className={`nav-item ${nav.page === 'history' ? 'active' : ''}`} onClick={() => navigate('history')}><History size={18} />Journal des modifications</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sandbox-card"><span className="sandbox-icon"><Database size={18} /></span><strong>Un espace pour essayer</strong><p>Données d’exemple, liberté réelle.<br />Explorez sans toucher à la production.</p><Badge tone="amber">ENVIRONNEMENT DEV</Badge></div>
        <button className="nav-item help-link" onClick={() => setHelp(true)}><CircleHelp size={18} />Guide de la maquette<ChevronRight size={15} /></button>
        <div className="sidebar-footer"><small>Certification<br />DIAMS Tools Web · v1.0</small></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><Settings2 size={17} /><span>Paramétrage</span><ChevronRight size={14} /><strong>{pageNames[nav.page]}</strong></div>
        <div className="topbar-right"><button type="button" className={`support-toggle ${supportMode ? 'active' : ''}`} aria-pressed={supportMode} onClick={toggleSupportMode}><Wrench size={15} />Mode Support IT</button>{supportMode && <span className="support-active">SUPPORT IT ACTIF</span>}<span className="environment"><span />DEV <span className="environment-label">Bac à sable</span></span><span className="topbar-divider" /><div className="user-avatar">AD</div><div className="user-details"><strong>Administrateur démo</strong><small>Profil fictif · accès local</small></div></div>
      </header>
      <div className="demo-strip"><span><ShieldCheck size={14} />Maquette interactive · Données d’exemple locales</span><span><LockKeyhole size={13} />Aucune connexion à DIAMS, SQL Server ou Azure</span>{supportMode && <span>Données techniques simulées. Correspondances à confirmer avec le schéma DIAMS.</span>}</div>
      <main>
        {nav.page !== 'home' && <div className="page-breadcrumb"><button onClick={() => navigate('home')}><Home size={13} />Accueil</button><ChevronRight size={12} /><span>{pageNames[nav.page]}</span></div>}
        {nav.page === 'home' && <Dashboard store={store} navigate={navigate} search={search} setSearch={setSearch} />}
        {nav.page === 'tasks' && <Tasks key={nav.key} data={data} commit={commit} confirm={setImpact} initialSearch={nav.query} supportMode={supportMode} />}
        {nav.page === 'matrices' && <Matrices key={nav.key} data={data} commit={commit} confirm={setImpact} initialSearch={nav.query} supportMode={supportMode} />}
        {nav.page === 'documents' && <Documents key={nav.key} data={data} commit={commit} confirm={setImpact} initialSearch={nav.query} supportMode={supportMode} />}
        {nav.page === 'reports' && <Reports data={data} commit={commit} confirm={setImpact} supportMode={supportMode} />}
        {nav.page === 'transfers' && <Transfers key={nav.key} data={data} commit={commit} confirm={setImpact} initialKind={nav.kind} supportMode={supportMode} />}
        {nav.page === 'history' && <Journal store={store} undo={undo} reset={reset} supportMode={supportMode} />}
        {nav.page === 'specifics' && <SpecificSettings data={data} commit={commit} confirm={setImpact} supportMode={supportMode} />}
        {nav.page === 'exports' && <Exports data={data} commit={commit} confirm={setImpact} supportMode={supportMode} />}
        <footer className="main-footer"><span><Diamond size={13} />DIAMS Tools Web <span>·</span> Maquette fonctionnelle</span><span><span className="status-dot" />Stockage dans ce navigateur uniquement</span></footer>
      </main>
    </div>
    {message && <Notification message={message} onClose={() => setMessage(null)} />}
    {impact && <Confirmation key={impact.title} impact={impact} onClose={() => setImpact(null)} supportMode={supportMode} />}
    {help && <Modal title="Bienvenue dans votre espace de démonstration" onClose={() => setHelp(false)}><div className="modal-body stack">
      <Notice>Aucune connexion métier n’est configurée. Toutes les modifications restent dans le stockage local du navigateur pour cette adresse.</Notice>
      <h3>Un parcours simple</h3><ol className="help-steps"><li>Créez ou modifiez un modèle de tâche et choisissez sa référence de date.</li><li>Sélectionnez un type d’audit puis un type de matrice pour ouvrir ses matrices et ses tâches.</li><li>Ajoutez une tâche, choisissez la propagation et vérifiez les impacts.</li><li>Associez un document métier à ses versions FR, EN et KO, puis simulez le remplacement ciblé d’un fichier Word.</li><li>Testez la sélection d’une trame ou une réaffectation organisationnelle.</li><li>Gérez les entrées de démonstration locales dans « Paramétrages spécifiques ».</li></ol>
      <p>Dans la recherche de la vue d’ensemble, chaque résultat affiche son type (Tâche, Matrice ou Document) à côté de son nom complet. Cliquez dessus pour ouvrir le domaine correspondant avec ce nom comme filtre.</p>
      <h3>Trames / documents spécifiques</h3><p>Dans chaque rubrique, parcourez la cartographie : Type de norme → Norme(s) → Types d’audit. Cliquez sur une norme pour consulter toutes les fiches de ses types d’audit, puis sélectionnez éventuellement un type d’audit pour affiner les résultats. La liste complète permet aussi de retrouver toutes les fiches. Pour les documents spécifiques, vous pouvez renseigner plusieurs normes et types d’audit dans l’éditeur ; les anciennes fiches sans rattachement restent classées « Non renseigné ».</p>
      <h3>Paramètres des modèles de tâches</h3><p>Le formulaire propose 23 types de tâche de démonstration. Un ancien type hors liste reste conservé dans les données et les filtres ; choisissez un type proposé pour enregistrer son édition. Toutes les listes du formulaire conservent un choix unique. Des rôles de démonstration sont proposés dans la maquette. Pour une tâche contrat, choisissez « CONTRAT » et « Signataire du contrat ». Renseignez le nom et la description française du modèle, puis utilisez « Proposer les traductions manquantes » pour les textes connus du dictionnaire local. Les textes inconnus sont à traduire manuellement ; les traductions existantes sont conservées. Configurez les quatre options de fonctionnement et, pour chaque langue FR/EN/KO, le titre, la description et son statut actif. La référence de date reste unique : début ou fin d’audit, date du cycle, décision POV ou autre tâche. Ces options sont enregistrées localement ; aucun moteur de validation des tâches en production n’est connecté.</p>
      <h3>Listes à cases à cocher</h3><p>Les filtres permettent de cocher plusieurs valeurs : les résultats correspondent à l’une des valeurs cochées dans chaque filtre. Décochez toutes les valeurs ou cochez « Tous » pour enlever ce filtre. Les champs métier qui exigent une seule valeur conservent un choix unique : cocher une autre option remplace la précédente. Ces champs utilisent le même menu à cases, sans liste système supplémentaire ; les champs obligatoires restent contrôlés avant l’enregistrement et affichent leur erreur sous la liste.</p>
      <h3>Paramètres des documents</h3><p>Dans « Gérer les documents », l’onglet « Types de documents » permet de créer, modifier et supprimer les types, leurs règles et leurs traductions. Un type utilisé ne peut pas être supprimé ; renommer un type met à jour ses modèles. Un type inactif reste conservé sur les modèles existants mais ne peut pas être choisi pour un nouveau modèle. Les types personnalisés antérieurs sont conservés. Renseignez ensuite le nom, la description et les options du modèle. Un nouveau document est actif par défaut. Cocher « document obligatoire » ou « document de travail » sélectionne « non généré » et bloque les modes avant et après la tâche ; décochez les deux pour pouvoir choisir la génération. L’atelier de script apparaît uniquement pour les documents générés ; les scripts masqués restent conservés. Un document non généré peut être enregistré sans nom de template ni script. Les anciens documents sans mode restent générés avant la tâche sauf s’ils sont obligatoires ou de travail. Pour un document généré, un fichier valide renseigne le nom logique s’il est vide. S’il diffère, un renommage est proposé sans modifier le fichier d’origine ; l’envoi est bloqué en cas de refus. Après concordance des noms et validation du script, l’envoi Azure simulé démarre automatiquement. Enregistrez ensuite le document pour conserver ses métadonnées ; la fenêtre de remplacement les enregistre directement. Aucun transfert réel n’a lieu. Les noms restent modifiables et doivent être distincts entre langues et documents. En mode Support IT, chaque document a un seul identifiant de document fictif et un identifiant de version distinct par langue.</p>
      <h3>Comparer les templates</h3><p>Dans le détail des trames, alternez entre « Par fiche » et « Par template ». Les fiches des documents spécifiques mettent leur libellé en avant et conservent le nom du template dans les détails. La seconde vue regroupe les noms de templates identiques et affiche leurs types d’audit distincts, normes, langues et fiches associées. Les espaces en début et fin de nom sont ignorés ; les autres caractères doivent être identiques. Les types d’audit non renseignés ne sont pas comptés. Ouvrez « Liste complète » pour comparer les templates entre plusieurs normes.</p>
      <p>Les trames de certificat incluent 19 exemples de démonstration : normes avec millésime, variantes FR/EN/KO disponibles, type de certification et noms de templates. Leur type de norme reste « SM », y compris pour IATF. Les variantes IATF utilisent 10 types d’audit ; ISO 9001, ISO 14001 et ISO 50001 utilisent les 6 types ISO fournis, également appliqués à « ISO 9001:2015 (IATF) ». ISO 45001 reste sans type d’audit renseigné. Les rattachements déjà personnalisés sont conservés. Ces références n’impliquent pas la présence des fichiers Word dans la maquette.</p>
      <h3>Paramètres des matrices</h3><p>Renseignez le nom et la description française de la matrice, puis complétez leurs versions EN/KO ou proposez les traductions depuis le dictionnaire local, comme pour les tâches. Les anciennes matrices sans description restent compatibles. La case « Process spécial » reste disponible pour les matrices de type AuditProcess. Les descriptions et autres propriétés sont enregistrées sur la matrice éditée ; la propagation des ajouts/retraits de tâches conserve son périmètre existant. Les exemples fictifs de re-certification permettent de tester les matrices : les douze tâches sont associées au processus complet à trois auditeurs ; les autres matrices ne reçoivent pas de tâches inventées. Le type d’audit d’exemple n’est rattaché à aucune certification réelle.</p>
      <p>Dans la cartographie, utilisez la corbeille à droite du nom d’une matrice pour la supprimer après confirmation. La suppression logique masque uniquement cette matrice, même si des audits y sont liés : les audits existants, leurs tâches et les autres matrices restent conservés. La suppression est également accessible dans le détail et peut être annulée depuis le journal.</p>
      <p>Dans le formulaire de matrice, cochez un ou plusieurs types d’audit ; au moins un est obligatoire. Le type de norme, le type de matrice et le type de certification restent à choix unique. Chaque nouveau rattachement reçoit une matrice du même nom, avec les mêmes tâches et une filiation partagée. En édition, la matrice ouverte conserve son identifiant ; les autres rattachements existants ne sont ni supprimés ni recréés. Les nouvelles matrices et la modification sont confirmées et enregistrées ensemble dans le journal.</p>
      <p>Les listes et filtres des matrices proposent aussi les 16 types de norme et les 7 types de certification de démonstration. Les anciens choix et les valeurs personnalisées sont conservés. Le filtre « SM » couvre également les matrices affichées comme « Système de management ». Ces choix ne créent pas automatiquement de matrices ni de rattachements à des types d’audit.</p>
      <h3>Matrice des statuts de certification</h3><p>Les 83 exemples fictifs comprennent des doublons et quatre lignes incomplètes. Recherchez une décision, un statut ou un type d’audit ; complétez les champs manquants avant d’enregistrer une transition. Leur statut actif est une valeur de démonstration.</p>
      <h3>Mode Support IT</h3><p>Activez le bouton global pour afficher les identifiants fictifs des fiches et de leurs relations dans les listes, arborescences, fenêtres et confirmations. Les blocs techniques permettent de les copier ; les tables et champs complémentaires restent repliables. Les brouillons et versions linguistiques ont aussi des identifiants simulés. Le choix reste dans ce navigateur ; aucun identifiant ni aucune correspondance technique ne vaut validation du schéma DIAMS.</p>
      <h3>Exporter</h3><p>Le plan de charge permet de filtrer par dates de début de cycle et type de certification, de choisir les colonnes affichées et de télécharger un CSV. L’ordre de mission filtre par dates d’audit, type de certification et auditeur, puis détaille les missions correspondantes. Le bouton ouvre un brouillon dans votre logiciel de messagerie, à vérifier et envoyer manuellement ; les adresses sont fictives et aucun envoi automatique n’est connecté. Les données d’extraction sont des exemples indépendants des audits de la maquette. Les anciennes fiches locales de plan de charge restent accessibles sous le tableau et ne sont pas incluses dans l’extraction.</p>
      <h3>Des limites explicites</h3><p>Les textes métier des tâches, matrices, documents et paramétrages spécifiques proposent les traductions connues du dictionnaire local, uniquement pour les champs vides. Les textes inconnus sont à compléter manuellement ; aucun service de traduction n’est connecté. Les identifiants, recherches, scripts et noms de fichiers ne sont pas traduits. Les métadonnées des fichiers sont conservées, jamais leur contenu. Les clés Azure affichées sont des propositions fictives.</p><p>Les correspondances entre matrices reposent sur leur source commune. La propagation modifie réellement les tâches des audits fictifs non terminés ; les terminés sont toujours exclus. Les autres intégrations et fonctions historiques restent à cadrer.</p>
      <h3>Journal et retour arrière</h3><p>Chaque modification est tracée avec un auteur fictif, une date et un périmètre. La dernière opération peut être annulée depuis le journal. Vous pouvez aussi réinitialiser tout le jeu d’exemples.</p>
    </div><div className="modal-actions"><button className="btn primary" onClick={() => setHelp(false)}>Commencer l’exploration<ArrowRight size={17} /></button></div></Modal>}
  </div>;
}

function Notification({ message, onClose }: { message: { text: string; error: boolean }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node && typeof node.showPopover === 'function') {
      node.setAttribute('popover', 'manual');
      if (node.matches(':popover-open')) node.hidePopover();
      node.showPopover();
    }
  }, [message]);
  return <div ref={ref} className={`toast ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.error ? <CircleHelp size={20} /> : <CheckCircle2 size={20} />}<span>{message.text}</span><button className="icon-btn" aria-label="Fermer la notification" onClick={onClose}><X size={18} /></button></div>;
}

function Dashboard({ store, navigate, search, setSearch }: { store: Store; navigate: Navigate; search: string; setSearch: (q: string) => void }) {
  const data = store.data;
  const cards: { title: string; description: string; icon: LucideIcon; page: Page; count: string; color: string; kind?: EntityKind }[] = [
    { title: 'Créer / modifier / supprimer une tâche', description: 'Définissez les tâches, les rôles et les règles de calcul des échéances.', icon: ClipboardList, page: 'tasks', count: `${data.tasks.filter(t => t.active).length} modèles actifs`, color: 'red' },
    { title: 'Rattacher des tâches à une matrice', description: 'Visualisez et composez les parcours de vos types d’audit.', icon: Network, page: 'matrices', count: `${data.matrices.filter(m => !m.deleted && m.active).length} matrices actives`, color: 'blue' },
    { title: 'Gérer les documents', description: 'Gérer les types, les modèles et leurs associations aux tâches.', icon: FileText, page: 'documents', count: `${data.documents.length} modèles de documents`, color: 'purple' },
    { title: 'Trames / documents spécifiques', description: 'Gérez les rapports, plannings et documents spécifiques.', icon: FileCheck2, page: 'reports', count: `${data.reports.filter(r => r.active).length} règles · 5 domaines`, color: 'teal' },
    { title: 'Organisation', description: 'Réaffectez vos entreprises et vos sites en toute simplicité.', icon: Building2, page: 'transfers', kind: 'site', count: 'Clients · Entreprises · Sites', color: 'orange' },
    { title: 'Certification', description: 'Faites évoluer les liens entre schémas, certifications et audits.', icon: ShieldCheck, page: 'transfers', kind: 'auditType', count: 'Schémas · Certifications · Audits', color: 'slate' },
  ];
  const results: { id: string; name: string; type: string; page: Page }[] = [
    ...data.tasks.map(t => ({ id: t.id, name: t.name, type: 'Tâche', page: 'tasks' as const })),
    ...data.matrices.filter(m => !m.deleted).map(m => ({ id: m.id, name: m.name, type: 'Matrice', page: 'matrices' as const })),
    ...data.documents.map(d => ({ id: d.id, name: d.versions.fr.label || d.versions.en.label || d.versions.ko.label || 'Document sans titre', type: 'Document', page: 'documents' as const })),
  ];
  const found = alphabetic(results.filter(r => matches(search, r.name)), r => r.name);
  return <>
    <div className="welcome-line"><span><span className="tiny-lime-line" />VOTRE ESPACE DE PARAMÉTRAGE</span><Badge tone="green">Environnement de démonstration</Badge></div>
    <section className="hero">
      <div className="hero-content"><div className="eyebrow"><Sparkles size={14} />MOINS DE CLICS. PLUS DE CLARTÉ.</div><h1>Le paramétrage,<br /><span>simplement.</span></h1><p>Un espace unique pour organiser vos tâches, vos documents<br className="desktop-break" /> et vos données de certification. Vous gardez le contrôle.</p>
        <div className="global-search"><Search size={20} /><input type="search" aria-label="Recherche globale" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une tâche, une matrice, un document…" /><span className="search-key">Rechercher</span></div>
        {search && <div className="global-results"><div className="results-heading">{found.length} résultat(s) dans le jeu local</div>{found.slice(0, 12).map(r => <button key={r.id} onClick={() => navigate(r.page, r.name)}><Search size={14} /><span className="global-result-type">{r.type}</span><strong className="global-result-name">{r.name}</strong><ChevronRight size={15} /></button>)}{!found.length && <p>Aucun résultat pour cette recherche.</p>}{found.length > 12 && <p>Affinez la recherche pour afficher les autres résultats.</p>}</div>}
      </div>
      <div className="hero-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="illustration-node node-a"><ClipboardList size={23} /><span>Tâches</span><span className="mini-check"><CheckCircle2 size={13} /></span></div><div className="illustration-node node-b"><FileText size={23} /><span>Documents</span><span className="mini-check"><CheckCircle2 size={13} /></span></div><div className="illustration-node node-c"><ShieldCheck size={23} /><span>Certification</span></div><div className="illustration-center"><Diamond size={36} /><span>DIAMS</span></div><div className="floating-dot dot-a" /><div className="floating-dot dot-b" /><div className="illustration-caption"><span className="status-dot" />Tout est lié. Tout est plus clair.</div></div>
    </section>
    <div className="domain-heading"><div><h2>Que souhaitez-vous paramétrer ?</h2><p>Choisissez un domaine pour accéder à ses outils.</p></div><span className="subtle-count">6 espaces métier</span></div>
    <div className="domain-grid">{cards.map(card => <button className={`domain-card ${card.color}`} key={card.title} onClick={() => navigate(card.page, undefined, card.kind)}><div className="card-top"><span className="domain-icon"><card.icon size={23} /></span><ArrowRight size={19} /></div><h3>{card.title}</h3><p>{card.description}</p><div className="card-footer">{card.count}<ChevronRight size={14} /></div></button>)}</div>
    <div className="dashboard-bottom">
      <section className="panel recent-panel"><div className="panel-heading"><h3><History size={18} />Dernières modifications</h3><button className="text-link" onClick={() => navigate('history')}>Voir le journal<ArrowRight size={14} /></button></div>
        {store.history.length ? <div className="recent-list">{store.history.slice(0, 3).map(log => <div key={log.id}><span className="activity-icon"><Activity size={16} /></span><div><strong>{log.title}</strong><small>{log.author} · {formatDate(log.at)}{log.undone ? ' · Annulée' : ''}</small></div><Badge>Local</Badge></div>)}</div> : <div className="recent-empty"><span className="activity-icon"><History size={23} /></span><div><strong>Votre historique commence ici</strong><p>Vos premières modifications apparaîtront dans ce journal.</p></div></div>}
      </section>
      <section className="safe-panel"><div className="safe-panel-icon"><ShieldCheck size={23} /></div><div><h3>Vous gardez la main.</h3><p>Prévisualisez les impacts avant de confirmer.<br />Les éléments terminés restent protégés.</p><button className="text-link" onClick={() => navigate('matrices')}>Explorer la cartographie<ArrowRight size={14} /></button></div></section>
    </div>
  </>;
}

function Journal({ store, undo, reset, supportMode }: { store: Store; undo: () => void; reset: () => void; supportMode: boolean }) {
  const [search, setSearch] = useState('');
  const logs = store.history.filter(log => matches(search, log.title, log.scope, log.author));
  return <>
    <SectionTitle eyebrow="ADMINISTRATION / TRAÇABILITÉ" title="Journal des modifications" description="Retrouvez l’auteur, le périmètre et la date de chaque opération locale." action={<button className="btn" disabled={!store.undo} onClick={undo}><RotateCcw size={17} />Annuler la dernière opération</button>} />
    <div className="summary-tiles"><div className="panel"><History size={21} /><strong>{store.history.length}</strong><span>opérations tracées</span></div><div className="panel"><Database size={21} /><strong>Local</strong><span>stockage navigateur</span></div><div className="panel"><ShieldCheck size={21} /><strong>0</strong><span>connexion aux systèmes métier</span></div></div>
    <div className="panel"><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Rechercher une modification…" /><Badge>{logs.length} opérations</Badge></div>
      {!!logs.length && <div className="table-scroll"><table><thead><tr><th>Date / auteur</th><th>Modification</th><th>Périmètre</th><th>État</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{formatDate(log.at)}<small>{log.author}</small>{supportMode && <TechnicalInlineId value={fakeTechnicalId('log-entry', log.id)} />}</td><td><strong>{log.title}</strong></td><td>{log.scope}</td><td><Badge tone={log.undone ? 'neutral' : 'green'}>{log.undone ? 'Annulée' : 'Enregistrée'}</Badge></td></tr>)}</tbody></table></div>}
      {!logs.length && <Empty>Aucune modification ne correspond à cette recherche. Créez ou modifiez un paramétrage pour alimenter le journal.</Empty>}
    </div>
    <Notice>Le retour arrière restaure le jeu local avant la dernière opération et conserve sa trace. Il n’est disponible que pour la dernière modification non annulée.</Notice>
    <div className="panel reset-panel"><div><h3>Repartir d’un jeu de démonstration vierge</h3><p>Réinitialise les tâches, matrices, documents, rapports, rattachements et le journal.</p></div><button className="btn danger" onClick={reset}><RotateCcw size={16} />Réinitialiser la maquette</button></div>
  </>;
}
