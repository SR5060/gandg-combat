import { wounds } from './wounds.js';

Hooks.on(`setup`, () => {
    wounds.hooks();
});

Hooks.once('init', async function() {
    console.log('gandg combat | initialize')

});