# Backoffice Althea Systems — Référence Frontend

> Document extrait du cahier des charges projet Bachelor CPI 2025-2026.  
> Cible : développeurs frontend chargés de l'interface d'administration.

---

## Accès et sécurité

- Réservé aux administrateurs avec droits appropriés
- Authentification forte obligatoire
- Authentification à deux facteurs (2FA) requise
- Backoffice disponible uniquement en anglais (simplifie la gestion admin)

---

## 1. Dashboard — Vue d'ensemble

### Cards indicateurs clés

Afficher 4 cards en haut de page :

| Card | Contenu | Alerte visuelle |
|------|---------|-----------------|
| Chiffre d'affaires | Valeur du jour / semaine / mois | — |
| Commandes | Nombre de commandes du jour | — |
| Ruptures de stock | Nombre de produits en rupture | Badge rouge si > 0 |
| Messages non traités | Nombre de messages en attente | Badge |

### Graphique camembert — Ventes par catégorie

- Type : graphique camembert (pie chart)
- Période par défaut : 7 derniers jours
- Période modifiable : jusqu'à 5 dernières semaines
- Données affichées : répartition en % du CA par catégorie
- Au survol d'une part : afficher le montant en €

### Actions rapides

Trois boutons d'accès direct visibles sur le dashboard :

- `Nouvelle commande`
- `Ajouter un produit`
- `Voir les messages`

---

## 2. Gestion des produits

### Tableau liste des produits

Colonnes à afficher :

| Colonne | Fonctionnalités |
|---------|----------------|
| Image (miniature) | — |
| Nom du produit | Tri + recherche |
| Description | — |
| Catégorie(s) | Tri + filtre liste déroulante |
| Prix HT (€) | Tri + filtre |
| TVA | Sélection : 20% / 10% / 5,5% / 0% |
| Prix TTC | Calculé automatiquement |
| Stock | Tri + filtre : disponible / rupture |
| Statut | Tri + filtre : publié / brouillon |
| Date de création | Tri + filtre |
| Quantité en stock | — |

### Fonctionnalités transversales du tableau

- Tri ascendant / descendant sur toutes les colonnes
- Recherche globale dans le tableau
- Pagination : 10 / 25 / 50 produits par page
- Export CSV / Excel
- Sélection multiple pour actions groupées
- Actions rapides par ligne (icônes) : **Voir** | **Éditer** | **Supprimer**

### Actions groupées sur la sélection

- Supprimer la sélection (avec confirmation modale)
- Modifier le statut : publier / dépublier
- Modifier la catégorie
- Exporter la sélection

### Pages produit dans le backoffice

#### a) Liste des produits
Tableau avec tri, filtre et recherche. Sélection multiple pour actions groupées.

#### b) Détail d'un produit
Page en lecture avec toutes les informations : nom, description, prix, quantité, catégorie, etc.

#### c) Créer un produit
Formulaire de création avec tous les champs :
- Nom
- Description
- Catégorie
- Prix HT + sélection TVA (TTC calculé automatiquement)
- Quantité en stock
- Statut : publié / brouillon
- Images : upload multiple en drag & drop (avec miniature)
- Réorganisation des images par glisser-déposer
- Définir l'image principale (marqueur `*`)
- Suppression individuelle d'une image
- URL personnalisée (slug SEO)

#### d) Modifier un produit
Même formulaire que la création, pré-rempli avec les données existantes.

#### e) Supprimer un produit
Confirmation obligatoire avant suppression.

---

## 3. Gestion du carrousel (page d'accueil)

Limité à 3 slides maximum.

Fonctionnalités frontend :

- Upload multiple d'images en drag & drop (affichage miniature)
- Réorganisation par glisser-déposer pour définir l'ordre d'affichage côté front
- Définir l'image principale (marqueur `*`)
- Suppression individuelle d'un slide
- Champ lien de redirection par slide
- Éditeur de texte avec formatage (gras, italique, liens, couleurs) affiché sous le carrousel

---

## 4. Tableau de bord des ventes

### Histogramme des ventes par jour

- Type : histogramme (bar chart)
- Période par défaut : 7 derniers jours
- Période modifiable : 5 dernières semaines (par semaine)
- Données : total des ventes par jour en €

### Histogramme multi-couches — Paniers moyens

- Type : histogramme multi-couches (stacked bar chart)
- Période par défaut : 7 derniers jours
- Période modifiable : 5 dernières semaines
- Données : total des ventes par catégorie en fonction des paniers moyens
- Permet de comparer les performances de chaque catégorie

---

## 5. Gestion des catégories

### Tableau liste des catégories

Vue tableau hiérarchique — colonnes :

| Colonne | Fonctionnalités |
|---------|----------------|
| Image (miniature) | — |
| Nom | Tri |
| Description | — |
| Nombre de produits | Tri |
| Ordre d'affichage | Tri |
| Statut | Active / Inactive |

### Actions disponibles

- Voir / Éditer / Supprimer
- Ajouter une catégorie via formulaire :
  - Nom
  - Description
  - Image
  - Statut
  - URL personnalisée (slug SEO)
- Réorganiser par drag & drop
- Activer / Désactiver les catégories sélectionnées

### Détail d'une catégorie

Page de consultation avec vue sur les produits associés et possibilité d'édition directe.

---

## 6. Gestion des utilisateurs

### Tableau liste des utilisateurs

Colonnes :

| Colonne | Fonctionnalités |
|---------|----------------|
| Nom complet | Tri + recherche |
| Email | Tri + recherche |
| Date d'inscription | Tri |
| Statut du compte | Tri + filtre : actif / inactif / en attente de validation |
| Nombre de commandes | — |
| CA total généré | — |
| Dernière connexion | — |
| Liste des adresses de facturation | — |

### Actions administratives par utilisateur

- Envoyer un mail
- Réinitialiser le mot de passe
- Désactiver le compte
- Supprimer le compte (avec avertissement RGPD obligatoire)

---

## 7. Gestion des commandes

### Tableau liste des commandes

Colonnes :

| Colonne | Fonctionnalités |
|---------|----------------|
| N° de commande | Tri + recherche |
| Date et heure | Tri |
| Client | Tri + recherche par nom / email |
| Montant TTC | Tri |
| Statut | Tri + filtre |
| Mode de paiement | Tri + filtre |
| Statut du paiement | Validé / En attente / Échoué |

### Statuts avec code couleur

| Statut | Couleur | Signification |
|--------|---------|---------------|
| En attente | Jaune | Commande créée, paiement en attente |
| En cours | Bleu | Paiement validé, traitement en cours |
| Terminée | Vert | Commande finalisée |
| Annulée | Rouge | Commande annulée |

### Détail d'une commande

- N° de commande
- Date et heure
- Statut actuel (modifiable directement depuis la page)
- Historique des changements de statut (avec date et utilisateur responsable)
- Informations de paiement :
  - Mode de paiement utilisé
  - Date du paiement
  - Statut : Validé / En attente / Échoué / Remboursé

---

## 8. Gestion des factures et avoirs

### Liste des factures

Colonnes :

| Colonne | Fonctionnalités |
|---------|----------------|
| N° de facture | Tri + recherche |
| Date d'émission | Tri + filtre |
| Client | Tri + recherche |
| N° de commande associée | Lien cliquable |
| Montant TTC | Tri |
| Statut | Tri + filtre : payée / en attente / annulée |

### Actions par facture

- Télécharger en PDF
- Renvoyer par email au client
- Modifier la facture (formulaire de modification)
- Supprimer la facture → génère automatiquement un avoir

### Liste des avoirs

Colonnes :

| Colonne | Fonctionnalités |
|---------|----------------|
| N° de l'avoir | Tri + recherche |
| Facture liée | Lien cliquable |
| Date d'émission | Tri + filtre |
| Client | Tri + filtre |
| Montant (négatif) | Tri |
| Motif | Annulation / Remboursement / Erreur |

### Actions par avoir

- Télécharger le PDF de l'avoir
- Envoyer par email

---

## 9. Gestion des messages et chatbot

- Les messages soumis via le formulaire de contact du front sont accessibles dans le backoffice
- Les conversations chatbot sont également enregistrées et consultables
- Si le chatbot escalade vers un humain, une notification est envoyée dans le backoffice
- Possibilité de suivre et traiter chaque demande depuis l'interface admin

---

## Charte graphique à respecter dans le backoffice

| Usage | Couleur |
|-------|---------|
| CTA, liens, badges | `#00a8b5` |
| Backgrounds | `#d4f4f7` |
| Hover states | `#33bfc9` |
| Titres, navigation, footer | `#003d5c` |
| Disponibilité (en stock) | `#10b981` |
| Erreurs | `#ef4444` |
| Alertes | `#F59E0B` |

**Typographie :**
- Titres : Poppins Semibold
- Corps : Inter Regular 400

**Statuts visuels produits :**
- En stock : badge vert `#10b981`
- Stock faible : badge orange `#F59E0B`
- Rupture : badge rouge `#ef4444`
- Nouveau : badge teal `#00a8b5`

---

## Livrables attendus côté backoffice

- Maquettes et prototypes de l'interface backoffice
- Repository GIT avec code propre et commits explicites
- Documentation technique (architecture, API Swagger/Postman, tests)
- Respect des principes SOLID et architecture modulaire
- Choix techniques : 1 framework frontend + 1 framework backend + 1 BDD NoSQL (images) + 1 BDD relationnelle (reste)
