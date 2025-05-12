// --- IMPORTS ---
const express = require('express');
const path = require('path'); // Module Node pour gérer les chemins de fichiers
const dotenv = require('dotenv'); // Pour charger les variables d'environnement
const session = require('express-session'); // Pour gérer les sessions utilisateur

// --- CONFIGURATION INITIALE ---
dotenv.config(); // Charge les variables depuis le fichier .env dans process.env


const db = require('./db'); // Charge le module db/index.js et exécute son code

const app = express(); // Crée l'application Express
const PORT = process.env.PORT || 3000; // Définit le port d'écoute (depuis .env ou 3000 par défaut)

// Configuration du moteur de vues EJS
app.set('view engine', 'ejs');
// Optionnel mais bonne pratique: spécifier le dossier des vues
app.set('views', path.join(__dirname, 'views'));

// --- MIDDLEWARES ---
// Middleware pour servir les fichiers statiques (CSS, JS client, images...)
// Tout ce qui est dans le dossier 'public' sera accessible directement via l'URL
// Ex: http://localhost:3000/css/style.css cherchera /public/css/style.css
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser le corps des requêtes entrantes au format URL-encoded
// Permet de récupérer les données envoyées par un formulaire HTML (req.body)
app.use(express.urlencoded({ extended: true }));

// Middleware pour parser le corps des requêtes entrantes au format JSON
// Utile si vous prévoyez des requêtes AJAX envoyant du JSON
app.use(express.json());

// Middleware pour gérer les sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'un secret par défaut pas sécurisé', // Clé secrète pour signer le cookie de session (METTRE DANS .ENV !)
    resave: false, // Ne pas sauvegarder la session si elle n'a pas été modifiée
    saveUninitialized: false, // Ne pas créer de session pour un utilisateur non authentifié
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Mettre à true en production (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // Durée de vie du cookie (ici 24 heures)
    }
}));

// Middleware optionnel pour rendre les infos utilisateur de la session disponibles dans toutes les vues EJS
app.use((req, res, next) => {
    // Si l'utilisateur est stocké dans la session (après connexion), on le passe à res.locals
    // Il sera alors accessible dans les fichiers EJS via la variable 'user'
    res.locals.user = req.session.user;
    next(); // Passe au middleware ou à la route suivante
});


// --- ROUTES ---
// Route simple pour la page d'accueil
app.get('/', (req, res) => {
    // res.render() utilise le moteur de vue configuré (EJS) pour
    res.render('index', {
        // Vous pouvez passer des données à votre vue EJS ici
        pageTitle: 'Accueil - Planificateur de Réunions'
        // 'user' est déjà disponible via le middleware précédent si l'utilisateur est connecté
    });
});

// --- ICI viendront les autres routes (ex: authentification, réunions) ---
 const authRoutes = require('./routes/auth');
 const meetingRoutes = require('./routes/meetings');
 app.use('/auth', authRoutes);
 app.use('/meetings', meetingRoutes);


// --- GESTION ERREUR 404 ---
app.use((req, res, next) => {
    res.status(404).render('404', { pageTitle: 'Page non trouvée' });
});


// --- DÉMARRAGE DU SERVEUR ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});