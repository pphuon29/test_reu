$(document).ready(function() {

    const now = new Date();
    
    const minDateTime = now.toISOString().slice(0,16);
    // Ajustement pour obtenir le format YYYY-MM-DDTHH:MM pour l'heure locale actuelle
    // Nécessaire pour les attributs min/max de datetime-local
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());


    // Fonction pour formater une date JS en string YYYY-MM-DDTHH:MM
    function formatAsDateTimeLocal(date) {
        const offset = date.getTimezoneOffset();
        const newDate = new Date(date.getTime() - (offset * 60 * 1000));
        return newDate.toISOString().slice(0, 16);
    }

    //Appliquer la date/heure minimale au champs initiaux
    $('#slots-container input[type="datetime-local"]').each(function(){
        if(!$(this).val()){//Ne pas écraser si pré-rempli après erreur backsend
            $(this).attr('min',minDateTime);

        }

        //Valider le slot initial s'il est pré-rempli
        validateSlot($(this).closest('.slot-group').find('input[name="startTimes[]"]'),
                     $(this).closest('.slot-group').find('input[name="endTimes[]"]'));

    });

    let slotCounter = $('#slots-container .slot-group').length; // Compte les créneaux initiaux

    $('#add-slot-btn').on('click', function() {
        slotCounter++;
        const newSlotHtml = $(`
            <div class="slot-group mb-2 border p-2 rounded bg-light">
                 <div class="d-flex justify-content-between align-items-center mb-1">
                     <label class="form-label fw-bold mb-0">Créneau ${slotCounter}:</label>
                     <button type="button" class="btn btn-danger btn-sm remove-slot-btn">X</button>
                 </div>
                 <div class="d-flex align-items-center flex-wrap">
                     <input type="datetime-local" name="startTimes[]" required class="form-control me-2 mb-1" style="width: auto;">
                     <span class="me-2 mb-1"> à </span>
                     <input type="datetime-local" name="endTimes[]" required class="form-control me-2 mb-1" style="width: auto;">
                </div>
                <div class="slot-validation-message mt-1"></div> 
                </div>
        `);
        
        // Appliquer la date minimale aux nouveaux champs avant de les ajouter
        newSlotHtml.find('input[type="datetime-local"]').attr('min', minDateTime);
        $('#slots-container').append(newSlotHtml);
    });

    $('#slots-container').on('click', '.remove-slot-btn', function() {
        if ($('#slots-container .slot-group').length > 1) {
            $(this).closest('.slot-group').remove();
            // Re-numéroter (optionnel)
            $('#slots-container .slot-group').each(function(index) {
                 $(this).find('label').first().text(`Créneau ${index + 1}:`);
            });
            slotCounter = $('#slots-container .slot-group').length;
        } else {
           
            showSlotError($(this).closest('.slot-group'), "Au moins un créneau est requis.");
            setTimeout(() => clearSlotError($(this).closest('.slot-group')), 3000); // Efface après 3s
        }
    });

// --- Validation dynamique des créneaux ---
$('#slots-container').on('change', 'input[type="datetime-local"]', function() {
    const $slotGroup = $(this).closest('.slot-group');
    const $startInput = $slotGroup.find('input[name="startTimes[]"]');
    const $endInput = $slotGroup.find('input[name="endTimes[]"]');
    validateSlot($startInput, $endInput);
});


// --- Fonction de validation pour UN créneau ---
function validateSlot($startInput, $endInput) {

    const $errorZone = $startInput.closest('.slot-group').find('.slot-validation-message');
    $errorZone.html(''); // Efface les erreurs précédentes pour ce créneau
    $startInput.removeClass('is-invalid');
    $endInput.removeClass('is-invalid');

    const startStr = $startInput.val();
    const endStr = $endInput.val();

    // Ne pas valider si l'une des dates est vide
    if (!startStr || !endStr) {
         // S'assurer que min est défini pour la fin si début est choisi
         if (startStr) $endInput.attr('min', startStr);
        return;
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const now = new Date();

    let errorMessage = null;

    // 1. Fin > Début
    if (endDate <= startDate) {
        errorMessage = "La fin doit être après le début.";
        $endInput.addClass('is-invalid');
    } else {
         // Mettre à jour le min de la fin (important si début change)
         $endInput.attr('min', startStr);
    }

    // 2. Début pas dans le passé (comparer les strings directement)
    if (!errorMessage && startStr < minDateTime) {
         errorMessage = "Le début ne peut pas être dans le passé.";
         $startInput.addClass('is-invalid');
    }

    // 3. Même jour
    if (!errorMessage && startDate.toDateString() !== endDate.toDateString()) {
        errorMessage = "Doit commencer et finir le même jour.";
         $startInput.addClass('is-invalid');
         $endInput.addClass('is-invalid');
    }

    // 4. Week-end
    const dayOfWeek = startDate.getDay(); // 0=Dim, 6=Sam
    if (!errorMessage && (dayOfWeek === 0 || dayOfWeek === 6)) {
        errorMessage = "Pas de créneaux le week-end.";
        $startInput.addClass('is-invalid');
         $endInput.addClass('is-invalid');
    }

    // 5. Heures de bureau (8h30 - 18h30)
    if (!errorMessage) {
        const startMinutesTotal = startDate.getHours() * 60 + startDate.getMinutes();
        const endMinutesTotal = endDate.getHours() * 60 + endDate.getMinutes();
        const workStartMinutes = 8 * 60 + 30; // 510
        const workEndMinutes = 18 * 60 + 30; // 1110

        if (startMinutesTotal < workStartMinutes || endMinutesTotal > workEndMinutes) {
             errorMessage = "Le créneau doit être entre 8h30 et 18h30.";
             $startInput.addClass('is-invalid');
             $endInput.addClass('is-invalid');
        }
    }

    // 6. Durée max (2 heures)
    if (!errorMessage) {
        const maxDurationMs = 2 * 60 * 60 * 1000;
        const durationMs = endDate.getTime() - startDate.getTime();
        if (durationMs > maxDurationMs) {
             errorMessage = "La durée ne doit pas dépasser 2 heures.";
             $endInput.addClass('is-invalid');
        }
        
    }

    // Afficher le message d'erreur s'il y en a un
    if (errorMessage) {
        $errorZone.html(`<small class="text-danger">${errorMessage}</small>`);
    } else {
         // Si tout est valide, s'assurer qu'il n'y a pas de classe d'erreur
        $startInput.removeClass('is-invalid');
        $endInput.removeClass('is-invalid');
    }
}

// Initialiser la validation pour les champs pré-remplis (si on revient avec une erreur)
$('#slots-container .slot-group').each(function() {
     const $slotGroup = $(this);
     const $startInput = $slotGroup.find('input[name="startTimes[]"]');
     const $endInput = $slotGroup.find('input[name="endTimes[]"]');
     // Initialiser le min de fin basé sur le début pré-rempli
     if ($startInput.val()) {
         $endInput.attr('min', $startInput.val());
     }
     // Valider le créneau
     validateSlot($startInput, $endInput);
});



});