
const moduleName = 'gandg-combat'

export class wounds {
    static register() {
        wounds.hooks();
    }

    static hooks() {
        Hooks.on("ready", () => {
            game.socket.on(`module.gandg-combat`, wounds.woundSocket);
        });     
        Hooks.on('createCombatant', wounds.createTracker);
        Hooks.on('updateCombat', wounds.checkCombatTrigger);
        Hooks.on("midi-qol.AttackRollComplete", injuries.critAttack)
        Hooks.on("preUpdateActor", wounds.preUpdateActor);
        Hooks.on("deleteCombat", injuries.injuryAdjudication);
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
        if (combat.combatant?.actor?.testUserPermission(game.user, "OWNER")) {
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
    }

    static preUpdateActor(actor, update) {
        let hp = getProperty(update, "data.attributes.hp.value");
        if (hp <= 0 && actor.hasPlayerOwner) {
            injuries.addInjuryToken(actor);
        } else if (hp !== undefined && actor.hasPlayerOwner) {
            wounds.calculation(actor, update);
        }
    }



    
    static calculation(actor, update) {
        let data = {

            actorConMod: actor.data.data.abilities.con.mod,
            hpChange: (actor.data.data.attributes.hp.value - (hasProperty(update, "data.attributes.hp.value") ? update.data.attributes.hp.value : actor.data.data.attributes.hp.value))

        };

        let woundRiskCounter;

        //effectively cause automatic fail due to massive damage 
        if (data.hpChange >= 2 * (12 + data.actorConMod)) {
            woundRiskCounter = 20
            return actor.setFlag(moduleName, 'woundRiskCounter', woundRiskCounter)
        } else if (data.hpChange >= 12 + data.actorConMod) {
            woundRiskCounter = actor.getFlag(moduleName, 'woundRiskCounter') 
            if (!woundRiskCounter) {
                woundRiskCounter = 1 
            } else { 
                woundRiskCounter ++
            };
            return actor.setFlag(moduleName, 'woundRiskCounter', woundRiskCounter);
        }
    }

    static async drawWound(actor) {
        const saveTest = 12 + (2 * actor.getFlag(moduleName, 'woundRiskCounter'));
        let wSave = await new Roll('d20').evaluate();
        await wSave.toMessage();
        
        let actorName = actor.data.name.capitalize()
        
        actor.unsetFlag(moduleName, 'woundRiskCounter')
        
        if (wSave.total < saveTest) {
            if (wSave.total + 9 < saveTest) {
                injuries.critWoundFailCalc(actor, actorName, saveTest);
    
            } else {ChatMessage.create({
                content: wounds.format("gandg.GreatWoundDialogFailMessage", {
                    actorName: actorName,
                    gwFeatureName: 'wound',
                    saveTest: saveTest,
                }),
            })};
            //create active effect
            let openWoundUpdated = false
            let bleedingUpdated = false
            let effectLabel
            let counters = ActiveEffectCounter.getCounters(actor)
            for (const effectEntity of actor.effects) {
                if (effectEntity.data.label === "Open Wound") {
                    openWoundUpdated = true;
                    effectLabel = effectEntity.data.icon
                    //create counter
                    let effectCounters = counters.find( ({path}) => path === effectLabel)
                        if (effectCounters) {
                            await effectCounters.setValue(effectCounters.getValue() + 1)
                        }
                    } else if (effectEntity.data.label === "Bleeding") {
                    bleedingUpdated = true;
                    effectLabel = effectEntity.data.icon
                    //create counter
                    let effectCounters = counters.find( ({path}) => path === effectLabel)
                        if (effectCounters) {
                            await effectCounters.setValue(effectCounters.getValue() + 1)
                        }       
                }
              }
            if (!openWoundUpdated) {
                await game.dfreds.effectInterface.addEffect({effectName: 'Open Wound', uuid: actor.uuid })
            };
            if (!bleedingUpdated) {
                await game.dfreds.effectInterface.addEffect({effectName: 'Bleeding', uuid: actor.uuid })
            }

            let openWoundCount = actor.data.effects.filter(i => i.data.label === 'Open Wound').length
            
            if (openWoundCount > Math.ceil(actor.data.data.details.level/2) + actor.data.data.abilities.con.mod) {
                await game.dfreds.effectInterface.addEffect({effectName: 'Unconscious', uuid: actor.uuid, overlay: true})
                injuries.addInjuryToken(actor);
            };
            
        } else {
            ChatMessage.create({
                content: wounds.format("gandg.GreatWoundDialogSuccessMessage", {
                    actorName: actorName,
                    gwFeatureName: 'wound',
                    saveTest: saveTest,
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
};

export class injuries {

    static critWoundFailCalc(actor, actorName, saveTest) {
        ChatMessage.create({
            content: wounds.format("gandg.GreatWoundDialogCritFailMessage",{
                actorName: actorName,
                gwFeatureName: 'wound',
                saveTest: saveTest,
            }),  
        });
        //injury token due to critical wound fail
        injuries.addInjuryToken(actor);
    }
    
    static addInjuryToken(actor) {
        let injuryToken = actor.getFlag(moduleName, 'injuryToken') 
            if (!injuryToken) {
                injuryToken = 1
                return actor.setFlag(moduleName, 'injuryToken', injuryToken);
            } else { 
                injuryToken ++
                return actor.setFlag(moduleName, 'injuryToken', injuryToken);
            };
    }   

    static critAttack(workflow) {
        if (workflow.isCritical && !workflow.actor.hasPlayerOwner) {
            let targetArray = Array.from(workflow.targets)
            let actor = workflow.actor
            injuries.critCalculation(workflow, targetArray, actor)
        }
        
    }

    static async critCalculation(workflow, targetArray, actor) {
        if(game.user.data.role !== 4 || actor.hasPlayerOwner) return

        const attackRoll = workflow.attackRoll.formula;
        new Dialog({
            title: wounds.format("gandg.critInjuryDialogTitle", { gwFeatureName: 'crit injury', NPCName: actor.name }),
            content: wounds.format("gandg.critInjuryDialogContents"),
            buttons: {
                one: {
                    label: wounds.localize("gandg.Default_roll"),
                    callback: () => {
                        /** draw locally if we are the one prompting the change OR if not owned by any players */
                            injuries.critConfirmation(attackRoll, targetArray)
                    }
                },
                two: {
                    label: wounds.localize("gandg.Default_critrollcancel"),
                    click: () => {}
                }
            }
        }).render(true)
    }

    static async critConfirmation(attackRoll, targetArray) {

        let critConfAttack = await new Roll(attackRoll).evaluate()
        let critConfValue = critConfAttack.total;
        await critConfAttack.toMessage();
        let impactedActors = []
        for (let target of targetArray) {
            if (critConfValue >= target.document._actor.data.data.attributes.ac.value) {
                impactedActors.push(target.data.name.capitalize());
                let targetActor = game.actors.get(target.data.actorId);
                injuries.addInjuryToken(targetActor);
            }
        } 

        let actorNames = impactedActors.join(", ")
        if (actorNames.length > 0) {
            ChatMessage.create({
                content: wounds.format("gandg.critResults", {
                    actorNames: actorNames,
                    gwFeatureName: 'wound',
                    saveTest: critConfValue,
                    }),
                });
            }
        }

    static injuryAdjudication(combat) {
        let injuredActors = []
        combat.combatants.forEach(combatant => {
            if (combatant.actor.data?.flags["gandg-combat"]?.woundRiskCounter)
            return combatant.actor.unsetFlag(moduleName, 'woundRiskCounter');
            
            if (combatant.actor.data?.flags["gandg-combat"]?.injuryToken)
            injuredActors.push(`${combatant.actor.data.name.capitalize()} with ${combatant.actor.data?.flags["gandg-combat"]?.injuryToken} injury tokens`)
            return combatant.actor.unsetFlag(moduleName, 'injuryToken');
        });  
        let injuredActorMessage = injuredActors.join(" AND ")
        if (injuredActorMessage.length > 0) {
            ChatMessage.create({
                content: wounds.format("gandg.injuryAdjudication", {
                    injuredActors: injuredActorMessage
                    }),
                });
            }
    }
} 

