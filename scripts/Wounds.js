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
                    title: MODULE.format("gandg.GreatWoundDialogTitle", { gwFeatureName: gwFeatureName, actorName: actor.name }),
                    content: MODULE.format("gandg.GreatWoundDialogContents", { actorName: actor.name, DC: (woundRiskCounter + 12) }),
                    buttons: {
                        one: {
                            label: MODULE.localize("gandg.Default_roll"),
                            callback: () => {
                                /** draw locally if we are the one prompting the change OR if not owned by any players */
                                if (game.user.data.role !== 4 || !actor.hasPlayerOwner) {
                                    wounds.drawWound(actor);
                                    return;
                                }
                                const socketData = {
                                    users: actor.data._source.permission,
                                    actorId: actor.id,
                                    greatwound: true,
                                    hp: data.updateHP,
                                }
                                game.socket.emit(`gandg.dnd5e-helpers`, socketData)
                            }
                        }
                    }
                }).render(true)
            }
            
        }
    }

    static async drawWound(actor) {
        const gwFeatureName = MODULE.setting("GreatWoundFeatureName");
        const saveTest = 12 + 2 * actor.getFlag(moduleName, 'woundRiskCounter');
        let wSave = await new roll('d20').evaluate();
        let sanitizedTokenName = MODULE.sanitizeTokenName(actor, "GreatAndOpenWoundMaskNPC", "gwFeatureName")
        if (wSave.total < saveTest) {
            const greatWoundTable = MODULE.setting("GreatWoundTableName");
            ChatMessage.create({
                content: MODULE.format("DND5EH.GreatWoundDialogFailMessage", {
                    actorName: sanitizedTokenName,
                    gwFeatureName: gwFeatureName,
                }),
            });
            if (greatWoundTable !== "") {
                let { results } = await game.tables
                    .getName(greatWoundTable)
                    .draw({ roll: null, results: [], displayChat: true });
                if (MODULE.setting("GreatWoundItemSetting") != '0') {
                    GreatWound.itemResult(actor, results)
                }
            } else {
                ChatMessage.create({
                    content: MODULE.format("DND5EH.GreatWoundDialogError", {
                        gwFeatureName: gwFeatureName,
                    }),
                });
            }
        } else {
            ChatMessage.create({
                content: MODULE.format("DND5EH.GreatWoundDialogSuccessMessage", {
                    actorName: sanitizedTokenName,
                    gwFeatureName: gwFeatureName,
                }),
            });
        }

    }

    static woundSocket(socketData) {
        if (!socketData.greatwound && socketData.hp > 0) return
        //Rolls Saves for owned tokens
        let actor = game.actors.get(socketData.actorId);
        for (const [key, value] of Object.entries(socketData.users)) {
            if (value === 3 && game.users.get(`${key}`).data.role !== 4) {
                if (game.user.data._id === `${key}`) {
                    GreatWound.drawWound(actor);
                }
            }

        }
        if (socketData.hp === 0 && MODULE.setting("OpenWounds0HPGW")) {
            const gwFeatureName = MODULE.setting("GreatWoundFeatureName");
            DnDWounds.OpenWounds(
                actor,
                MODULE.format("DND5EH.OpenWoundSocketMessage", {
                    gwFeatureName: gwFeatureName,
                })
            );
        }
    }
}
     

/*
hook on updateActor
did hp change more than conmod + 12?
look for flag on actor combatant for active scene
add counter


Hooks.on(`setup`, () => {
    wounds.hooks();
});

Hooks.once('init', async function() {
    console.log('gandg combat | initialize')
*/

