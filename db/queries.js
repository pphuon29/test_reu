// db/queries.js

// Importe l'objet db exporté depuis db/index.js (qui contient la méthode query)
const db = require('./index');

/**
 * Recherche un utilisateur dans la base de données par son adresse email
 * @param {string} email - L'adresse email à rechercher
 * @returns {Promise<object|undefined>} Une promesse qui résout avec l'objet utilisateur
 * (s'il est trouvé) ou undefined (sinon)
 */
async function findUserByEmail(email) {
    // Requête SQL paramétrée pour éviter les injections SQL
    const sql = 'SELECT * FROM users WHERE email = $1';
    const params = [email]; // Le tableau des paramètres ($1 prendra la valeur de params[0])

    try {
        // Exécute la requête en utilisant la fonction query importée
        const result = await db.query(sql, params);

        // db.query renvoie un objet avec plusieurs propriétés, dont 'rows' qui est un tableau.
        // Si l'utilisateur est trouvé, il sera le premier (et unique) élément de 'rows'.
        // Si 'rows' est vide, result.rows[0] sera 'undefined'.
        return result.rows[0];

    } catch (err) {
        console.error(`Erreur lors de la recherche de l'utilisateur par email (${email}):`, err);

        throw err;
    }
}

/**
 * Crée un nouvel utilisateur dans la base de données.
 * @param {string} email - L'email du nouvel utilisateur.
 * @param {string} hashedPassword - Le mot de passe DEJA haché avec bcrypt
 * @param {string} name - Le nom de l'utilisateur
 * @param {string} userType - Le type ('organizer' ou 'participant')
 * @returns {Promise<object>} Une promesse qui résout avec l'objet du nouvel utilisateur créé
 * (grâce à RETURNING *)
 */
async function createUser(email, hashedPassword, name, userType) {
    // Utilisation de RETURNING * pour récupérer toutes les colonnes de la ligne insérée,
    // y compris le user_id auto-généré par SERIAL PRIMARY KEY
    const sql = `
        INSERT INTO users (email, password_hash, name, user_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const params = [email, hashedPassword, name, userType];

    try {
        const result = await db.query(sql, params);
        // La ligne insérée est retournée dans result.rows[0]
        return result.rows[0];
    } catch (err) {
        console.error(`Erreur lors de la création de l'utilisateur (${email}):`, err);
        throw err; // Relance l'erreur pour la gestion dans auth.js
    }
}

/**
 * Recherche un utilisateur dans la base de données par son ID
 * Sera utile pour récupérer les informations de l'utilisateur stocké dans la session.
 * @param {number} id - L'ID (user_id) de l'utilisateur
 * @returns {Promise<object|undefined>} Une promesse qui résout avec l'objet utilisateur
 * (s'il est trouvé) ou undefined (sinon).
 */
async function findUserById(id) {
    // Sélectionne toutes les colonnes SAUF le hash du mot de passe par sécurité,
    // car on n'a pas besoin quand on récupère un utilisateur par ID
    const sql = 'SELECT user_id, email, name, user_type, created_at FROM users WHERE user_id = $1';
    const params = [id];

    try {
        const result = await db.query(sql, params);
        return result.rows[0]; // Retourne l'utilisateur ou undefined
    } catch (err) {
        console.error(`Erreur lors de la recherche de l'utilisateur par ID (${id}):`, err);
        throw err;
    }
}

// --- FONCTIONS POUR LES RÉUNIONS ---

/**
 * Insère une nouvelle réunion dans la table 'meetings'
 * @param {number} organizerId - L'ID de l'utilisateur qui crée la réunion
 * @param {string} title - Le titre de la réunion
 * @param {string|null} description - La description de la réunion (peut être vide/null).
 * @returns {Promise<object>} Une promesse qui résout avec l'objet de la réunion créée (incluant son meeting_id)
 */
async function createMeeting(organizerId, title, description) {
    const sql = `
        INSERT INTO meetings (organizer_id, title, description)
        VALUES ($1, $2, $3)
        RETURNING *; -- Récupère la ligne complète insérée
    `;
    // Si description est une chaîne vide, on insère NULL dans la BDD
    const params = [organizerId, title, description || null];
    try {
        const result = await db.query(sql, params);
        // La nouvelle réunion (avec son ID) est dans result.rows[0]
        return result.rows[0];
    } catch (err) {
        console.error(`Erreur lors de l'insertion de la réunion (organizerId: ${organizerId}, title: ${title}):`, err);
        throw err; // Relance l'erreur pour le route handler
    }
}

/**
 * Insère un créneau horaire proposé pour une réunion dans la table 'meeting_slots'
 * @param {number} meetingId - L'ID de la réunion à laquelle ce créneau appartient
 * @param {string|Date} startTime - La date et l'heure de début du créneau
 * @param {string|Date} endTime - La date et l'heure de fin du créneau. Mêmes contraintes de format
 * @returns {Promise<object>} Une promesse qui résout avec l'objet du créneau créé
 */
async function addMeetingSlot(meetingId, startTime, endTime) {

    const sql = `
        INSERT INTO meeting_slots (meeting_id, start_time, end_time)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const params = [meetingId, startTime, endTime];
    try {
        const result = await db.query(sql, params);
        return result.rows[0];
    } catch (err) {
        // Une erreur ici peut être due à un format de date invalide,
        // ou une violation de contrainte (ex: meetingId inexistant)
        console.error(`Erreur lors de l'insertion du créneau (meetingId: ${meetingId}, start: ${startTime}):`, err);
        throw err;
    }
}

/**
 * Récupère les détails d'une réunion par son ID.
 * @param {number} meetingId L'ID de la réunion.
 * @returns {Promise<object|undefined>} L'objet réunion ou undefined si non trouvé.
 */
async function getMeetingById(meetingId) {
    const sql = 'SELECT * FROM meetings WHERE meeting_id = $1';
    const params = [meetingId];
    try {
        const result = await db.query(sql, params);
        return result.rows[0];
    } catch (err) {
        console.error(`Erreur lors de la récupération de la réunion ID ${meetingId}:`, err);
        throw err;
    }
}

/**
 * Récupère tous les créneaux pour une réunion spécifique, triés par date de début
 * @param {number} meetingId L'ID de la réunion
 * @returns {Promise<Array<object>>} Un tableau des objets créneaux
 */
async function getSlotsByMeetingId(meetingId) {
    const sql = 'SELECT * FROM meeting_slots WHERE meeting_id = $1 ORDER BY start_time ASC';
    const params = [meetingId];
    try {
        const result = await db.query(sql, params);
        return result.rows; // Renvoie un tableau (potentiellement vide)
    } catch (err) {
        console.error(`Erreur lors de la récupération des créneaux pour meeting ID ${meetingId}:`, err);
        throw err;
    }
}


/**
 * Récupère toutes les réunions créées par un organisateur spécifique.
 * @param {number} organizerId L'ID de l'organisateur
 * @returns {Promise<Array<object>>} Un tableau des objets réunion (limité aux infos utiles pour la liste)
 */
async function getMeetingsByOrganizer(organizer_id){

    const sql = 'SELECT meeting_id, title, description, creation_date FROM meetings WHERE organizer_id = $1 ORDER BY creation_date DESC';

    const params = [organizer_id]
    try {
        const result = await db.query(sql,params);
        return result.rows; //Renvoie un tableau de réunions
    } catch(err){
        console.error(`Erreur lors de la récupération des réunions pour l'organisateur ID ${organizer_id}:`, err);
        throw err;
    }

}


/**
 * Supprime une réunion et (via CASCADE) ses créneaux, réponses, invitations associés
 * @param {number} meetingId L'ID de la réunion à supprimer
 * @returns {Promise<number>} Le nombre de lignes supprimées dans la table meetings (devrait être 1 ou 0)
 */
async function deleteMeetingById(meetingId) {
    const sql = 'DELETE FROM meetings WHERE meeting_id = $1';
    const params = [meetingId];

    try {
        const result = await db.query(sql, params);
        // result.rowCount contient le nombre de lignes affectées
        return result.rowCount;
    } catch (err) {
        console.error(`Erreur lors de la suppression de la réunion ID ${meetingId}:`, err);
        throw err;
    }
}

// Exporte les fonctions pour qu'elles puissent être importées et utilisées ailleurs
module.exports = {
    findUserByEmail,
    createUser,
    findUserById,
    createMeeting,
    addMeetingSlot,
    getMeetingById,
    getSlotsByMeetingId,
    getMeetingsByOrganizer,
    deleteMeetingById
};