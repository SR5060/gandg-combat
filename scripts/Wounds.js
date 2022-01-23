Hooks.once('init', async function() {
    console.log('gandg combat | initialize')

})

Hooks.on('preCreateCombatant')

/* 
hook on createcombatant
array[1] holds actorID, sceneId, tokenId
array[3] holds combatant ID
are they a pc? create a flag on combatant

hook on updateActor
did hp change more than conmod + 12?
look for flag on actor combatant for active scene
add counter

hook on combat turn
does active combatant have flag/counter?
prompt save
save failed?
add effect
*/
