# 🎵 Web Sampler

Un sampler audio interactif développé en JavaScript vanilla avec Web Audio API.

**Projet réalisé dans le cadre du cours de Développement Web - Master 1**

🔗 **Démo Sampler** : [https://web-sampler-frontend.onrender.com](https://web-sampler-frontend.onrender.com)  
🔗 **Admin Panel Angular** : [https://web-sampler-1.onrender.com](https://web-sampler-1.onrender.com)  
🔗 **API Backend** : [https://web-sampler.onrender.com](https://web-sampler.onrender.com)

---

## 👥 Équipe

| Membre | Contributions |
|--------|---------------|
| **Tamani Ahmed** | Frontend Sampler, AudioEngine, Web Audio API, Effets audio, Web Component, Intégration API |
| **Benabdelkader Marouane** | Backend Node.js/Express, Base de données MongoDB, Admin Panel Angular, Déploiement Render |

---

## 🚀 Fonctionnalités Implémentées

### ✅ Fonctionnalités Obligatoires

| Fonctionnalité | Description |
|----------------|-------------|
| **Séparation GUI / Engine** | `SamplerGUI.js` gère l'interface, `AudioEngine.js` gère l'audio (Web Audio API) |
| **Mode Headless** | L'AudioEngine peut fonctionner sans interface graphique |
| **Presets dynamiques** | Chargement des presets depuis une API REST (MongoDB) |
| **Barre de progression** | Animation de chargement pour chaque pad avec pourcentage |
| **Waveform** | Visualisation de la forme d'onde avec Canvas |
| **Trimming** | Sélection Start/End pour découper les samples |
| **Contrôle clavier** | Touches 1-9 mappées aux pads |
| **Support MIDI** | Détection automatique des contrôleurs MIDI |
| **Enregistrement** | Export de la session en WAV via MediaRecorder |

### ⭐ Fonctionnalités Optionnelles

| Fonctionnalité | Description |
|----------------|-------------|
| **Filtre par catégorie** | Dropdown pour filtrer les presets (Drums, Percussion, Piano, etc.) |
| **Effets audio** | Volume (0-150%), Pan (L/R), Pitch (0.5x-2x) par pad |
| **Sauvegarder preset** | Export du preset actuel avec conversion en WAV |
| **Web Component** | Composant `<sampler-pad>` encapsulé avec Shadow DOM |
| **Déploiement Cloud** | Backend et Frontend hébergés sur Render.com |

---

## 🛠️ Technologies Utilisées

### Frontend (Sampler)
- **JavaScript ES6+** (Vanilla JS, pas de framework)
- **Web Audio API** (AudioContext, GainNode, StereoPannerNode)
- **Web Components** (Custom Elements, Shadow DOM)
- **Canvas API** (Waveform visualization)
- **Web MIDI API** (Contrôleurs MIDI)
- **MediaRecorder API** (Enregistrement audio)

### Backend (API)
- **Node.js** + **Express.js**
- **MongoDB Atlas** (Base de données cloud)
- **Mongoose** (ODM)
- **Multer** (Upload de fichiers audio)
- **CORS** (Cross-Origin Resource Sharing)

### Admin Panel
- **Angular 18+** (Standalone Components)
- **TypeScript**

### Déploiement
- **Render.com** (Backend API + Static Site)
- **GitHub** (Version control)

---

## 📦 Installation Locale

### Prérequis
- Node.js 18+
- npm ou yarn
- MongoDB (local ou Atlas)

### 1. Cloner le projet
```bash
git clone https://github.com/Ahmedtamani/web-sampler.git
cd web-sampler
```

### 2. Installer le Backend
```bash
cd server
npm install
```

Créer un fichier `.env` :
```env
MONGO_URL=mongodb+srv://votre_url_mongodb
PORT=3000
```

Lancer le serveur :
```bash
npm start
```

### 3. Lancer le Sampler
Ouvrir `sampler/index.html` dans un navigateur (ou utiliser Live Server).

### 4. Admin Panel (optionnel)
```bash
cd admin-panel
npm install
npm start
```
Accéder à `http://localhost:4200`

---

## 🎮 Utilisation

### Contrôles
| Touche | Action |
|--------|--------|
| `1-9` | Jouer les pads |
| `R` | Démarrer/Arrêter l'enregistrement |
| `Espace` | Pause/Resume |

### Interface
1. **Sélectionner un preset** dans le dropdown
2. **Attendre le chargement** (barres de progression)
3. **Cliquer sur les pads** ou utiliser le clavier
4. **Ajuster les effets** (Volume, Pan, Pitch) par pad
5. **Enregistrer** votre session en WAV

---

## 🤖 Utilisation de l'IA

Ce projet a été développé avec l'assistance de **GitHub Copilot** :

### Comment l'IA a été utilisée :

1. **Génération de code boilerplate**
   - Structure initiale des classes (AudioEngine, SamplerGUI)
   - Configuration Express/MongoDB

2. **Debugging et résolution de problèmes**
   - Correction des erreurs CORS
   - Fix des problèmes de chargement audio
   - Résolution des conflits Git

3. **Implémentation de fonctionnalités complexes**
   - Effets audio (GainNode, StereoPannerNode)
   - Conversion AudioBuffer → WAV Blob
   - Web Component avec Shadow DOM

4. **Optimisation et refactoring**
   - Amélioration de la structure du code
   - Séparation des responsabilités

5. **Documentation**
   - Commentaires dans le code

### Ce qui a été fait manuellement :
- Architecture globale du projet
- Design de l'interface utilisateur
- Tests et validation
- Choix des technologies
- Déploiement et configuration Render

---

## 📁 Structure du Projet

```
web_project/
├── sampler/                 # Frontend Sampler
│   ├── index.html          # Page principale
│   ├── styles.css          # Styles
│   └── src/
│       ├── main.js         # Point d'entrée
│       ├── AudioEngine.js  # Gestion Web Audio API
│       ├── SamplerGUI.js   # Interface utilisateur
│       ├── SamplerComponent.js  # Web Component
│       └── api.js          # Appels API
│
├── server/                  # Backend API
│   ├── server.js           # Express server
│   ├── config/db.js        # Connexion MongoDB
│   ├── models/Preset.js    # Schéma Mongoose
│   ├── controllers/        # Logique métier
│   ├── routes/             # Routes API
│   └── public/uploads/     # Fichiers audio uploadés
│
└── admin-panel/            # Angular Admin
    └── src/app/
        ├── components/     # Composants Angular
        └── services/       # Services HTTP
```

---

## 🔗 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/presets` | Liste tous les presets |
| `GET` | `/api/presets/:id` | Récupère un preset |
| `POST` | `/api/presets` | Crée un nouveau preset |
| `PUT` | `/api/presets/:id` | Modifie un preset |
| `DELETE` | `/api/presets/:id` | Supprime un preset |

---

## 📝 License

Projet académique - Master 1 Développement Web

---

**Développé avec ❤️ par Tamani Ahmed & Benabdelkader Marouane**
