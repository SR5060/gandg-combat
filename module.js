import { wounds } from './scripts/Wounds.js';

Hooks.on(`setup`, () => {
    wounds.hooks();
});

Hooks.once('init', async function() {
    console.log('gandg combat | initialize')

})

