# Cahier des Charges - Projet E-commerce Althea Systems
## Bachelor CPI Développement 2025-2026

---

## 📋 Table des matières

1. [Introduction](#introduction)
2. [Sitemap](#sitemap)
3. [Layout](#layout)
4. [Charte Graphique](#charte-graphique)
5. [Pages Frontend](#pages-frontend)
6. [Gestion des Utilisateurs](#gestion-des-utilisateurs)
7. [Backoffice](#backoffice)
8. [Fonctionnalités Complémentaires](#fonctionnalités-complémentaires)
9. [Livrables Techniques](#livrables-techniques)

---

## 🎯 Introduction

### Contexte

**Althea Systems** est une entreprise spécialisée dans la vente de matériel médical de pointe pour cabinets médicaux. Jusqu'à présent commercialisés via réseau de distribution et équipes commerciales, l'entreprise souhaite se lancer dans l'ère du numérique.

### Objectif du Projet

Développer une **plateforme e-commerce innovante mobile-first** avec :
- Site e-commerce responsive (desktop + mobile)
- Backoffice web complet
- Système de paiement sécurisé
- Solution évolutive et scalable

### Site Existant à Refondre

https://www.althea-group.com/fr/

### Principaux Défis

1. **Sécurité** : Plateforme sécurisée avec solutions de paiement robustes
2. **UX fluide** : Expérience optimale desktop & mobile
3. **Backoffice complet** : Gestion produits, commandes, facturation
4. **Scalabilité** : Architecture maintenable pour intégrations futures

---

## 🗺️ Sitemap

### Structure Organisationnelle

Le site se divise en **3 grandes catégories** :

#### 1. Pages Principales
- Accueil
- Catégories
- Recherche
- Produits
- Contact
- ChatBot

#### 2. Pages de Commande
- Panier
- Checkout
- Confirmation

#### 3. Pages Compte Utilisateur
- Mon compte
  - Paramètres
  - Mes commandes
- Créer un compte
- Se connecter / Se déconnecter
  - Mot de passe oublié

### Flux de Navigation

| Catégorie | Page | Sous-pages/Actions |
|-----------|------|-------------------|
| **Pages principales** | Accueil | - |
| | Catégories | → Produit |
| | Recherche | - |
| | Chatbot | - |
| **Pages de commande** | Panier | - |
| | Checkout | - |
| | Confirmation | - |
| **Pages compte** | Mon compte | Paramètres, Mes commandes |
| | Créer un compte | - |
| | Se connecter | Mot de passe oublié |

---

## 📐 Layout

### Structure Commune

| Élément | Description |
|---------|-------------|
| **En-tête** | Visible sur toutes les pages |
| • Logo | Logo entreprise (gauche) |
| • Barre de recherche | Recherche rapide produits |
| • Panier | Bouton avec indicateur (point) si articles |
| • Menu navigation | Menu principal (Accueil, Catégories, etc.) |
| **Zone de contenu** | Zone principale avec produits/informations/formulaires |
| **Pied de page (Desktop)** | Visible uniquement desktop (mobile = menu en-tête) |
| • CGU | Conditions Générales d'Utilisation |
| • Mentions légales | Page mentions légales |
| • Contact | Page de contact |
| • Réseaux sociaux | Liens profils sociaux (Facebook, Twitter, LinkedIn) |

---

## 🎨 Charte Graphique

### Couleurs Principales

#### Couleurs Fonctionnelles
- **CTA, liens, badges** : `#00a8b5` (Turquoise)
- **Hover states** : `#33bfc9` (Turquoise clair)
- **Backgrounds** : `#d4f4f7` (Bleu très clair)
- **Titres, navigation, footer** : `#003d5c` (Bleu foncé)

#### Couleurs de Statuts
- **Disponibilité** : `#10b981` (Vert) → ✓ En stock
- **Alerte** : `#F59E0B` (Orange) → ⚠ Stock Faible
- **Erreurs** : `#ef4444` (Rouge) → Rupture
- **Nouveau** : Badge "Nouveau"

### Typographie

- **Titres** : Poppins Semibold
- **Corps** : Inter Regular 400

### Logos

Deux versions à prévoir :
- Version Mobile
- Version Desktop

---

## 🌐 Pages Frontend

### 1. Page d'Accueil

#### Carrousel (3 sections)
- Images et liens promotionnels
- **Modifiable via backoffice** :
  - Modifier images et textes
  - Changer l'ordre des sections
  - Ajouter/supprimer des sections

#### Texte Fixe
- Sous le carrousel
- **Modifiable via backoffice**

#### Grille de Catégories
- Liens visuels vers catégories produits
- **Personnalisable via backoffice** :
  - Images et noms de catégories
  - Ordre d'affichage modifiable

#### Top Produits du Moment
- Section avec titre "Les Top Produits du moment"
- Grille de produits vedettes
- **Sélection et ordre via backoffice**
- Format : Image + Nom du produit

#### Pied de Page (Desktop uniquement)
- Mentions légales, CGU, Contact, réseaux sociaux
- Sur mobile : accessible via menu en-tête

---

### 2. Page Catalogue de Produits

#### Image Principale
- Image de catégorie (depuis grille accueil)
- Surimpression avec nom de catégorie
- Description de la catégorie sous l'image

#### Affichage des Produits

**Mobile** : Liste verticale  
**Desktop** : Grille

#### Informations par Produit
- Nom du produit
- Prix (visible sous le nom)
- Indisponibilité : "En rupture de stock" (couleur différente/grisé)

#### Tri des Produits
1. **Produits prioritaires** (définis via backoffice)
2. **Produits disponibles** (non priorisés)
3. **Produits épuisés** (toujours en dernier)

---

### 3. Page Produit

#### Éléments Principaux

1. **Carrousel d'illustrations**
   - Photographies et vues multiples du produit

2. **Nom du produit**
   - Grand et en gras

3. **Description du produit**
   - Fonctionnalités principales complètes

4. **Caractéristiques techniques**
   - Section dédiée aux spécifications

5. **Prix**
   - Bien visible

6. **Disponibilité**
   - "Rupture de Stock" si indisponible

7. **Produits similaires**
   - Liste de 6 produits similaires (même catégorie)
   - Tirés aléatoirement
   - Priorité : produits disponibles

#### Call-to-Action (CTA)

- **Disponible** : Bouton "Ajouter au panier" / "Acheter maintenant"
- **Rupture** : Bouton désactivé avec "En rupture de stock"

---

### 4. Page de Recherche

#### Facettes de Recherche

1. **Texte du titre**
   - Recherche par nom/titre du produit
   - Règles de priorité (voir ci-dessous)

2. **Texte de la description**
   - Recherche dans descriptions produits

3. **Caractéristiques techniques**
   - Filtrage par caractéristiques spécifiques

4. **Prix minimum et maximum**
   - Définir un intervalle de prix

5. **Catégorie(s)**
   - Filtrer par type de produit

6. **Uniquement produits disponibles**
   - Masquer les produits non disponibles

#### Règles de Correspondance (pour texte)

**Priorité de résultats** :
1. Correspondance exacte
2. Un caractère de différent
3. Commence par
4. Contient

#### Tri des Résultats

Options de tri (ascendant/descendant) :
1. **Prix** : Du plus bas au plus élevé (ou inverse)
2. **Nouveauté** : Date d'ajout/mise à jour
3. **Disponibilité** : Disponibles en premier

#### Performance

**Exigence critique** : Résultats en **< 100 ms**
- Même après modifications backoffice
- Mise à jour temps réel

---

### 5. Page du Panier

#### Accessibilité
- **Accessible à tous** (connectés ou non)

#### Fonctionnalités

1. **Liste des produits ajoutés**
   - Nom du produit
   - Quantité (modifiable)
   - Prix unitaire
   - Prix total (calculé)
   - Option : Supprimer produit

2. **Total à payer**
   - Calcul temps réel
   - Inclut taxes et promotions
   - Mise à jour automatique

3. **Produits indisponibles**
   - Marqués "Indisponible"
   - Total ajusté
   - Possibilité de retirer/remplacer

4. **CTA "Passer à la caisse"**
   - Rappel connexion si non connecté
   - Option "continuer comme invité"
   - Bloqué si produit indisponible

---

### 6. Étapes du Checkout

#### Étape 1 : Connexion/Inscription
- **Connexion** : Se connecter au compte existant
- **Inscription** : Créer un compte rapidement
- **Option** : Continuer en tant qu'invité

#### Étape 2 : Adresse de Facturation/Livraison

**Champs requis** :
- Prénom
- Nom
- Adresse 1 (rue, numéro)
- Adresse 2 (optionnel)
- Ville
- Région
- Code postal
- Pays
- Téléphone mobile

**Options** :
- Entrer nouvelle adresse
- Choisir adresse enregistrée

#### Étape 3 : Informations de Paiement

**Champs requis** :
- Nom sur la carte
- Numéro de carte (16 chiffres)
- Date d'expiration (mois/année)
- CVV (3 chiffres)

**Options** :
- Entrer nouvelle carte
- Choisir carte enregistrée

**Sécurité** : Stripe ou PayPal

#### Étape 4 : Page de Confirmation

**Récapitulatif** :
- Produits achetés + prix + taxes
- Adresse de facturation
- Informations de paiement

**CTA** : "Confirmer l'achat"
- Transaction traitée
- Email de confirmation envoyé

#### Fonctionnalités Supplémentaires
- Possibilité de **modifier la facture**
- **Avoir automatique** si facture supprimée
- **Génération PDF** de la facture (impression/stockage)

---

## 👥 Gestion des Utilisateurs

### 1. Inscription

#### Formulaire d'Inscription

**Champs requis** :
- Nom complet (prénom + nom)
- Adresse e-mail valide
- Mot de passe (conforme CNIL et RGPD)

#### Validation
- Vérification format email
- Validation mot de passe (critères sécurité)
- Messages d'erreur clairs

#### Confirmation par Email
- Email automatique avec lien validation
- Lien unique et sécurisé (valide 24h)
- Accès limité avant confirmation
- Connexion automatique après validation

#### Sécurité
- Chiffrement données
- Validation côté client ET serveur
- Règles de force du mot de passe

---

### 2. Connexion

#### Accès Réservé
- **Uniquement utilisateurs validés** (email confirmé)

#### Formulaire de Connexion
- Adresse e-mail
- Mot de passe

#### Gestion des Erreurs

1. **Mot de passe/identifiant incorrect**
   - Message d'erreur
   - Lien "Mot de passe oublié"

2. **Utilisateur non confirmé**
   - Message : Vérifier email
   - Option contact support

#### Redirection Pages Privées
- Redirection auto vers page de connexion
- Retour sur page initiale après connexion

#### Option "Se souvenir de moi"
- Sauvegarder la session
- Évite reconnexion à chaque visite

#### Mot de Passe Oublié
- Lien sur page de connexion
- Email avec lien réinitialisation sécurisé
- Lien valide 24h

---

### 3. Modification du Compte

#### 1. Informations Personnelles

**Modifiables** :
- **Nom complet** (pour personnalisation emails)
- **Adresse e-mail** (+ email de validation)
- **Mot de passe** (demande ancien mot de passe)

#### 2. Consultation des Achats
- Liste des achats effectués
- Option renouveler achat
- Affichage commandes : En cours / Supprimées / Terminées

#### 3. Carnet d'Adresses

**Actions** :
- **Ajouter** nouvelle adresse
- **Modifier** adresse existante
- **Supprimer** adresse

**Champs** : Prénom, Nom, Adresse 1, Adresse 2 (opt.), Ville, Région, Code postal, Pays, Téléphone

#### 4. Méthodes de Paiement

**Actions** :
- **Ajouter** nouvelle carte
- **Supprimer** carte
- **Définir carte par défaut**

**Champs** : Nom sur carte, Numéro carte, Expiration, CVV

#### Sécurité
- Validation par email (changements email)
- Demande mot de passe actuel (modifications sensibles)
- Cryptage informations bancaires (PCI-DSS)

---

### 4. Historique des Commandes

#### Affichage
- **Groupé par année**
- **Ordre chronologique** (récent → ancien)

#### Informations par Commande
- Nom du produit
- Date de commande
- Montant total
- Statut (terminée, active, renouvelée)

#### Détail d'une Commande
- Produit commandé
- Mode de paiement (4 derniers chiffres)
- Adresse de facturation
- **Téléchargement facture PDF**

#### Filtres et Recherche
- **Filtre par année**
- **Filtre par type de produit**
- **Filtre par statut** (active/résiliée)
- **Barre de recherche** (nom produit / date)

---

## 🛠️ Page Outils - Contact & Chatbot

### Formulaire de Contact

#### Champs
- **Adresse e-mail** (obligatoire)
- **Sujet du message**
- **Texte du message**

#### Fonctionnement
- Validation champs obligatoires
- Confirmation visuelle après envoi
- Messages accessibles dans backoffice

### Chatbot "Contact Me"

#### Fonctionnalités

1. **Réponses instantanées**
   - Questions fréquentes (FAQ)
   - Assistance technique de base
   - Guide fonctionnalités du site

2. **Escalade vers humain**
   - Si question complexe
   - Transfert vers support
   - Notification équipe via backoffice

3. **Capture d'informations**
   - Email utilisateur
   - Sujet de la question

4. **Intégration Backoffice**
   - Conversations enregistrées
   - Suivi par équipe support
   - Lien vers formulaire contact détaillé

---

## 🖥️ Backoffice

### Accès et Sécurité

- **Réservé aux administrateurs** uniquement
- **Authentification forte** (2FA recommandé)
- Autorisations appropriées

---

### 1. Tableau de Bord

#### Indicateurs Clés (Cards)

- **Chiffre d'affaires** : Jour / Semaine / Mois
- **Nombre de commandes du jour**
- **Alertes stock** : Badge rouge si ruptures (>0)
- **Messages non traités** : Badge notification

#### Graphique Camembert

**Ventes par Catégorie** :
- Période : 7 derniers jours (modifiable : 5 dernières semaines)
- Données : Répartition % du CA par catégorie
- Affichage : Montant € au survol

#### Actions Rapides

Boutons d'accès direct :
- "Nouvelle commande"
- "Ajouter un produit"
- "Voir les messages"

#### Histogramme des Ventes

**Par jour** :
- Total ventes sur 7 derniers jours
- Modifiable : 5 dernières semaines
- Visualisation des pics d'activité

**Paniers moyens (multi-couches)** :
- Total ventes par catégories
- Période : 7 derniers jours (ou 5 semaines)
- Comparaison performances catégories

---

### 2. Gestion des Produits

#### Liste des Produits (Vue Tableau)

**Colonnes** :
- Image (miniature)
- Nom du produit (tri, recherche)
- Description
- Catégorie(s) (tri, filtre liste déroulante)
- Prix HT (tri, filtre)
- TVA (sélection : 20%, 10%, 5.5%, 0%)
- Prix TTC (calcul automatique)
- Stock (tri, filtre : disponibilité/rupture)
- Statut (tri, filtre : publié/brouillon)
- Date de création (tri, filtre)
- Quantité en stock

#### Actions Groupées
- **Supprimer** sélection (avec confirmation)
- **Modifier statut** (publier/dépublier)
- **Modifier catégorie**
- **Export** de la sélection

#### Actions par Produit
- **Lister** les produits (tri, filtre, recherche)
- **Voir détails** (page complète)
- **Créer** nouveau produit (formulaire)
- **Modifier** produit précis
- **Supprimer** produit (avec confirmation)

#### Fonctionnalités Transversales
- **Tri** par n'importe quelle colonne (↑↓)
- **Recherche globale** dans le tableau
- **Pagination** (25/50/100 produits par page)
- **Export** CSV/Excel
- **Actions rapides** : Icônes (voir, éditer, supprimer)

#### Gestion Images (Carrousel Accueil)

**Max 3 slides** :
- Upload multiple (drag & drop)
- Réorganisation (glisser-déposer)
- Définir image principale (*)
- Suppression individuelle
- Lien de redirection
- Texte formaté (gras, italique, liens, couleurs)

#### Paramètres Avancés
- URL personnalisée (slug SEO)

---

### 3. Gestion des Catégories

#### Liste des Catégories (Tableau Hiérarchique)

**Colonnes** :
- Image (miniature)
- Nom (tri)
- Description
- Nombre de produits (tri)
- Ordre d'affichage (tri)
- Statut (Active/Inactive)

#### Actions
- **Voir, Éditer, Supprimer**
- **Ajouter catégorie** (formulaire : nom, description, image, statut, URL slug)
- **Réorganiser** par drag & drop
- **Activer/Désactiver** catégories sélectionnées

#### Détail d'une Catégorie
- Page de consultation
- Vue produits associés
- Possibilité d'édition

---

### 4. Gestion des Utilisateurs

#### Liste des Utilisateurs (Vue Tableau)

**Colonnes** :
- Nom complet (tri, recherche)
- Email (tri, recherche)
- Date d'inscription (tri)
- Statut compte (tri, filtre : actif/inactif/en attente validation)
- Nombre de commandes
- CA total généré
- Dernière connexion
- Liste adresses de facturation

#### Actions Administratives
- **Envoyer un mail**
- **Réinitialiser mot de passe**
- **Désactiver compte**
- **Supprimer compte** (avec avertissement RGPD)

---

### 5. Gestion des Commandes

#### Liste des Commandes (Vue Tableau)

**Colonnes** :
- N° de commande (tri, recherche)
- Date et heure (tri)
- Client (tri, recherche par nom/email)
- Montant TTC (tri)
- Statut (tri, filtre)
- Mode de paiement (tri, filtre)
- Statut du paiement (validé/en attente/échoué)

#### Statuts avec Code Couleur

- **En attente** : Commande créée, paiement en attente
- **En cours** : Paiement validé, traitement en cours
- **Terminée** : Commande finalisée
- **Annulée** : Commande annulée

#### Détail d'une Commande

**Informations** :
- N° de commande
- Date et heure
- Statut actuel (modifiable)
- Historique changements de statut (date + utilisateur)

**Informations de Paiement** :
- Mode de paiement utilisé
- Date du paiement
- Statut : Validé / En attente / Échoué / Remboursé

---

### 6. Gestion des Factures

#### Gestion d'une Facture

**Actions** :
- N° facture (généré automatiquement à validation paiement)
- **Télécharger** facture PDF
- **Renvoyer** facture par mail au client
- **Modifier** facture (formulaire)
- **Supprimer** facture → **Génère automatiquement un avoir**

#### Liste des Factures

**Colonnes** :
- N° de facture (tri, recherche)
- Date d'émission (tri, filtre)
- Client (tri, recherche)
- N° de commande associée (lien cliquable)
- Montant TTC (tri)
- Statut (tri, filtre : payée/en attente/annulée)

#### Liste des Avoirs

**Colonnes** :
- N° de l'avoir (tri, recherche)
- Facture liée (lien cliquable)
- Date d'émission (tri, filtre)
- Client (tri, filtre)
- Montant (négatif) (tri)
- Motif (annulation, remboursement, erreur)

**Actions** :
- **Télécharger** PDF de l'avoir
- **Envoyer** par email

---

## ⚙️ Fonctionnalités Complémentaires

### Pagination

**Exigences** :
- Toutes listes produits (mobile + desktop)
- Navigation fluide et rapide
- Navigation par lots (précédent/suivant)
- Accès direct à une page précise

---

### Menu Burger

#### Version Connectée
- Mes paramètres
- Mes commandes
- CGU
- Mentions légales
- Contact
- À propos de Althea Systems
- **Se déconnecter**

#### Version Non Connectée
- **Se connecter**
- **S'inscrire**
- CGU
- Mentions légales
- Contact
- À propos de Althea Systems

**Responsive** : Adapté mobile et desktop

---

### i18n (Internationalisation)

**Exigences** :
- Site **multilingue**
- Support langues de droite à gauche (arabe, hébreu)
- Bouton sélection langue dans menu
- **Backoffice** : Anglais uniquement (simplifié)

---

### a11y (Accessibilité)

**Normes** : Conformité WCAG 2.1

**Exigences** :
- Éléments interactifs (boutons, formulaires, menus) utilisables avec :
  - Lecteurs d'écran
  - Navigation clavier
- **Contrastes optimisés** pour personnes malvoyantes
- Technologies d'assistance supportées

---

### Sécurité

**Priorité maximale** : Normes les plus strictes

#### Mesures Obligatoires

1. **Chiffrement des données**
   - Données utilisateur (surtout paiement)
   - Conformité PCI-DSS

2. **Gestion des sessions**
   - Authentification sécurisée
   - Autorisation stricte

3. **Protection contre failles**
   - Injection SQL
   - Attaques XSS
   - Attaques CSRF

4. **Certificats SSL**
   - Sécurisation communications

5. **Tests de sécurité**
   - Réguliers avant livraison
   - Tests après livraison

---

## 🛠️ Choix Techniques

### Stack Technologique Requis

**Contraintes imposées** :
- **1 framework Frontend**
- **1 framework Backend**
- **1 base de données NoSQL** (stockage images)
- **1 base de données relationnelle** (reste des données)

### Validation Requise

Les piles technologiques choisies (frameworks, bibliothèques, langages) doivent être **validées** pour garantir :
- Compatibilité avec infrastructure existante
- Performances attendues
- **Maintenabilité**
- **Scalabilité**
- **Sécurité**

---

## 📦 Livrables Techniques

### 1. Repository GIT

**Structure** :
- Repository pour site web (desktop + mobile)
- Repository pour backoffice
- Suivi de version détaillé
- Traçabilité des modifications

**Exigences commits** :
- Descriptions claires
- Faciliter revues de code
- Cohérence du projet

**Qualité** :
- Code testé
- **Aucun bug avant livraison finale**

---

### 2. Code Propre et Architecturé

**Standards** :
- Nomenclature claire (variables, fonctions, composants)
- Architecture modulaire
- Maintenabilité long terme
- Extensibilité
- Respect principes **SOLID**
- Bonnes pratiques de conception

**Documentation** :
- Code documenté adéquatement
- Compréhension facile des choix de conception

---

### 3. Documentation Technique Complète

#### 3.1 Guide d'Installation

**Contenu** :
- Liste dépendances nécessaires
- Instructions configuration environnement (dev, déploiement, production)
- Étapes détaillées installation et déploiement
- Procédures pour site web et application mobile

#### 3.2 Documentation des API

**Contenu** :
- Tous endpoints API documentés
- Méthodes HTTP
- Paramètres attendus
- Réponses possibles
- **Outil recommandé** : Swagger ou Postman

#### 3.3 Structure du Code

**Contenu** :
- Explication architecture du code
- Organisation des composants
- Interactions entre modules
- Description composants, services, systèmes (backend, frontend, API)
- Justification choix technologiques (frameworks, bibliothèques, outils)

#### 3.4 Tests

**Contenu** :
- Instructions tests unitaires
- Instructions tests d'intégration
- Instructions tests fonctionnels
- Mise en place tests automatisés
- **Frameworks** : Jest, Mocha ou similaires

---

### 4. Document de Conception Technique (DCT)

#### 4.1 Architecture du Système

**Vue d'ensemble infrastructure** :
- Interactions frontend ↔ backend
- Interactions avec bases de données
- Services API
- Systèmes d'authentification

#### 4.2 Diagrammes Techniques

**Obligatoires** :
1. **Diagramme d'architecture globale**
   - Structure composants principaux (site web, app mobile, backoffice)

2. **Diagramme de flux de données**
   - Traitement et circulation des données entre systèmes

3. **Diagramme de communication des services**
   - API, interactions front-back

#### 4.3 Choix Technologiques

**Justification** :
- Objectifs de performance
- Objectifs de scalabilité
- Objectifs de sécurité

#### 4.4 Plan de Sécurité (BONUS)

**Contenu** :
- Mesures de sécurité mises en place
- Chiffrement données sensibles
- Gestion sessions utilisateur
- Protection contre menaces (XSS, CSRF, etc.)
- **Conformité RGPD** pour protection données personnelles

#### 4.5 Plan de Maintenance et Évolutivité

**Contenu** :
- Recommandations maintenance continue
- Gestion mises à jour
- Correctifs de sécurité
- Stratégies de scalabilité
- Extension infrastructure pour augmentation utilisateurs

---

### 5. Suivi de l'Évolution

**Exigences** :
- Étapes développement visibles via GIT
- Accessibilité tout au long du processus
- Documentation de chaque sprint
- Rapports de progression
- Mises à jour régulières
- Revues de code (transparence développement)

---

### 6. Maquettage et Prototypes

**Requis** :
- **Maquettes Front Office** (site web)
- **Maquettes Back Office** (administration)

---

## 📊 Résumé des Exigences Critiques

### Performance
- Recherche : **< 100 ms**
- Navigation fluide mobile et desktop
- Scalabilité garantie

### Sécurité
- Conformité RGPD et CNIL
- Chiffrement données sensibles
- Authentification forte (2FA)
- Protection contre failles courantes

### UX/UI
- **Mobile-first**
- Accessibilité WCAG 2.1
- i18n (multilingue)
- Design system cohérent (charte graphique)

### Technique
- Code propre et architecturé (SOLID)
- Tests automatisés complets
- Documentation exhaustive
- GIT avec commits clairs

---

## 🎯 Points d'Attention Particuliers

1. **Backoffice** : Interface intuitive pour non-techniques
2. **Chatbot** : Intégration fluide avec système de support
3. **Factures/Avoirs** : Génération automatique et traçabilité complète
4. **Stock** : Gestion temps réel et alertes automatiques
5. **Paiement** : Sécurité maximale (PCI-DSS)
6. **SEO** : URLs personnalisées (slugs)
7. **Analytics** : Tableaux de bord avec données pertinentes

---

**Document généré pour contexte IA - Projet Althea Systems 2025-2026**
