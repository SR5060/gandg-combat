//import { moduleName } from '../module.js';

const moduleName = 'gandg-combat'

class wounds {
    static register() {
        wounds.hooks();
    }

    static hooks() {
        Hooks.on("ready", () => {
            game.socket.on(`module.gandg-combat`, wounds.woundSocket);


        });
        
        Hooks.on('createCombatant', wounds.createTracker);

        Hooks.on('updateCombat', wounds.checkCombatTrigger);
        
        Hooks.on("preUpdateActor", wounds.preUpdateActor);
        //Hooks.on("deleteCombat", cleanupFlags)
    }

    static createTracker(combatant) {
        const ids = {
            actorId: combatant.actor.id,
            sceneId: combatant.combat.scene.id,
            tokenId: combatant.token.id,
            combatantId: combatant.id,
        }

        //new ids(combatant.actor.id, combatant.combat.scene.id, combatant.token.id, combatant.id);
        if (combatant.isNPC === false) {
            //create flag
            return combatant.setFlag(moduleName, 'hasWoundRisk', ids)
    }};

    static checkCombatTrigger(combat, changed) {

        const currentCombatant = combat.combatants.get(combat.current.combatantId)
        if (currentCombatant.getFlag(moduleName, 'hasWoundRisk')) {
            const actor = game.actors.get(currentCombatant.getFlag(moduleName, 'hasWoundRisk').actorId)
            const woundRiskCounter = actor.getFlag(moduleName, 'woundRiskCounter')
            if (woundRiskCounter > 0) {
            
                new Dialog({
                    title: wounds.format("gandg.GreatWoundDialogTitle", { gwFeatureName: 'wound', actorName: actor.name }),
                    content: wounds.format("gandg.GreatWoundDialogContents", { actorName: actor.name, DC: (woundRiskCounter * 2 + 12) }),
                    buttons: {
                        one: {
                            label: wounds.localize("gandg.Default_roll"),
                            callback: () => {
                                /** draw locally if we are the one prompting the change OR if not owned by any players */
                                if (game.user.data.role !== 4 || !actor.hasPlayerOwner) {
                                    wounds.drawWound(actor);
                                    return;
                                }
                                const socketData = {
                                    users: actor.data._source.permission,
                                    actorId: actor.id,
                                    wound: true,
                                }
                                game.socket.emit(`module.gandg-combat`, socketData)

                            }
                        }
                    }
                }).render(true)
            }
            
        }
    }

    static preUpdateActor(actor, update) {
        let hp = getProperty(update, "data.attributes.hp.value");
        if (hp !== undefined && !actor.isNPC) {
            wounds.calculation(actor, update);
        }
    }

    static calculation(actor, update) {
        let data = {
            actor: actor,
            actorData: actor.data,
            updateData: update,
            //assumes that PC only has one token
            actorToken: actor.getActiveTokens()[0],
            //currentWoundRisk: token.combatant.getFlag(MODULE.data.name, 'hasWoundRisk'),
            actorHP: actor.data.data.attributes.hp.value,
            actorMax: actor.data.data.attributes.hp.max,
            actorConMod: actor.data.data.abilities.con.mod,
            updateHP: (hasProperty(update, "data.attributes.hp.value") ? update.data.attributes.hp.value : 0),
            hpChange: (actor.data.data.attributes.hp.value - (hasProperty(update, "data.attributes.hp.value") ? update.data.attributes.hp.value : actor.data.data.attributes.hp.value))
        };

        if (data.hpChange >= 12 + data.actorConMod) {
            let woundRiskCounter = actor.getFlag(moduleName, 'woundRiskCounter')
                if (!woundRiskCounter) {
                    woundRiskCounter = 1 
                } else { 
                    woundRiskCounter ++
                }

            return actor.setFlag(moduleName, 'woundRiskCounter', woundRiskCounter)
        }}

    static async drawWound(actor) {
        const saveTest = 12 + (2 * actor.getFlag(moduleName, 'woundRiskCounter'));
        let wSave = await new Roll('d20').evaluate();
        let actorName = actor.data.name.capitalize()
        
        actor.unsetFlag(moduleName, 'woundRiskCounter')
        
        if (wSave.total < saveTest) {
            ChatMessage.create({
                content: wounds.format("gandg.GreatWoundDialogFailMessage", {
                    actorName: actorName,
                    gwFeatureName: 'wound',
                }),
            });
            //create active effect
            await game.dfreds.effectInterface.addEffect({effectName: 'Open Wound', uuid: actor.uuid })
            await game.dfreds.effectInterface.addEffect({effectName: 'Bleeding', uuid: actor.uuid })
        } else {
            ChatMessage.create({
                content: wounds.format("gandg.GreatWoundDialogSuccessMessage", {
                    actorName: actorName,
                    gwFeatureName: 'wound',
                }),
            });
        }

    }

    static woundSocket(socketData) {
        if (!socketData.wound) return
        //Rolls Saves for owned tokens
        let actor = game.actors.get(socketData.actorId);
        for (const [key, value] of Object.entries(socketData.users)) {
            if (value === 3 && game.users.get(`${key}`).data.role !== 4) {
                if (game.user.data._id === `${key}`) {
                    GreatWound.drawWound(actor);
                }
            }

        }

    }
    static format(...args){
        return game.i18n.format(...args);
    }
    static localize(...args){
        return game.i18n.localize(...args);
    }
}
class injuries {
    /*
    trigger for falling from wounds
    injury triggers
    unconscious due to wounds or damage
    fail wound confirmation check by 10 or more
    suffer critical hit and attacker makes a second attack roll
    */
}   




Hooks.on(`setup`, () => {
    wounds.hooks();
});

Hooks.once('init', async function() {
    console.log('gandg combat | initialize')

});
