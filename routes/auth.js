// routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router(); // Crée une instance de Router

const { findUserByEmail, createUser } = require('../db/queries');

// Route pour afficher le formulaire de connexion
// Correspond àl'URL : /auth/login 
router.get('/login', (req, res) => {
    // Rend le fichier views/login.ejs
    res.render('login', { pageTitle: 'Connexion' });
});

// Route pour afficher le formulaire d'inscription
// Correspond à l'URL : /auth/register
router.get('/register', (req, res) => {
    // Rend le fichier views/register.ejs
    res.render('register', { pageTitle: 'Inscription' });
});

// --- Route POST pour l'inscription ---
router.post('/register', async (req, res) => {
    // 1. Extraire les données du corps de la requête (envoyées par le formulaire)
    // Les clés (email, name...) correspondent aux attributs 'name' des <input>
    const { email, name, password, confirmPassword, userType } = req.body;

    // Objet pour stocker les données du formulaire (sauf les mots de passe)
    // Utile pour re-remplir le formulaire en cas d'erreur
    const formData = { email, name, userType };

    // 2. Validation simple : Vérifier si les mots de passe correspondent
    if (!password || password !== confirmPassword) {
        // Si différents, ré-afficher le formulaire avec un message d'erreur
        // On utilise 'return' pour arrêter l'exécution ici
        return res.render('register', {
            pageTitle: 'Inscription',
            error: 'Les mots de passe ne correspondent pas.',
            formData: formData // Renvoyer les données saisies
        });
    }

    // 3. Validation simple : Type d'utilisateur valide
    if (!userType || !['organizer', 'participant'].includes(userType)) {
         return res.render('register', {
            pageTitle: 'Inscription',
            error: 'Type d\'utilisateur invalide.',
            formData: formData
        });
    }

    // try catch pour gérer les erreurs potentielles (BDD, etc.)
    try {
        // 4. Vérifier si l'email existe déjà dans la base de données
        // (findUserByEmail doit être une fonction async qui utilise db.query)
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            // Si l'utilisateur existe, ré-afficher le formulaire avec une erreur
            return res.render('register', {
                pageTitle: 'Inscription',
                error: 'Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.',
                formData: formData
            });
        }

        // 5. Si l'email est libre, hacher le mot de passe
        const saltRounds = 10; // Facteur de coût pour bcrypt (10-12 est courant)
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 6. Insérer le nouvel utilisateur dans la base de données
        // (createUser doit être une fonction async qui utilise db.query)
        const newUser = await createUser(email, hashedPassword, name, userType);

        // 7. Rediriger vers la page de connexion après succès
        // Vous pourriez aussi ajouter un message flash de succès ici si vous utilisez connect-flash
        console.log('Nouvel utilisateur créé:', newUser); // Optionnel: log pour le debug
        res.redirect('/auth/login'); // Redirection vers la page de connexion

    } catch (err) {
        // 8. Gérer les erreurs (ex: erreur de connexion à la BDD)
        console.error("Erreur serveur lors de l'inscription:", err);
        // Afficher une erreur générique à l'utilisateur
        res.render('register', {
            pageTitle: 'Inscription',
            error: 'Une erreur est survenue lors de la création du compte. Veuillez réessayer plus tard.',
            formData: formData
        });
    }
});


// --- Route POST pour la connexion ---
router.post('/login', async (req, res) => {
    // 1. Extraire email et mot de passe du formulaire
    const { email, password } = req.body;

    // Vérification simple (optionnelle)
    if (!email || !password) {
        return res.render('login', {
            pageTitle: 'Connexion',
            error: 'Veuillez fournir l\'email et le mot de passe.',
            formData: { email } // Renvoyer l'email saisi
        });
    }

    try {
        // 2. Chercher l'utilisateur par email
        const user = await findUserByEmail(email);

        // 3. Vérifier si l'utilisateur existe
        if (!user) {
            // !! Sécurité : Ne pas dire si c'est l'email ou le mot de passe qui est faux
            return res.render('login', {
                pageTitle: 'Connexion',
                error: 'Email ou mot de passe incorrect.',
                formData: { email }
            });
        }

        // 4. Comparer le mot de passe fourni avec le hash stocké
        const match = await bcrypt.compare(password, user.password_hash);

        // 5. Vérifier si les mots de passe correspondent
        if (!match) {
            // !! Même message d'erreur générique
            return res.render('login', {
                pageTitle: 'Connexion',
                error: 'Email ou mot de passe incorrect.',
                formData: { email }
            });
        }

        // --- Connexion réussie ! ---

        // 6. Stocker les informations utilisateur dans la session
        // Ne stockez que ce qui est nécessaire et non sensible
        req.session.user = {
            id: user.user_id,
            name: user.name,
            email: user.email,
            userType: user.user_type
            // NE PAS stocker user.password_hash ici !
        };

        // 7. Rediriger vers la page d'accueil (ou un tableau de bord plus tard)
        res.redirect('/');

    } catch (err) {
        // 8. Gérer les erreurs serveur
        console.error("Erreur serveur lors de la connexion:", err);
        res.render('login', {
            pageTitle: 'Connexion',
            error: 'Une erreur est survenue lors de la connexion. Veuillez réessayer.',
            formData: { email }
        });
    }
});

// --- Route GET pour la déconnexion ---
router.get('/logout', (req, res, next) => {
    // Détruit la session côté serveur
    req.session.destroy((err) => {
        if (err) {
            // Gérer l'erreur, peut-être rediriger vers une page d'erreur
            console.error("Erreur lors de la destruction de la session:", err);
            return next(err); // Passe à un gestionnaire d'erreur Express si vous en avez un
        }
        // Optionnel: Effacer le cookie côté client (le nom du cookie est souvent 'connect.sid' par défaut avec express-session)
        res.clearCookie('connect.sid'); // Ajustez le nom si vous l'avez changé dans la config session
        // Rediriger vers la page d'accueil
        res.redirect('/');
    });
});


// TODO : --- Routes POST /login et GET /logout (à implémenter) ---


module.exports = router;