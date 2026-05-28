import { clearElement } from './../functions.js';
import { crisprPage } from './crispr.js';
import { bloodPage } from './blood.js';
import { pResPage } from './p_res.js';
import { resetsPage } from './resets.js';
import { perksPage } from './perks.js';

const pageBuilders = {
    resets:    resetsPage,
    resources: pResPage,
    crispr:    crisprPage,
    blood:     bloodPage,
    perks:     perksPage,
};

const pageCache = new Map();
const zoneFlexState = new Map(); // tracks whether each zone's builder adds 'flex' to #content

export function prestigePage(zone) {
    const content = $(`#content`);
    const sentinel = content.find('#prestige-sentinel');
    const isPrestigeContentLive = sentinel.length > 0;

    if (isPrestigeContentLive) {
        // another Prestige section is still mounted; detach it to cache it while preserving Vue apps
        const currentZone = sentinel.data('zone');
        pageCache.set(currentZone, content.children().detach());
    } else {
        // content was cleared by a non-prestige page, or this is the first visit
        clearElement(content);
    }

    if (pageCache.has(zone)) {
        content.append(pageCache.get(zone));
        // some zones (resets, resources) add 'flex' to #content via sideMenu; restore it
        if (zoneFlexState.get(zone)) content.addClass('flex');
        return;
    }

    pageBuilders[zone]?.(content);

    // record whether this zone's builder added 'flex' to #content (menuDispatch strips it on every nav)
    zoneFlexState.set(zone, content.hasClass('flex'));

    // appended so we can detect on the next nav that this content is still here and we don't need to redraw it
    content.append(`<span id="prestige-sentinel" data-zone="${zone}" style="display:none"></span>`);
}