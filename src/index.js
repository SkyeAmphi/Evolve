import { global, tmp_vars, save, message_logs, message_filters, webWorker } from './vars.js';
import { loc, locales, updateHtmlLang } from './locale.js';
import { setupStats, alevel } from './achieve.js';
import { vBind, initMessageQueue, clearElement, flib, tagEvent, gameLoop, popover, clearPopper, powerGrid, easterEgg, trickOrTreat, drawIcon } from './functions.js';
import { initResourceTabs, drawResourceTab, tradeSummary } from './resources.js';
import { defineJobs, } from './jobs.js';
import { clearSpyopDrag } from './governor.js';
import { defineIndustry, setPowerGrid, gridDefs, clearGrids } from './industry.js';
import { defineGovernment, defineGarrison, buildGarrison, commisionGarrison, foreignGov } from './civics.js';
import { races, shapeShift, renderPsychicPowers, renderSupernatural } from './races.js';
import { drawEvolution, drawCity, drawTech, resQueue, clearResDrag, closeModalAnim } from './actions.js';
import { renderSpace, ascendLab, terraformLab } from './space.js';
import { renderFortress, buildFortress, drawMechLab, clearMechDrag, drawHellObservations } from './portal.js';
import { renderEdenic } from './edenic.js';
import { drawShipYard, clearShipDrag, renderTauCeti } from './truepath.js';
import { arpa, clearGeneticsDrag } from './arpa.js';
import { themes, set_theme, theme_settings, loadCustomThemeHTML, createAllThemeDropdowns, setThemeToHTML, loadThemeEditorDat, importTheme, getThemeSaveData, getThemeTitle } from './themes.js';

import SeasonHunt from './components/SeasonHunt.vue';
import InitBody from './components/InitBody.vue';

export function mainVue(){
    ['1','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17'].forEach(function(k){
        popover(`settings${k}`, function(){
                return loc(`settings${k}`);
            },
            {
                elm: `#settings span.settings${k}`
            }
        );
    });

    let example = `<div class="example">{
  "year": "Galactic Standard Year",
  "resource_Food_name": "Nom Noms"
}</div>`;

    popover(`stringPack`, function(){
            return loc(`string_example`,[example]);
        }
    );
}

export function tabLabel(lbl){
    switch (lbl){
        case 'city':
            if (global.resource[global.race.species]){
                if (global.resource[global.race.species].amount <= 5){
                    return loc('tab_city1');
                }
                else if (global.resource[global.race.species].amount <= 20){
                    return loc('tab_city2');
                }
                else if (global.resource[global.race.species].amount <= 75){
                    return loc('tab_city3');
                }
                else if (global.resource[global.race.species].amount <= 250){
                    return loc('tab_city4');
                }
                else if (global.resource[global.race.species].amount <= 600){
                    return loc('tab_city5');
                }
                else if (global.resource[global.race.species].amount <= 1200){
                    return loc('tab_city6');
                }
                else if (global.resource[global.race.species].amount <= 2500){
                    return loc('tab_city7');
                }
                else {
                    return loc('tab_city8');
                }
            }
            else {
                return loc('tab_city1');
            }
        case 'local_space':
            return loc('sol_system',[global.race['truepath'] ? races[global.race.species].home : flib('name')]);
        case 'outer_local_space':
            return loc('outer_sol_system',[global.race['truepath'] ? races[global.race.species].home : flib('name')])
        case 'old':
            return loc('tab_old_res');
        case 'new':
            return loc('tab_new_res');
        case 'old_sr':
            return loc('tab_old_sr_res');
        case 'new_sr':
            return loc('tab_new_sr_res');
        case 'tab_mech':
            return global.race['warlord'] ? loc('tab_artificer')  : loc(lbl);
        default:
            return loc(lbl);
    }
}

export function initTabs() {
    if (global.settings.tabLoad) {
        if (global.race.species === 'protoplasm') {
            drawEvolution();
        }
        loadTab(`mTabCivil`);
        loadTab(`mTabCivic`);
        loadTab(`mTabResearch`);
        loadTab(`mTabResource`);
        loadTab(`mTabArpa`);
        loadTab(`mTabStats`);
        loadTab(`mTabObserve`);
    } else {
        loadTab(global.settings.civTabs);
    }
}

//For now I (The1stBurb) will leave this alone and not fully put everything into the components/mainTabs/*Tab.vue files
//as it will depend on how preload is handled and other decisions!
export function loadTab(tab){
    if (!global.settings.tabLoad) {
        clearResDrag();
        clearGrids();
        clearMechDrag();
        clearGeneticsDrag();
        clearSpyopDrag();
        clearShipDrag();
        if (global.tabClearTimeout) {
            clearTimeout(global.tabClearTimeout);
        }
        let tabsToClear = [
            `mTabCivil`,
            `mTabCivic`,
            `mTabResearch`,
            `mTabResource`,
            `mTabArpa`,
            `mTabStats`,
            `mTabObserve`,
        ];
        // identify the incoming tab so we can clear it immediately
        // and delay clearing all others to allow the outgoing animation to finish
        let incoming = 'mTabObserve';
        switch (tab) {
            case 1:
            case 'mTabCivil':
                incoming = 'mTabCivil';
                break;
            case 2:
            case 'mTabCivic':
                incoming = 'mTabCivic';
                break;
            case 3:
            case 'mTabResearch':
                incoming = 'mTabResearch';
                break;
            case 4:
            case 'mTabResource':
                incoming = 'mTabResource';
                break;
            case 5:
            case 'mTabArpa':
                incoming = 'mTabArpa';
                break;
            case 6:
            case 'mTabStats':
                incoming = 'mTabStats';
                break;
        }

        // clear incoming tab immediately so old Vue apps don't block re-mount
        clearElement($(`#${incoming}`));
        tabsToClear.splice(tabsToClear.indexOf(incoming), 1);
        global.tabClearTimeout = setTimeout(() => {
            tabsToClear.forEach((t) => clearElement($(`#${t}`)));
        }, 350);
    } else {
        tagEvent('page_view', { page_title: `Evolve - All Tabs` });
    }
    switch (tab){
        case 0:
        case 'evolution':
            if (!global.settings.tabLoad) {
                global.settings.civTabs = 0;
                tagEvent('page_view', { page_title: `Evolve - Evolution` });
                drawEvolution();
            }
            break;
        case 1:
        case 'mTabCivil':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Civilization` });
                }
                $(`#mTabCivil`).append(`<b-tabs class="resTabs" v-model="s.spaceTabs" :animated="s.animated" @update:model-value="swapTab($event)">
                    <b-tab-item id="city" :visible="s.showCity" :label="label('city')"></b-tab-item>
                    <b-tab-item id="space" :visible="s.showSpace" :label="label('local_space')"></b-tab-item>
                    <b-tab-item id="interstellar" :visible="s.showDeep" :label="label('tab_interstellar')"></b-tab-item>
                    <b-tab-item id="galaxy" :visible="s.showGalactic" :label="label('tab_galactic')"></b-tab-item>
                    <b-tab-item id="portal" :visible="s.showPortal" :label="label('tab_portal')"></b-tab-item>
                    <b-tab-item id="outerSol" :visible="s.showOuter" :label="label('outer_local_space')"></b-tab-item>
                    <b-tab-item id="tauceti" :visible="s.showTau" :label="label('tab_tauceti')"></b-tab-item>
                    <b-tab-item id="eden" :visible="s.showEden" :label="label('tab_eden')"></b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#mTabCivil`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        swapTab(tab){
                            global.settings.spaceTabs = tab;
                            if (!global.settings.tabLoad){
                                if (global.spaceTabClearTimeout)
                                    clearTimeout(global.spaceTabClearTimeout);

                                let tabs = [
                                    "city",
                                    "space",
                                    "interstellar",
                                    "galaxy",
                                    "portal",
                                    "outerSol",
                                    "tauCeti",
                                    "eden",
                                ];

                                let incoming = tabs[tab];
                                clearElement($(`#${incoming}`));
                                tabs.splice(tab, 1);

                                global.spaceTabClearTimeout = setTimeout(() => {
                                    tabs.forEach((t) => clearElement($(`#${t}`)));
                                }, 350);

                                switch (tab){
                                    case 0:
                                        drawCity();
                                        break;
                                    case 1:
                                    case 2:
                                    case 3:
                                    case 5:
                                        renderSpace();
                                        break;
                                    case 4:
                                        renderFortress();
                                        break;
                                    case 6:
                                        renderTauCeti();
                                        break;
                                    case 7:
                                        renderEdenic();
                                        break;
                                }
                            }
                            return tab;
                        },
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                if (global.race.species !== 'protoplasm'){
                    drawCity();
                    renderSpace();
                    renderFortress();
                    renderTauCeti();
                    renderEdenic();
                }
                if (global.race['noexport']){
                    if (global.race['noexport'] === 'Race'){
                        clearElement($(`#city`));
                        ascendLab();
                    }
                    else if (global.race['noexport'] === 'Hybrid'){
                        clearElement($(`#city`));
                        ascendLab(true);
                    }
                    else if (global.race['noexport'] === 'Planet'){
                        clearElement($(`#city`));
                        terraformLab();
                    }
                }
            }
            break;
        case 2:
        case 'mTabCivic':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Civics` });
                }
                $(`#mTabCivic`).append(`<b-tabs class="resTabs" v-model="s.govTabs" :animated="s.animated" @update:model-value="swapTab(s.govTabs)">
                    <b-tab-item id="civic" :label="label('tab_gov')"></b-tab-item>
                    <b-tab-item id="industry" class="industryTab" :visible="s.showIndustry" :label="label('tab_industry')"></b-tab-item>
                    <b-tab-item id="powerGrid" class="powerGridTab" :visible="s.showPowerGrid" :label="label('tab_power_grid')"></b-tab-item>
                    <b-tab-item id="military" class="militaryTab" :visible="s.showMil" :label="label('tab_military')"></b-tab-item>
                    <b-tab-item id="mechLab" class="mechTab" :visible="s.showMechLab" :label="label('tab_mech')"></b-tab-item>
                    <b-tab-item id="dwarfShipYard" class="ShipYardTab" :visible="s.showShipYard" :label="label('tab_shipyard')"></b-tab-item>
                    <b-tab-item id="psychicPowers" class="psychicTab" :visible="s.showPsychic" :label="label('tab_psychic')"></b-tab-item>
                    <b-tab-item id="supernatural" class="supernaturalTab" :visible="s.showWish" :label="label('tab_supernatural')"></b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#mTabCivic`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        swapTab(tab){
                            if (!global.settings.tabLoad){
                                clearGrids();
                                clearSpyopDrag();
                                clearMechDrag();
                                clearShipDrag();

                                if (global.civicTabClearTimeout)
                                    clearTimeout(global.civicTabClearTimeout);

                                let tabs = [
                                    "civic",
                                    "industry",
                                    "powerGrid",
                                    "military",
                                    "mechLab",
                                    "dwarfShipYard",
                                    "psychicPowers",
                                    "supernatural",
                                ];

                                let incoming = tabs[tab];
                                clearElement($(`#${incoming}`));
                                tabs.splice(tab, 1);

                                global.civicTabClearTimeout = setTimeout(() => {
                                    tabs.forEach((t) => clearElement($(`#${t}`)));
                                }, 350);

                                switch (tab){
                                    case 0:
                                        {
                                            $('#civic').append($('<div id="civics" class="tile is-parent"></div>'));
                                            defineJobs();
                                            $('#civics').append($('<div id="r_civics" class="tile is-vertical is-parent civics"></div>'));
                                            defineGovernment();
                                            if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                                commisionGarrison();
                                                buildGarrison($('#c_garrison'),false);
                                                foreignGov();
                                            }
                                            if (global.race['shapeshifter']){
                                                shapeShift(false,true);
                                            }
                                        }
                                        break;
                                    case 1:
                                        defineIndustry();
                                        break;
                                    case 2:
                                        {
                                            Object.keys(gridDefs()).forEach(function(gridtype){
                                                powerGrid(gridtype);
                                            });
                                            setPowerGrid();
                                        }
                                        break;
                                    case 3:
                                        if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                            defineGarrison();
                                            if (!global.race['warlord']){
                                                buildFortress($('#fortress'),false);
                                            }
                                        }
                                        break;
                                    case 4:
                                        if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                            drawMechLab();
                                        }
                                        break;
                                    case 5:
                                        if (global.race['truepath'] && global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                                            drawShipYard();
                                        }
                                        break;
                                    case 6:
                                        if (global.race['psychic'] && global.tech['psychic'] && global.race.species !== 'protoplasm'){
                                            renderPsychicPowers();
                                        }
                                        break;
                                    case 7:
                                        if (((global.race['wish'] && global.tech['wish']) || global.race['ocular_power']) && global.race.species !== 'protoplasm'){
                                            renderSupernatural();
                                        }
                                        break;
                                }
                            }
                            return tab;
                        },
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });

                Object.keys(gridDefs()).forEach(function(gridtype){
                    powerGrid(gridtype);
                });
                setPowerGrid();

                $('#civic').append($('<div id="civics" class="tile is-parent"></div>'));
                defineJobs();
                $('#civics').append($('<div id="r_civics" class="tile is-vertical is-parent civics"></div>'));
                defineGovernment();
                if (global.race.species !== 'protoplasm' && !global.race['start_cataclysm']){
                    defineGarrison();
                    buildGarrison($('#c_garrison'),false);
                    if (!global.race['warlord']){
                        buildFortress($('#fortress'),false);
                    }
                    foreignGov();
                    drawMechLab();
                    if (global.race['truepath']){
                        drawShipYard();
                    }
                    if (global.race['psychic'] && global.tech['psychic']){
                        renderPsychicPowers();
                    }
                    if ((global.race['wish'] && global.tech['wish']) || global.race['ocular_power']){
                        renderSupernatural();
                    }
                }
                if (global.race['shapeshifter']){
                    shapeShift(false,true);
                }
                defineIndustry();
            }
            break;
        case 3:
        case 'mTabResearch':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Research` });
                }
                let queue_and_tabs = $(`<div id="resQueue" class="resQueue" v-show="rq.display"></div><div id="resContent"><b-tabs class="resTabs" v-model="s.resTabs" :animated="s.animated">
                    <b-tab-item id="tech" :label="label_f('new')"></b-tab-item>
                    <b-tab-item id="oldTech" :label="label_f('old')"></b-tab-item>
                </b-tabs></div>`);
                $(`#mTabResearch`).append(queue_and_tabs);
                vBind({
                    el: `#resContent`,
                    data: {
                        s: global.settings,
                        rq: global.r_queue
                    },
                    methods: {
                        label_f(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                resQueue();
                if (global.race.species !== 'protoplasm'){
                    drawTech();
                }
            }
            break;
        case 4:
        case 'mTabResource':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Resources` });
                }
                $(`#mTabResource`).append(`<b-tabs class="resTabs" v-model="s.marketTabs" :animated="s.animated" @update:model-value="swapTab(s.marketTabs)">
                    <b-tab-item id="market" :visible="s.showMarket" :label="label('tab_market')"></b-tab-item>
                    <b-tab-item id="resStorage" :visible="s.showStorage" :label="label('tab_storage')"></b-tab-item>
                    <b-tab-item id="resEjector" :visible="s.showEjector" :label="label('tab_ejector')"></b-tab-item>
                    <b-tab-item id="resCargo" :visible="s.showCargo" :label="label('tab_cargo')"></b-tab-item>
                    <b-tab-item id="resAlchemy" :visible="s.showAlchemy" :label="label('tab_alchemy')"></b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#mTabResource`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        swapTab(tab) {
                            if (!global.settings.tabLoad) {
                                // clear and redraw each tab on demand with preload off
                                if (global.resTabClearTimeout) clearTimeout(global.resTabClearTimeout);

                                let tabs = ['market', 'resStorage', 'resEjector', 'resCargo', 'resAlchemy'];
                                tabs.splice(tab, 1);
                                global.resTabClearTimeout = setTimeout(() => {
                                    tabs.forEach(t => clearElement($(`#${t}`)));
                                }, 350);

                                const tabMap = ['market', 'storage', 'ejector', 'supply', 'alchemy'];
                                const tabName = tabMap[tab];
                                if (tabName) {
                                    drawResourceTab(tabName);
                                }
                            }
                            // do nothing for preload on, Vue will handle display with v-show
                            return tab;
                        },
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });

                initResourceTabs();
                tradeSummary();
            }
            break;
        case 5:
        case 'mTabArpa':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Arpa` });
                }
                $(`#mTabArpa`).append(`<div id="apra" class="arpa">
                    <b-tabs class="resTabs" v-model="s.arpa.arpaTabs" :animated="s.animated">
                        <b-tab-item id="arpaPhysics" :visible="s.arpa.physics" label="${loc('tab_arpa_projects')}"></b-tab-item>
                        <b-tab-item id="arpaGenetics" :visible="s.arpa.genetics" label="${loc(global.race['artifical'] ? 'tab_arpa_machine' : 'tab_arpa_genetics')}"></b-tab-item>
                        <b-tab-item id="arpaCrispr" :visible="s.arpa.crispr" label="${loc('tab_arpa_crispr')}"></b-tab-item>
                        <b-tab-item id="arpaBlood" :visible="s.arpa.blood" label="${loc('tab_arpa_blood')}"></b-tab-item>
                    </b-tabs>
                </div>`);
                vBind({
                    el: `#mTabArpa`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                arpa('Physics');
                arpa('Genetics');
                arpa('Crispr');
                arpa('Blood');
            }
            break;
        case 6:
        case 'mTabStats':
            {
                if (!global.settings.tabLoad){
                    tagEvent('page_view',{ page_title: `Evolve - Stats` });
                }
                $(`#mTabStats`).append(`<b-tabs class="resTabs" v-model="s.statsTabs" :animated="s.animated">
                    <b-tab-item id="stats" :label="label('tab_stats')"></b-tab-item>
                    <b-tab-item id="achieve" :label="label('tab_achieve')"></b-tab-item>
                    <b-tab-item id="perks" :label="label('tab_perks')"></b-tab-item>
                </b-tabs>`);
                vBind({
                    el: `#mTabStats`,
                    data: {
                        s: global.settings
                    },
                    methods: {
                        label(lbl){
                            return tabLabel(lbl);
                        }
                    }
                });
                setupStats();
            }
            break;
        case 7:
            if (!global.settings.tabLoad){
                tagEvent('page_view',{ page_title: `Evolve - Settings` });
            }
            break;
        case 'mTabObserve':
        default:
            if (!global.settings.tabLoad){
                tagEvent('page_view',{ page_title: `Evolve - Hell Observation` });
            }
            if (global.portal.observe){
                drawHellObservations(true);
            }
            break;
    }
    if ($(`#popper`).length > 0 && $(`#${$(`#popper`).data('id')}`).length === 0){
        clearPopper();
    }
}

export function index(){
    clearElement($('body'));

    $('html').addClass(global.settings.font);
    $('body').append(`<init-body />`)
    vBind({
        el: 'body',
        components: { InitBody, },
    });

    popover('race',
        function(){
            return typeof races[global.race.species].desc === 'string' ? races[global.race.species].desc : races[global.race.species].desc();
        },{
            elm: '#race > .name'
        }
    );

    vBind({
        el: `#msgQueue`,
        data: {
            m: message_logs,
            s: global.settings.msgFilters
        },
        methods: {
            swapFilter(filter){
                if (message_logs.view !== filter){
                    $(`#msgQueueFilter-${message_logs.view}`).removeClass('is-active').attr('aria-disabled', 'false');
                    $(`#msgQueueFilter-${filter}`).addClass('is-active').attr('aria-disabled', 'true');
                    message_logs.view = filter;
                    let queue = $(`#msgQueueLog`);
                    clearElement(queue);
                    message_logs[filter].forEach(function (msg){
                        queue.append($('<p class="has-text-'+msg.color+'"></p>').text(msg.msg));
                    });
                    console.log(message_logs);
                }
            },
            clearLog(filter){
                filter = filter ? [filter] : filter;
                initMessageQueue(filter);
                clearElement($(`#msgQueueLog`));
                if (filter){
                    global.lastMsg[filter] = [];
                }
                else {
                    Object.keys(global.lastMsg).forEach(function (tag){
                        global.lastMsg[tag] = [];
                    });
                }
            },
            trigModal(){
                this.$buefy.modal.open({
                    hasModalCard: false,
                    customClass: 'evolve-modal',
                    content: '<div id="modalBox" class="modalBox"></div>',
                    onCancel: () => closeModalAnim() // Modal closed
                });

                let checkExist = setInterval(function(){
                    if ($('#modalBox').length > 0){
                        clearInterval(checkExist);
                        let egg16 = easterEgg(16,12);
                        $('#modalBox').append($(`<p id="modalBoxTitle" class="has-text-warning modalTitle">${loc('message_log')}${egg16.length > 0 ? egg16 : ''}</p>`));

                        var body = $('<div id="specialModal" class="modalBody vscroll"></div>');
                        $('#modalBox').append(body);
                        
                        let catVis = $(`
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_visible')}</span>
                                </div>
                            </div>
                        `);
                        let catMax = $(`
                            <hr>
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_length')}</span>
                                </div>
                            </div>
                        `);
                        let catSave = $(`
                            <hr>
                            <div>
                                <div>
                                    <span class="has-text-warning">${loc('message_log_settings_save')}</span>
                                </div>
                            </div>
                        `);
                        body.append(catVis);
                        body.append(catMax);
                        body.append(catSave);
                        
                        let visSet = ``;
                        let maxSet = ``;
                        let saveSet = ``;
                        
                        let maxInputs = {};
                        let saveInputs = {};
                        message_filters.forEach(function (filter){
                            visSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-checkbox class="patrol" v-model="s.${filter}.vis" :disabled="checkDisabled('${filter}',s.${filter}.vis)" :input="check('${filter}')"></b-checkbox></div>`;
                            maxSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-numberinput :input="maxVal('${filter}')" min="1" v-model="mi.${filter}" :controls="false"></b-numberinput></div>`;
                            saveSet += `<div class="msgInput" v-show="s.${filter}.unlocked"><span>${loc('message_log_' + filter)}</span> <b-numberinput :input="saveVal('${filter}')" min="0" :max="s.${filter}.max" v-model="si.${filter}" :controls="false"></b-numberinput></div>`;
                            
                            maxInputs[filter] = global.settings.msgFilters[filter].max;
                            saveInputs[filter] = global.settings.msgFilters[filter].save;
                        });
                        catVis.append(visSet);
                        catMax.append(maxSet);
                        catSave.append(saveSet);
                        catMax.append(`
                            <div class="msgInputApply">
                                <button class="button" @click="applyMax()">${loc('message_log_settings_apply')}</button>
                            </div>
                        `);
                        catSave.append(`
                            <div class="msgInputApply">
                                <button class="button" @click="applySave()">${loc('message_log_settings_apply')}</button>
                            </div>
                        `);
                        
                        
                        vBind({
                            el: `#specialModal`,
                            data: {
                                s: global.settings.msgFilters,
                                mi: maxInputs,
                                si: saveInputs
                            },
                            methods: {
                                check(filter){
                                    if (!global.settings.msgFilters[filter].vis && message_logs.view === filter){
                                       let haveVis = false;
                                        Object.keys(global.settings.msgFilters).forEach(function (filt){
                                            if (global.settings.msgFilters[filt].vis && !haveVis){
                                                haveVis = true;
                                                $(`#msgQueueFilter-${message_logs.view}`).removeClass('is-active');
                                                $(`#msgQueueFilter-${filt}`).addClass('is-active');
                                                message_logs.view = filt;
                                                let queue = $(`#msgQueueLog`);
                                                clearElement(queue);
                                                message_logs[filt].forEach(function (msg){
                                                    queue.append($('<p class="has-text-'+msg.color+'"></p>').text(msg.msg));
                                                });
                                            }
                                        });
                                    }
                                },
                                checkDisabled(filter,fill){
                                    if (!global.settings.msgFilters[filter].vis){
                                        return false;
                                    }
                                    let totVis = 0;
                                    Object.keys(global.settings.msgFilters).forEach(function (filt){
                                        if (global.settings.msgFilters[filt].vis){
                                            totVis++;
                                        }
                                    });
                                    
                                    return totVis === 1;
                                },
                                maxVal(filter){
                                    if (maxInputs[filter] < 1){
                                        maxInputs[filter] = 1;
                                    }
                                },
                                saveVal(filter){
                                    if (saveInputs[filter] < 0){
                                        saveInputs[filter] = 0;
                                    }
                                    else if (saveInputs[filter] > global.settings.msgFilters[filter].max){
                                        saveInputs[filter] = global.settings.msgFilters[filter].max;
                                    }
                                },
                                applyMax(){
                                    message_filters.forEach(function (filter){
                                        let max = maxInputs[filter];
                                        global.settings.msgFilters[filter].max = max;
                                        if (max < global.settings.msgFilters[filter].save){
                                            saveInputs[filter] = max;
                                            global.settings.msgFilters[filter].save = max;
                                            global.lastMsg[filter].splice(max);
                                        }
                                        message_logs[filter].splice(max);
                                        if (message_logs.view === filter){
                                            $('#msgQueueLog').children().slice(max).remove();
                                        }
                                    });
                                },
                                applySave(){
                                    message_filters.forEach(function (filter){
                                        global.settings.msgFilters[filter].save = saveInputs[filter];
                                        global.lastMsg[filter].splice(saveInputs[filter]);
                                    });
                                }
                            }
                        });
                    }
                }, 50);
            }
        }
    });

    $('#mobileNav').on('click', '.mobile-nav-btn', function () {
        const panel = $(this).data('panel');
        $('#main')
            .toggleClass('mobile-panel-game', panel === 'game')
            .toggleClass('mobile-panel-queue', panel === 'queue');
        $('#mobileNav .mobile-nav-btn').removeClass('is-active');
        $(this).addClass('is-active');
    });

    // Keep #mobileNav and .promoBar visually anchored when browser toolbars toggle or user zooms.
    // visualViewport tracks the *visible* window; position:fixed tracks the layout viewport —
    // when they diverge (toolbar changes, zoom) we correct with a CSS transform offset.
    if ('visualViewport' in window) {
        const $navBar = $('#mobileNav');
        const $promoBar = $('.promoBar');

        const syncFixedToViewport = () => {
            const vv = window.visualViewport;
            // How many px the visual viewport is inset from the bottom of the layout viewport
            const offsetFromBottom = window.innerHeight - (vv.height + vv.offsetTop);
            const translateY = -Math.round(Math.max(0, offsetFromBottom));
            $navBar.css('transform', `translateY(${translateY}px)`);
            $promoBar.css('transform', `translateY(${translateY}px)`);
        };

        window.visualViewport.addEventListener('resize', syncFixedToViewport);
        window.visualViewport.addEventListener('scroll', syncFixedToViewport);
    }

    loadCustomThemeHTML();
}
