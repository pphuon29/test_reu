// db/index.js

// Importe la classe Pool du module 'pg'
const { Pool } = require('pg');

// La configuration dotenv est normalement déjà faite dans app.js au démarrage

// Crée une nouvelle instance de Pool
// Le constructeur Pool prend un objet de configuration
// Il va automatiquement chercher les variables d'environnement standard
// (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT) si elles existent,
// mais il est mieux de mapper depuis vos noms de variables .env
const pool = new Pool({
    user: process.env.DB_USER,          // Nom d'utilisateur de la BDD (dans .env)
    host: process.env.DB_HOST,          // Adresse du serveur BDD (dans .env, souvent 'localhost')
    database: process.env.DB_DATABASE,  // Nom de la base de données (dans .env)
    password: process.env.DB_PASSWORD,  // Mot de passe de l'utilisateur BDD (dans .env)
    port: process.env.DB_PORT || 5432,  // Port (dans .env, 5432 est le défaut pour PostgreSQL)
});

// Vérifier la connexion au démarrage.
// On essaie de 'connecter' un client depuis le pool.
pool.connect((err, client, release) => {
    if (err) {
        // Si une erreur se produit (mauvais mot de passe, BDD non démarrée, etc.)
        console.error('ERREUR LORS DE LA CONNEXION À LA BASE DE DONNÉES :', err.stack);

        process.exit(1);
    } else {
        // Si la connexion réussit
        console.log('Connecté avec succès à la base de données PostgreSQL.');
        // Il faut toujours libérer le client après l'avoir utilisé
        // pour qu'il retourne dans le pool et soit disponible pour d'autres requêtes.
        release();
    }
});

// Écouteur d'événements pour les erreurs sur les clients inactifs dans le pool
// Utile pour attraper des erreurs qui surviendraient plus tard.
pool.on('error', (err, client) => {
    console.error('Erreur inattendue sur un client du pool de base de données', err);
    process.exit(-1); // Quitter l'application en cas d'erreur grave du pool
});


// On exporte un objet qui contient une méthode 'query'.
// C'est cette méthode que les autres parties de l'application (routes, modèles...)
// utiliseront pour interagir avec la base de données.
module.exports = {
    /**
     * Exécute une requête SQL sur le pool de connexions.
     * @param {string} text La requête SQL (peut contenir des placeholders comme $1, $2).
     * @param {Array} params Un tableau de valeurs pour remplacer les placeholders (évite les injections SQL).
     * @returns {Promise<QueryResult>} Une promesse qui résoudra avec le résultat de la requête.
     */
    query: (text, params) => pool.query(text, params),
};