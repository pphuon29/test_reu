const express = require('express');
const router = express.Router();


const { 
createMeeting, 
addMeetingSlot, 
getMeetingById,
getSlotsByMeetingId,
getMeetingsByOrganizer,
deleteMeetingById
} = require('../db/queries');

// --- Middleware d'authentification et d'autorisation ---

// Middleware pour vérifier si un utilisateur est connecté
function isLoggedIn(req, res, next) {
    // Si la session contient l'objet 'user' (défini lors du login)
    if (req.session.user) {
        return next(); // L'utilisateur est connecté, on passe à la suite (autre middleware ou route handler)
    }
    // Sinon, rediriger vers la page de connexion
    res.redirect('/auth/login');
}

// Middleware pour vérifier si l'utilisateur connecté est un organisateur
function isOrganizer(req, res, next) {
    // Ce middleware doit être utilisé APRÈS isLoggedIn,
    // donc on peut supposer que req.session.user existe.
    if (req.session.user && req.session.user.userType === 'organizer') {
        return next(); // C'est un organisateur, on passe à la suite
    }

    res.status(403).render('error', {
         pageTitle: 'Accès Interdit',
         message: 'Vous devez être un organisateur pour accéder à cette page.'
    });

}


// --- Définition des Routes pour /meetings ---
// Le préfixe '/meetings' est déjà défini dans app.js (app.use('/meetings', meetingRoutes))
// Donc, une route définie ici comme '/' correspondra à l'URL '/meetings'
// et une route '/new' correspondra à '/meetings/new'


// GET /meetings/new - Afficher le formulaire pour créer une nouvelle réunion
// On applique les middlewares : d'abord vérifier si connecté, puis si c'est un organisateur
router.get('/new', isLoggedIn, isOrganizer, (req, res) => {
    // Rend la vue 'new_meeting.ejs' qui contient le formulaire
    res.render('new_meeting', {
         pageTitle: 'Planifier une nouvelle réunion',
         formData: {}, // Passe un objet vide pour les données initiales du formulaire
         error: null // Pas d'erreur au premier affichage
    });
});


// POST /meetings - Gérer la soumission du formulaire de création de réunion
router.post('/', isLoggedIn, isOrganizer, async (req, res) => {

    // Récupérer les données envoyées par le formulaire (dans req.body)
    const { title, description } = req.body;
    const organizerId = req.session.user.id; // L'ID de l'organisateur vient de la session

    // Récupérer les créneaux. La manière dépend des attributs 'name' dans le formulaire.
    let startTimes = req.body.startTimes || [];
    let endTimes = req.body.endTimes || [];

    // S'assurer qu'on a toujours des tableaux, même si un seul créneau est soumis
    if (!Array.isArray(startTimes)) startTimes = [startTimes];
    if (!Array.isArray(endTimes)) endTimes = [endTimes];

    // Données pour re-remplir le formulaire en cas d'erreur
    const formData = { title, description, startTimes, endTimes };

    // Validation simple des données
    if (!title || startTimes.length === 0 || startTimes.length !== endTimes.length) {
        return res.status(400).render('new_meeting', {
            pageTitle: 'Planifier une nouvelle réunion',
            error: 'Le titre est obligatoire et vous devez proposer au moins un créneau horaire valide (avec début et fin correspondants)',
            formData: formData
        });
    }

    const validatedSlots = []; //Stocker les créneaux validés et formatés
    let validationError = null;

    //Valider tous les créneaux avant d'insérer
    for (let i = 0; i < startTimes.length; i++) {

        const startTimeStr = startTimes[i];
        const endTimeStr = endTimes[i];

        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);
        const now = new Date(); //Heure actuelle du serveur


        // 1 - Vérifier la validité de base et l'ordre
        if(!startTimeStr || !endTimeStr || isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime ){
            validationError = `Le créneau ${i+1} est invalide ou mal ordonné (la fin doit être après le début)`;
            break;
        }

        // 2 - Vérifier si la date de début est dans le passé
        // Marge d'erreurs des 5 minutes pour éviter les erreurs qui sont à la seconde près
        const fiveMinutes = 5 * 60 * 1000; //5 minutes en millisecondes
        if (startTime.getTime() < (now.getTime() - fiveMinutes)){
            validationError = `Le créneau ${i + 1} ne peut pas commencer dans le passé.`;
            break;
        }

        // 3 - Vérifier si le créneau est le même jour
        const startDay = startTime.toISOString().slice(0,10);
        const endDay = endTime.toISOString().slice(0,10);
        if(startDay !== endDay){
            validationError = `Le créneau ${i+1} doit commencer et finir le même jour.`;
            break;
        }

        // 4 - Vérifier la durée maximale (ex: 2 heures)
        const maxDurationMs = 2 * 60 * 60 * 1000; // 2 heures en millisecondes
        const durationMs = endTime.getTime() - startTime.getTime();
        if (durationMs > maxDurationMs){
            validationError = `Le créneau ${i+1} ne peut pas durer plus de 2 heures.`;
            break;
        }

        // 5 - Vérifier si c'est un week-end 
        const dayofWeek = startTime.getDay(); //0-6
        if(dayofWeek === 0 || dayofWeek === 6){
            validationError = `Le créneau ${i+1} ne peut pas être un week-end.`;
            break;
        }


        // 6 -- Vérifiez les heures de début et de fin (ex 8h30 - 18H30)
        // getHours()/getMinutes() utilisent l'heure locale du serveur.
        const startHour = startTime.getHours();
        const startMinutes = startTime.getMinutes();
        const endHour = endTime.getHours();
        const endMinutes = endTime.getMinutes();

        // Vérifie si l'heure de début est valide (entre 8h30 inclus et 18h30 inclus)
        // (startHour > 8 OR (startHour === 8 AND startMinutes >= 30)) AND (startHour < 18 OR (startHour === 18 AND startMinutes <= 30))
        const isStartValid = (startHour * 60 + startMinutes >= 8 * 60 + 30) && (startHour * 60 + startMinutes <= 18 * 60 + 30);

        // Vérifie si l'heure de fin est valide (entre 8h30 inclus et 18h30 inclus)
        // une réunion peut finir pile à 18h30.
        // (endHour > 8 OR (endHour === 8 AND endMinutes >= 30)) AND (endHour < 18 OR (endHour === 18 AND endMinutes <= 30))
        const isEndValid = (endHour * 60 + endMinutes >= 8 * 60 + 30) && (endHour * 60 + endMinutes <= 18 * 60 + 30);

        // Si l'heure de début OU l'heure de fin est en dehors de la plage autorisée
        // (on sait déjà par le check précédent que endTime > startTime)
        if (!isStartValid || !isEndValid) {
            validationError = `Le créneau ${i + 1} (${startTimeStr.split('T')[1]} - ${endTimeStr.split('T')[1]}) doit être entièrement compris entre 8h30 et 18h30.`;
            break;
        }

        if (validationError) break;

        // --- Si toutes les validations passent ---
        // Conversion pour la BDD (si nécessaire) 
        // PostgreSQL TIMESTAMPTZ comprend le format ISO renvoyé par toISOString()
        const startTimeForDb = startTime.toISOString();
        const endTimeForDb = endTime.toISOString();

        validatedSlots.push({
            start: startTimeForDb,
            end : endTimeForDb
        });

    } //Fin boucle for de vérification

    // --- Vérifier s'il y a eu une erreur de validation ---
    if (validationError) {
        // S'il y a une erreur, ré-afficher le formulaire SANS rien créer en BDD
        return res.status(400).render('new_meeting', {
            pageTitle: 'Planifier une nouvelle réunion',
            error: validationError,
            formData: formData
        });
    }
    
    // Si tout est valide, créer la réunion et les créneaux ---
    try {
        // Créer la réunion principale
        const newMeeting = await createMeeting(organizerId, title, description);
        const meetingId = newMeeting.meeting_id;

        // Préparer et exécuter l'insertion des créneaux validés
        const slotPromises = validatedSlots.map(slot =>
            addMeetingSlot(meetingId, slot.start, slot.end)
        );
        await Promise.all(slotPromises);

        // Rediriger
        res.redirect(`/meetings/${meetingId}`);

    } catch (err) {
        console.error("Erreur serveur lors de la création de la réunion:", err);
        res.status(500).render('new_meeting', { /* ... erreur interne ... */ });
    }


});


router.get('/', isLoggedIn, async (req,res) => {

    const userId = req.session.user.id;
    const userType = req.session.user.userType;
    let meetings = [];

    console.log(`--- Tentative d'affichage GET /meetings --- User ID: ${userId}, User Type: ${userType}`);
    
    try {

        if (userType === 'organizer'){
            //Si c'est un organisateur, on récupère les réunions qu'il a crées
            meetings = await getMeetingsByOrganizer(userId);

        } else if (userType === 'participant'){
            //Si c'est un participant, récupérer les réunions où il est invité ou répondu 
            // Pour l'instant, on laisse 'meetings' vide pour les participants.
            // TODO: Implémenter la logique pour les participants (ex: getMeetingsForParticipant(userId))

            console.log(`Affichage des réunions pour le participant ID ${userId} (logique à implémenter)`);
        }

        res.render('meetings_list', {

            pageTitle: 'Mes réunions',
            meetings: meetings,  //Tableau des réunions (peut être vide)
            userType: userType  //Pour afficher des messages si besoin

        });

        
    } catch (err) {
        console.error("Erreur lors de la récupération des réunions pour l'utilisateur:", err);
        res.status(500).render('error',{ pageTitle: 'Erreur', message: 'Impossible de charger la liste des réunions.'})
    }

});

// GET /meetings/:id - Afficher les détails d'une réunion spécifique
router.get('/:id', isLoggedIn, async (req, res) => {

    const meetingId = parseInt (req.params.id,10); // Récupère l'ID depuis l'URL et le convertit en nombre

    //Vérifie si l'ID est un nombre valide
    if (isNaN(meetingId)) {
        return res.status(400).render('error', { pageTitle: 'Erreur', message: 'ID de réunion invalide.'});
    }

    try {
        //Récupère les détails de la réunion et les créneaux
        const [meeting, slots] = await Promise.all([
            getMeetingById(meetingId),
            getSlotsByMeetingId(meetingId)
        ]);

        //Vérifie si la réunion existe
        if (!meeting){
            //Si la réunion n'est pas trouvée, afficher la page 404
            return res.status(404).render('404', { pageTitle : 'Réunion introuvable' });
        }

        //Afficher les détails de la réunion
        
        res.render('view_meeting', {
            pageTitle:`Réunion : ${meeting.title}`,
            meeting: meeting, //Objet contenant les détails de la réunion
            slots : slots //Tableau contenant les objets créneaux
        });
    } catch (err){
        console.error(`Erreur serveur lors de l'affichage de la réunion ID ${meetingId}:`,err);

        res.status(500).render('error', {pageTitle: 'Erreur', message:'Impossible d\'afficher la réunion'});
    }

 });

 router.post('/:id/delete', isLoggedIn, isOrganizer, async (req, res) => {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    if (isNaN(meetingId)) {
        return res.status(400).render('error', { pageTitle: 'Erreur', message: 'ID de réunion invalide.' });
    }

    try {
        // l'utilisateur est-il bien l'organisateur 
        const meeting = await getMeetingById(meetingId);
        if (!meeting) {
             return res.status(404).render('404', { pageTitle: 'Réunion introuvable' });
        }
        if (meeting.organizer_id !== userId) {
             // L'organisateur connecté essaie de supprimer une réunion qui ne lui appartient pas
             return res.status(403).render('error', { pageTitle: 'Accès Interdit', message: 'Vous ne pouvez supprimer que vos propres réunions.' });
        }

        // Procéder à la suppression
        const deleteCount = await deleteMeetingById(meetingId);

        if (deleteCount > 0) {
             console.log(`Réunion ${meetingId} supprimée par l'utilisateur ${userId}`);
             // Optionnel: Ajouter un message flash de succès
        } else {
             console.warn(`Tentative de suppression de la réunion ${meetingId} par ${userId}, mais elle n'a pas été trouvée ou supprimée.`);
             // Optionnel: Ajouter un message flash d'avertissement/erreur
        }

        // Rediriger vers la liste des réunions
        res.redirect('/meetings');

    } catch (err) {
        console.error(`Erreur serveur lors de la suppression de la réunion ID ${meetingId}:`, err);
        res.status(500).render('error', { pageTitle: 'Erreur', message: 'Impossible de supprimer la réunion.' });
    }
});


// POST /meetings/:id/respond - Permettre à un participant de répondre
// router.post('/:id/respond', isLoggedIn, async (req, res) => { ... });

// et potentiellement d'autres routes pour la modification, l'invitation, etc

module.exports = router;