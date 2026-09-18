# Structure du projet Wellsuited

> **Figure 9 du mémoire.** Arborescence réelle du dépôt, vérifiée contre le code.
> Remplace la figure actuelle du rapport (page 31), qui décrit des répertoires
> `eve/` et `lib/` qui n'existent pas sous cette forme.
>
> Fichiers générés, dépendances et artefacts de construction omis
> (`node_modules/`, `.next/`, `agent/generated/`).

---

```
cv-agent/
│
├── agent/                          AGENT + COUCHE DÉTERMINISTE
│   ├── agent.ts                    Orchestrateur — routeur, raisonnement « low »
│   ├── instructions.md             Règles strictes, déroulé imposé, confidentialité
│   ├── channels/eve.ts             Auth du canal : cookie de session signé
│   │
│   ├── tools/                      LE CATALOGUE — seule surface atteignable par le modèle
│   │   ├── get_profile.ts          Profil maître et vocabulaire autorisé
│   │   ├── analyze_jd.ts           Quota → analyse de l'offre → création de LA candidature
│   │   ├── write_cv.ts             Rédaction d'une langue, appel modèle logé dans l'outil
│   │   ├── compile_pdf.ts          Garde-fou → rendu PDF → ré-extraction du texte
│   │   ├── score_ats.ts            Scoring déterministe + décision d'arrêt
│   │   └── (8 outils génériques)   bash · fichiers · web · sous-agents → DÉSACTIVÉS
│   │
│   ├── hooks/                      Budget de compilation par tour · métrage des coûts
│   ├── skills/                     Règles de rédaction et de mise en forme ATS
│   │
│   └── lib/                        CE QUI DOIT ÊTRE GARANTI — fonctions pures, hors ligne
│       ├── guard.ts                Garde-fou anti-fabrication : faits vs vocabulaire
│       ├── asserted.ts             Criblage par plongement des termes exigés (seuil 0,20)
│       ├── ats.ts                  Moteur de scoring hybride + politique d'arrêt
│       ├── pdf.ts                  Rendu mono-colonne + ré-extraction
│       ├── cv-schema.ts            Schéma strict du CV · cv-dates.ts : dates du profil
│       ├── llm.ts                  Appels modèle logés dans les outils + métrage
│       ├── state.ts                État de session durable (compteurs, budgets)
│       ├── billing.ts              Quotas, droits versionnés, remboursement
│       ├── auth.ts                 Portée utilisateur résolue dans chaque outil
│       └── *.test.ts               5 fichiers de tests unitaires hors ligne
│
├── app/                            INTERFACE NEXT.JS 16 (App Router)
│   ├── (marketing)/                Accueil · tarifs (prix lus depuis Stripe)
│   ├── (auth)/                     Inscription · connexion · vérification d'adresse
│   ├── dashboard/
│   │   ├── page.tsx                Conversation — point d'entrée
│   │   ├── profile/                CV Builder : profil maître, import PDF/DOCX
│   │   ├── applications/[id]/      ESPACE DE TRAVAIL : document + rail à onglets
│   │   └── billing/ · settings/    Abonnement, portail Stripe, paramètres
│   └── api/                        auth · profile · applications · billing (webhook)
│
├── features/chat/                  Session agent, reprise sans perte, flux d'avancement
├── components/                     Aperçu CV, visionneuse PDF, tarifs, mur payant
│
├── lib/                            PARTAGÉ SERVEUR + INTERFACE — sans dépendance serveur
│   ├── entitlements.ts             DROITS D'USAGE : seule définition des quotas
│   └── cv-templates.ts             6 mises en page × 6 thèmes
│
├── prisma/
│   ├── schema.prisma               13 entités · @@unique(userId, sessionId, jdHash)
│   └── migrations/                 17 migrations versionnées
│
├── evals/                          Parcours complet de l'agent
│   └── safety/                     Injection via l'offre · divulgation du prompt · périmètre
│
└── scripts/verify-pipeline.ts      Chaîne déterministe rejouée SANS appel modèle ni réseau
```

*Figure 9 — Arborescence du projet Wellsuited.*

---

## Légende à faire figurer sous la figure

Trois frontières structurent le dépôt.

**`agent/tools/`** est la seule surface que le modèle peut atteindre, et elle est
fermée : cinq outils métier exposés, huit outils génériques explicitement
désactivés. Le modèle ne peut faire que ce qui y est déclaré.

**`agent/lib/`** contient tout ce qui doit être *garanti* — garde-fou, moteur de
scoring, rendu PDF — sous forme de fonctions pures, testables hors ligne et sans
appel réseau. C'est l'application du principe directeur du projet : ce qui doit
être garanti est écrit en code déterministe, jamais demandé au modèle.

**`lib/`** ne contient que ce qui doit être lu **à la fois** par le serveur et
par l'interface. `lib/entitlements.ts` est ainsi sans dépendance serveur : la
page de tarification imprime la valeur qui sert effectivement à autoriser ou
refuser l'action, et ne peut donc pas afficher un chiffre périmé.

---

## Chiffres vérifiés dans cette arborescence

| Élément | Valeur |
|---|---|
| Outils exposés au modèle | **5** (+ `ask_question` fourni par le framework) |
| Outils génériques désactivés | **8** |
| Entités Prisma | **13** |
| Migrations versionnées | **17** |
| Tests unitaires hors ligne | **5** fichiers |
| Évaluations de comportement | **1** parcours + **3** de sûreté |
| Mises en page × thèmes | **6 × 6** |
| Primitives d'interface | **22** (shadcn/ui sur Base UI) |
| Courriels transactionnels | **9** |

---

## Les trois couches, en une phrase chacune

1. **`app/` + `features/` + `components/`** — l'interface. Aucun appel modèle,
   aucune écriture directe en base : tout passe par une route API ou par le
   canal de l'agent.
2. **`agent/`** — le runtime agentique et la couche déterministe. L'orchestrateur
   décide de l'ordre des outils ; les outils font le travail et écrivent en base ;
   le garde-fou et le moteur de scoring vérifient sans jamais consulter le modèle.
3. **`prisma/`** — la persistance, et le lieu de certaines garanties que seul le
   moteur de base de données peut rendre, comme l'unicité
   `@@unique([userId, sessionId, jdHash])` qui ferme la course entre deux
   analyses simultanées.
