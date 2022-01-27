Hooks.once('init', async function() {
    console.log('gandg combat | initialize')

})

Hooks.on('preCreateCombatant', createTracker(combatantArray))

async function createTracker(combatantArray) {
    let actorId = combatantArray[1][0];
    let sceneId = combatantArray[1][1];
    let tokenId = combatantArray[1][2];
    let combatantId = combatantArray[3];
    if (Game.actors.get(actorId).isPC = true) {
        //create flag
        await game.activescene.combatants.get(combatantId).setflag(MODULE.data.name, 'hasWoundRisk', {
            woundQual: True,
            actorId: actorId,
            sceneId: sceneId,
            tokenId: tokenId,
            combatantId: combatantId
        });
    }
}
        

/*
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
