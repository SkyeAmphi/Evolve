import CustomLab from './components/CustomLab.vue';

/**
 * mount custom lab Vue3 app into container element
 * @param {Element|jQuery} container - DOM or *puke* jQuery(gross)(yuck) element to append the lab into
 * @param {boolean} hybrid - true to make a hybrid race, false for regular
 * @param {boolean} isWiki - true when rendering in the wiki (no Create button)
 * still need to add param for wiki sandboxMode
 */
export function initCustomLab(container, hybrid, isWiki) {
    const containerEl = container instanceof Element ? container : container[0];

    const el = document.createElement('div');
    el.className = 'celestialLab';
    containerEl.appendChild(el);

    if (!isWiki) {
        document.getElementById('main')?.classList.add('custom-lab-active');
    }

    const app = Vue.createApp(CustomLab, { hybrid, isWiki });
    app.use(Buefy.default);
    app.mount(el);
    return app;
}
