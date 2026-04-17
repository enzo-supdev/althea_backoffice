# Audit de conformite - Checklist Backoffice Althea Systems

Date: 2026-04-15  
Perimetre: IHM Backoffice (Enzo)  
Source audit: checklist bo-01 a bo-64

## Resume executif

- Total points audites: 64
- Present: 60
- Partiel: 4
- Absent: 0
- Taux de couverture fonctionnelle estime: 94%

## Definition des statuts

- Present: fonctionnalite implementee et exploitable dans l interface.
- Partiel: fonctionnalite presente mais incomplete ou differente du besoin cible.
- Absent: fonctionnalite non trouvee dans le code audite.

## 1) Tableau de bord

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-01 | Card CA jour / semaine / mois | Present | Affiche dans les stats cards | src/components/dashboard/StatsCards.tsx |
| bo-02 | Card nombre commandes du jour | Present | Affiche dans les stats cards | src/components/dashboard/StatsCards.tsx |
| bo-03 | Card alertes rupture (badge rouge si >0) | Present | Badge explicite variant error affiche si alertes > 0 | src/components/dashboard/StatsCards.tsx |
| bo-04 | Card messages non traites (badge) | Present | Badge explicite variant error affiche si messages non traites > 0 | src/components/dashboard/StatsCards.tsx |
| bo-05 | Camembert ventes par categorie (7j / 5 sem) | Present | Selecteur periode 7j/5w | src/components/dashboard/SalesByCategoryChart.tsx |
| bo-06 | Montant EUR au survol du camembert | Present | Tooltip montant + pourcentage | src/components/dashboard/SalesByCategoryChart.tsx |
| bo-07 | Histogramme ventes par jour (7j / 5 sem) | Present | Graphique timeline avec selecteur periode | src/components/dashboard/SalesHistogram.tsx |
| bo-08 | Histogramme multi-couches paniers moyens par categorie | Present | Barres panier moyen + CA + quantite | src/components/dashboard/AverageBasketChart.tsx |
| bo-09 | Boutons rapides (nouvelle commande, ajouter produit, voir messages) | Present | 3 actions rapides presentes | src/components/dashboard/QuickActions.tsx |

## 2) Gestion des produits

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-10 | Tableau complet colonnes produits | Partiel | Colonnes majeures presentes; quantite distincte a confirmer (stock utilise) | src/app/(dashboard)/products/page.tsx |
| bo-11 | Tri par n importe quelle colonne | Partiel | Tri sur la plupart des colonnes metier, pas toutes colonnes techniques/actions | src/app/(dashboard)/products/page.tsx |
| bo-12 | Recherche globale | Present | Recherche multi-champs | src/app/(dashboard)/products/page.tsx |
| bo-13 | Filtres categorie, disponibilite, statut, date | Present | Filtres complets presents | src/app/(dashboard)/products/page.tsx |
| bo-14 | Pagination 25 / 50 / 10 | Present | Pagination configurable (10/25/50/100) | src/components/ui/Pagination.tsx |
| bo-15 | Actions rapides voir / editer / supprimer | Present | Actions ligne presentes | src/app/(dashboard)/products/page.tsx |
| bo-16 | Actions groupees suppression avec confirmation | Present | Modal de confirmation presente | src/app/(dashboard)/products/page.tsx |
| bo-17 | Actions groupees statut publier/depublier | Present | Bulk publish/draft present | src/app/(dashboard)/products/page.tsx |
| bo-18 | Actions groupees modifier categorie | Present | Bulk category update present | src/app/(dashboard)/products/page.tsx |
| bo-19 | Export CSV/Excel selection | Present | Export CSV + Excel present | src/app/(dashboard)/products/page.tsx |
| bo-20 | Formulaire creation produit | Present | Formulaire complet present | src/app/(dashboard)/products/new/page.tsx |
| bo-21 | Page modification produit | Present | Edition via page detail mode edit | src/app/(dashboard)/products/[id]/page.tsx |
| bo-22 | Page detail produit consultation | Present | Fiche detail complete | src/app/(dashboard)/products/[id]/page.tsx |
| bo-23 | Upload images drag and drop miniatures | Present | DnD + upload fichier + miniatures | src/components/ui/ProductImageManager.tsx |
| bo-24 | Reorganisation images drag and drop | Present | DnD de reordonnancement present | src/components/ui/ProductImageManager.tsx |
| bo-25 | Definir image principale | Present | Action setAsMain presente | src/components/ui/ProductImageManager.tsx |
| bo-26 | Suppression individuelle image | Present | Bouton suppression present | src/components/ui/ProductImageManager.tsx |
| bo-27 | Selection TVA 20/10/5.5/0 | Present | Select TVA conforme | src/app/(dashboard)/products/new/page.tsx |
| bo-28 | Prix TTC calcule automatiquement | Present | Calcul TTC live explicite en creation (priceHt + vatRate) | src/app/(dashboard)/products/new/page.tsx |
| bo-29 | URL personnalisee slug SEO | Present | Champ slug present en creation | src/app/(dashboard)/products/new/page.tsx |

## 3) Gestion du carrousel accueil

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-30 | 3 slides max | Present | Limite controlee | src/app/(dashboard)/settings/page.tsx |
| bo-31 | Upload images + lien de redirection | Present | URL + upload fichier + lien | src/app/(dashboard)/settings/page.tsx |
| bo-32 | Reorganisation drag and drop | Present | DnD slides present | src/app/(dashboard)/settings/page.tsx |
| bo-33 | Texte avec formatage | Present | Outils gras/italique/lien/couleur + zone editable | src/app/(dashboard)/settings/page.tsx |

## 4) Gestion des categories

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-34 | Vue tableau categories complete | Present | Colonnes attendues presentes | src/app/(dashboard)/categories/page.tsx |
| bo-35 | Tri par colonnes | Present | Tri actif sur colonnes | src/app/(dashboard)/categories/page.tsx |
| bo-36 | Formulaire ajout categorie complet | Present | Nom, description, image, statut, slug | src/app/(dashboard)/categories/page.tsx |
| bo-37 | Editer / supprimer categorie | Present | Actions ligne + modals | src/app/(dashboard)/categories/page.tsx |
| bo-38 | Reorganiser drag and drop | Present | DnD + move up/down | src/app/(dashboard)/categories/page.tsx |
| bo-39 | Activer / desactiver selection | Present | Bulk status update present | src/app/(dashboard)/categories/page.tsx |
| bo-40 | Detail categorie avec produits associes | Present | Page detail + listing produits lies | src/app/(dashboard)/categories/[id]/page.tsx |

## 5) Gestion des utilisateurs

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-41 | Vue tableau utilisateurs complete | Present | Nom, email, inscription, statut, commandes, CA, derniere connexion | src/app/(dashboard)/users/page.tsx |
| bo-42 | Tri + recherche + filtre statut | Present | Tri/recherche/filtres presents | src/app/(dashboard)/users/page.tsx |
| bo-43 | Detail adresses facturation + CA total | Present | Modal detail avec adresses + CA | src/app/(dashboard)/users/page.tsx |
| bo-44 | Action envoyer email | Present | mailto present | src/app/(dashboard)/users/page.tsx |
| bo-45 | Action reinitialiser mot de passe | Present | Action + confirmation presentes | src/app/(dashboard)/users/page.tsx |
| bo-46 | Action desactiver compte | Present | Bouton explicite Desactiver par ligne + action de masse | src/app/(dashboard)/users/page.tsx |
| bo-47 | Supprimer compte + avertissement RGPD | Present | Avertissement RGPD dans confirmation | src/app/(dashboard)/users/page.tsx |

## 6) Gestion des commandes

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-48 | Vue tableau commandes complete | Present | Colonnes attendues presentes | src/app/(dashboard)/orders/page.tsx |
| bo-49 | Tri + recherche + filtres statut/paiement | Present | Present et operationnel | src/app/(dashboard)/orders/page.tsx |
| bo-50 | Statuts commande code couleur | Partiel | Code couleur present; alignement exact palette a valider | src/app/(dashboard)/orders/page.tsx |
| bo-51 | Detail commande avec statut modifiable + historique + paiement | Present | Page dediee detail commande avec actions statut, paiement et timeline | src/app/(dashboard)/orders/[id]/page.tsx |
| bo-52 | Statuts paiement valides | Present | validated/pending/failed/refunded presents | src/app/(dashboard)/orders/page.tsx |

## 7) Gestion factures et avoirs

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-53 | Liste factures complete | Present | N, date, client, commande, montant, statut | src/app/(dashboard)/invoices/page.tsx |
| bo-54 | Telecharger PDF facture | Present | Generation/preview/download PDF present | src/app/(dashboard)/invoices/page.tsx |
| bo-55 | Renvoyer facture par email | Present | Action email presente | src/app/(dashboard)/invoices/page.tsx |
| bo-56 | Modifier facture (formulaire) | Present | Modal edition facture presente | src/app/(dashboard)/invoices/page.tsx |
| bo-57 | Supprimer facture vers avoir auto | Present | Suppression genere avoir simule | src/app/(dashboard)/invoices/page.tsx |
| bo-58 | Liste avoirs complete | Present | Onglet dedie + details | src/app/(dashboard)/invoices/page.tsx |
| bo-59 | Telecharger PDF avoir + envoi email | Present | Export avoir + email presents | src/app/(dashboard)/invoices/page.tsx |

## 8) Messages contact et chatbot

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-60 | Liste messages complete | Present | Email, sujet, date, statut | src/app/(dashboard)/messages/page.tsx |
| bo-61 | Consulter detail message | Present | Panneau detail avec historique | src/app/(dashboard)/messages/page.tsx |
| bo-62 | Historique conversations chatbot | Present | Historique chatbot present | src/app/(dashboard)/messages/page.tsx |

## 9) Acces et securite backoffice

| ID | Exigence | Statut | Commentaire | Preuve principale |
|---|---|---|---|---|
| bo-63 | Acces reserve administrateurs | Present | Controle role admin + redirection login | src/app/(dashboard)/layout.tsx |
| bo-64 | Authentification forte 2FA | Partiel | Flux 2FA connecte a des endpoints backend; niveau "fort" (hardening serveur) non verifiable dans ce perimetre IHM | src/components/auth/LoginForm.tsx |

## Points de vigilance techniques

1. 2FA
- Le front est desormais branche sur un flux serveur (/auth/2fa/*). La robustesse "authentification forte" depend du backend (secret, politique OTP, anti brute force, journalisation), non auditable ici.

2. Detail commande
- Le besoin est couvert via une page dediee /orders/[id] avec edition de statut, gestion paiement et timeline.

3. Conformite UX strictement demandee
- Certains besoins mentionnent explicitement un badge rouge (bo-03, bo-04) et un mapping couleur precise (bo-50); comportement proche, mais a verrouiller strictement.

## Plan de remediations recommande (court terme)

- P1: Durcir bo-64 avec veritable 2FA backend (TOTP/HOTP, seed securise, validation serveur).
- P2: Uniformiser tri sur toutes les colonnes metier produits si attendu strict.
- P2: Valider et documenter le mapping couleur statuts commande (bo-50) contre la charte attendue.
- P2: Confirmer l interpretation "tri sur n importe quelle colonne" pour bo-11 (incluant ou non colonnes techniques/actions).
- P2: Clarifier bo-10 sur la distinction "quantite" vs "stock" si une colonne dediee est obligatoire.

## Conclusion

Le backoffice est globalement mature et couvre l essentiel de la checklist.  
Les ecarts restants sont limites a des points de conformite stricte (tri/couleurs/colonnes) et a la validation de la robustesse 2FA cote backend.