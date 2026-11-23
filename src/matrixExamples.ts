export const workbookMatrixExamples = [
  {
    "row": 1,
    "name": "Démo · Cycle de renouvellement",
    "description": "Exemple fictif de cycle.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditCycle",
    "special": false
  },
  {
    "row": 2,
    "name": "Démo · Processus spécial",
    "description": "Exemple fictif de processus spécial.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": true
  },
  {
    "row": 3,
    "name": "Démo · Processus spécial B",
    "description": "Autre exemple fictif de processus spécial.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": true
  },
  {
    "row": 4,
    "name": "Démo · Processus à 3 auditeurs",
    "description": "Exemple fictif à trois auditeurs.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": false
  },
  {
    "row": 5,
    "name": "Démo · Processus à 2 auditeurs",
    "description": "Exemple fictif à deux auditeurs.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": false
  },
  {
    "row": 6,
    "name": "Démo · Processus complet",
    "description": "Exemple fictif de processus complet.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": false
  },
  {
    "row": 7,
    "name": "Démo · Processus simplifié",
    "description": "Exemple fictif de processus simplifié.",
    "active": true,
    "standardType": "SM",
    "certificationType": "Système de management",
    "kind": "AuditProcess",
    "special": false
  }
] as const;

export const workbookMatrixTaskExamples = [
  {
    "row": 1,
    "title": "Démo · Saisir une référence",
    "description": "Saisissez une référence fictive.",
    "type": "PV_DEMO",
    "active": true,
    "role": "Chargé commercial",
    "offset": -30,
    "fromStart": true
  },
  {
    "row": 2,
    "title": "Démo · Planifier une mission",
    "description": "Vérifiez les dates et la durée de la mission fictive.",
    "type": "SIMPLE",
    "active": true,
    "role": "Chargé Administratif",
    "offset": -29,
    "fromStart": true
  },
  {
    "row": 3,
    "title": "Démo · Accepter la mission 1",
    "description": "Confirmez la mission fictive du premier auditeur.",
    "type": "SIMPLE",
    "active": true,
    "role": "Responsable d'audit",
    "offset": -22,
    "fromStart": true
  },
  {
    "row": 4,
    "title": "Démo · Accepter la mission 2",
    "description": "Confirmez la mission fictive du deuxième auditeur.",
    "type": "SIMPLE",
    "active": true,
    "role": "Auditeur2",
    "offset": -21,
    "fromStart": true
  },
  {
    "row": 5,
    "title": "Démo · Accepter la mission 3",
    "description": "Confirmez la mission fictive du troisième auditeur.",
    "type": "SIMPLE",
    "active": true,
    "role": "Auditeur3",
    "offset": -21,
    "fromStart": true
  },
  {
    "row": 6,
    "title": "Démo · Fournir des documents",
    "description": "Ajoutez des documents de démonstration.",
    "type": "SIMPLE",
    "active": true,
    "role": "Correspondant d'audit",
    "offset": -18,
    "fromStart": true
  },
  {
    "row": 7,
    "title": "Démo · Identifier les processus",
    "description": "Renseignez les processus fictifs.",
    "type": "PROCESSUS_METIER",
    "active": true,
    "role": "Correspondant d'audit",
    "offset": -17,
    "fromStart": true
  },
  {
    "row": 8,
    "title": "Démo · Transmettre un planning",
    "description": "Ajoutez un planning de démonstration.",
    "type": "SIMPLE",
    "active": true,
    "role": "Responsable d'audit",
    "offset": -10,
    "fromStart": true
  },
  {
    "row": 9,
    "title": "Démo · Réaliser la mission",
    "description": "Réalisez la mission de démonstration.",
    "type": "AUDIT",
    "active": true,
    "role": "Responsable d'audit",
    "offset": 0,
    "fromStart": true
  },
  {
    "row": 10,
    "title": "Démo · Déposer les résultats",
    "description": "Ajoutez les résultats de démonstration.",
    "type": "SIMPLE",
    "active": true,
    "role": "Responsable d'audit",
    "offset": 1,
    "fromStart": false
  },
  {
    "row": 11,
    "title": "Démo · Fournir les preuves",
    "description": "Renseignez des preuves fictives.",
    "type": "ACTION_CORRECTIVE_PREUVE",
    "active": true,
    "role": "Correspondant d'audit",
    "offset": 30,
    "fromStart": false
  },
  {
    "row": 12,
    "title": "Démo · Vérifier les preuves",
    "description": "Vérifiez les preuves fictives.",
    "type": "CLOTURE_NON_CONFORMITY",
    "active": true,
    "role": "Responsable d'audit",
    "offset": 45,
    "fromStart": false
  }
] as const;
