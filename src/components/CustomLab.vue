<!--TODO list: 
	fix tooltips not drawing when hovering over traits, 
	cleanup/reassess potentially redundant features like cost/affordability based auras with target rank
	fix the sandbox mode toggle; it's still really broken when toggled on.
	fix traits showing the r1 value until they've been clicked, even if being viewed at a different (target) rank
	investigate supposedly that descriptions can somehow just break- details unknown, they just can stop showing up (probably in reference to tooltips)
	finish implementing mutation cost and rank logic
-->

<script setup>
    import { ref, reactive, computed, watch, provide, onMounted, onUnmounted, nextTick } from 'vue';
    import { global } from '../vars.js';
    import { loc } from '../locale.js';
    import {
        calcGenomeScore,
        popover,
        clearPopper,
        getTraitDesc,
        deepClone,
    } from '../functions.js';
    import { universeAffix } from '../achieve.js';
    import { races, traits, genus_def } from '../races.js';
    import { ascend, apotheosis } from '../resets.js';
    import { geneCost, planetName, universe_types } from '../space.js';

    import LabTraitCard from './LabTraitCard.vue';
    import LabControlPanel from './LabControlPanel.vue';
    import LabPlanningSection from './LabPlanningSection.vue';
    import RaceStatCard from './RaceStatCard.vue';
    import FileImportButton from './FileImportButton.vue';
    import ActionBar from './ActionBar.vue';

    // ─── Props ────────────────────────────────────────────────────────────────────

    const props = defineProps({ hybrid: Boolean, isWiki: Boolean });

    // aliased to simple names since these never change after mount
    const hybrid = props.hybrid;
    const isWiki = props.isWiki;

    // ─── trait display architecture ───────────────────────────────────────────────

    class SortingMethod {
        constructor({
            id,
            label,
            compareFn,
            icon = null,
            hide = false,
            defaultGroupByPolarity = true,
        }) {
            this.id = id;
            this.label = label;
            this.compareFn = compareFn; // (traitKeyA, traitKeyB, filterContext) => number
            this.icon = icon;
            this.hide = hide; // if true, excluded from the add-sort dropdown in the UI (IE to keep it mostly for programmatic access)
            this.defaultGroupByPolarity = defaultGroupByPolarity;
        }
    }

    class TraitFilter {
        constructor({
            id,
            label,
            group = null,
            filterFn,
            icon = null,
            hide = false,
            rowBreakBefore = false,
        }) {
            this.id = id;
            this.label = label;
            this.group = group; // filters in the same group are mutually exclusive (OR'd together)
            this.filterFn = filterFn; // (traitKey, filterContext) => boolean
            this.icon = icon; // placeholder in case we want to add icons later, or maybe string packs or somethin idunno
            this.hide = hide; // if true, this filter won't show up in the UI but can still be used programmatically
            this.rowBreakBefore = rowBreakBefore; // mostly just for aesthetics. if true, starts a new row even after a trait from the same group
        }
    }

    // ─── Sort Methods Catalog ─────────────────────────────────────────────────────
    // to add a new sort method, just add a new SortingMethod entry here.
    // order of entries in this array also defines the order of the options in the UI dropdown

    // Maps each trait key to its position in the traits object
    // lazy init to avoid errors from the circular import chain with space.js
    let _traitDefinitionOrder = null;
    function getTraitDefinitionOrder() {
        return (_traitDefinitionOrder ??= new Map(Object.keys(traits).map((k, i) => [k, i])));
    }

    const SORT_METHODS = [
        new SortingMethod({
            id: 'name_asc',
            label: 'Alphabetical',
            compareFn(a, b) {
                return traits[a].name.localeCompare(traits[b].name);
            },
        }),
        new SortingMethod({
            id: 'val_desc',
            label: 'Base Gene Value (High \u2192 Low)',
            compareFn(a, b) {
                return (traits[b].val ?? 0) - (traits[a].val ?? 0);
            },
            hide: true,
        }),
        new SortingMethod({
            id: 'cost_optimal',
            label: 'Gene Cost',
            // sorts by signed gene cost ascending
            // getTraitCost returns negative for traits that give genes,
            // so this naturally puts the most-generous negative traits first,
            // and also accounts for when negatives can be more expensive than positives
            defaultGroupByPolarity: false,
            compareFn(a, b, ctx) {
                return ctx.getTraitCost(a) - ctx.getTraitCost(b);
            },
        }),
        new SortingMethod({
            id: 'selected_first',
            label: 'Selected first',
            compareFn(a, b, ctx) {
                return (
                    (ctx.genome.traitlist.includes(a) ? 0 : 1) -
                    (ctx.genome.traitlist.includes(b) ? 0 : 1)
                );
            },
        }),
        new SortingMethod({
            id: 'cost_effective_optimal',
            label: 'Gene Cost at Target Rank',
            hide: true,
            // this one might get abandoned
            defaultGroupByPolarity: false,
            compareFn(a, b, ctx) {
                return ctx.getEffectiveTraitCost(a) - ctx.getEffectiveTraitCost(b);
            },
        }),
        new SortingMethod({
            id: 'rank_optimal',
            label: 'By Rank',
            hide: true,
            // sorts all traits descending by assigned rank.
            // For positive traits: higher rank = more committed.
            // For negative traits: higher rank = stronger malus = more genes given.
            // Polarity separation is handled by the groupByPolarity stack option.
            compareFn(a, b, ctx) {
                const rankA = ctx.tRanks[a] ?? 1;
                const rankB = ctx.tRanks[b] ?? 1;
                return rankB - rankA;
            },
        }),
        new SortingMethod({
            id: 'taxonomy_group',
            label: 'Taxonomy',
            compareFn(a, b) {
                const order = { utility: 0, resource: 1, production: 2, combat: 3 };
                return (order[traits[a]?.taxonomy] ?? 99) - (order[traits[b]?.taxonomy] ?? 99);
            },
        }),
        new SortingMethod({
            id: 'favorites_first',
            label: 'Favorites first',
            compareFn(a, b, ctx) {
                return (ctx.favorites.has(a) ? 0 : 1) - (ctx.favorites.has(b) ? 0 : 1);
            },
        }),
        new SortingMethod({
            id: 'definition_order',
            label: 'Definition order',
            compareFn(a, b) {
                const order = getTraitDefinitionOrder();
                return (order.get(a) ?? 999) - (order.get(b) ?? 999);
            },
        }),
    ];

    const SORT_METHODS_BY_ID = new Map(SORT_METHODS.map((m) => [m.id, m]));

    // ─── Trait Filters Catalog ────────────────────────────────────────────────────
    // to add a new filter, just add a new TraitFilter entry here
    // filters with a matching group will be mutually exclusive with each other
    // filters without a defined group will be independent toggles.

    const TRAIT_FILTERS = [
        new TraitFilter({
            id: 'gene_positive',
            label: 'Gene-positive',
            filterFn(key, ctx) {
                return ctx.getEffectiveTraitCost(key) < 0;
            },
        }),
        // Polarity group
        new TraitFilter({
            id: 'positive_only',
            label: 'Positives only',
            group: 'polarity',
            filterFn(key) {
                return (traits[key]?.val ?? 0) >= 0;
            },
        }),
        new TraitFilter({
            id: 'negative_only',
            label: 'Negatives only',
            group: 'polarity',
            filterFn(key) {
                return (traits[key]?.val ?? 0) < 0;
            },
        }),
        // Selection group
        new TraitFilter({
            id: 'selected_only',
            label: 'Selected only',
            group: 'selection',
            filterFn(key, ctx) {
                return ctx.genome.traitlist.includes(key);
            },
        }),
        new TraitFilter({
            id: 'unselected_only',
            label: 'Unselected only',
            group: 'selection',
            filterFn(key, ctx) {
                return !ctx.genome.traitlist.includes(key);
            },
        }),
        // Availability
        new TraitFilter({
            id: 'affordable',
            label: 'Affordable',
            filterFn(key, ctx) {
                return ctx.genome.genes >= ctx.getTraitCost(key);
            },
        }),
        new TraitFilter({
            id: 'rank_upgradeable',
            label: 'Rank-modifiable',
            hide: true,
            filterFn(key, ctx) {
                return ctx.getAvailableRanks(key).length > 1;
            },
        }),
        new TraitFilter({
            id: 'favorites_only',
            label: 'Favorites only',
            filterFn(key, ctx) {
                return ctx.favorites.has(key);
            },
        }),
        new TraitFilter({
            id: 'missing_rank',
            label: 'Rank locked (import diagnostic)',
            hide: true,
            // Catches ranks outside the available range in either direction.
            filterFn(key, ctx) {
                const assigned = ctx.tRanks[key];
                return assigned != null && !ctx.getAvailableRanks(key).includes(assigned);
            },
        }),
        // Taxonomy group
        new TraitFilter({
            id: 'taxon_utility',
            label: 'Utility',
            group: 'taxonomy',
            filterFn(key) {
                return traits[key]?.taxonomy === 'utility';
            },
        }),
        new TraitFilter({
            id: 'taxon_resource',
            label: 'Resource',
            group: 'taxonomy',
            filterFn(key) {
                return traits[key]?.taxonomy === 'resource';
            },
        }),
        new TraitFilter({
            id: 'taxon_production',
            label: 'Production',
            group: 'taxonomy',
            rowBreakBefore: true, // split into 2 rows of 2 buttons when rendering instead of 3 and 1
            filterFn(key) {
                return traits[key]?.taxonomy === 'production';
            },
        }),
        new TraitFilter({
            id: 'taxon_combat',
            label: 'Combat',
            group: 'taxonomy',
            filterFn(key) {
                return traits[key]?.taxonomy === 'combat';
            },
        }),
    ];

    const TRAIT_FILTERS_BY_ID = new Map(TRAIT_FILTERS.map((f) => [f.id, f]));

    // ─── Genus Cluster Colors ──────────────────────────────────────────────────────
    // one color per opposition cluster, assigned in search discovery order.
    // 10 colors covers all current clusters (9 pairs/trios) with one spare.
    const CLUSTER_BORDER_COLORS = [
        '#e74c3c', // red
        '#e67e22', // orange
        '#f1c40f', // yellow
        '#2ecc71', // green
        '#1abc9c', // teal
        '#3498db', // blue
        '#9b59b6', // purple
        '#fd79a8', // pink
        '#00cec9', // cyan
        '#a29bfe', // lavender
    ];

    function isNegativeTrait(key) {
        return (traits[key]?.val ?? 0) < 0;
    }

    // eslint-disable-next-line no-unused-vars
    function isPositiveTrait(key) {
        return (traits[key]?.val ?? 0) > 0;
    }

    // drives tab order to match current game tab order- currently a maintenance point
    // TODO might be good to make this user configurable as well, the order isn't very intuitive
    const TAXONOMY_ORDER = ['combat', 'production', 'resource', 'utility'];

    // ─── Wiki Trait Effect text cache ──────────────────────────────────────────────────
    // search through wiki's more descriptive trait effect, built once per composable instance
    function buildTraitEffectCache() {
        const cache = new Map();
        for (const [key, trait] of Object.entries(traits)) {
            if (trait.type === 'major') {
                cache.set(key, loc(`wiki_trait_effect_${key}`) || '');
            }
        }
        return cache;
    }

    // ─── useTraitDisplay Composable ───────────────────────────────────────────────

    const LS_FAVORITES_KEY = 'evolve_lab_favorites';
    const LS_SORT_STACK_KEY = 'evolve_lab_sort_stack';
    const DEFAULT_SORT_STACK = () => [
        { methodId: 'name_asc', reversed: false, groupByPolarity: true },
    ];

    function loadFavorites() {
        try {
            const raw = localStorage.getItem(LS_FAVORITES_KEY);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    }

    function loadSortStack() {
        try {
            const raw = localStorage.getItem(LS_SORT_STACK_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    /**
     * Composable for trait list display: search, filters, sorting, favorites.
     */
    function useTraitDisplay(deps) {
        const {
            genome,
            tRanks,
            unlockedTraits,
            getTraitCost,
            getEffectiveTraitCost,
            getAvailableRanks,
            isWiki,
            effectiveRank,
        } = deps;

        const traitEffectCache = buildTraitEffectCache();

        // ── Persistent state ──────────────────────────────────────────────────────
        const savedStack = loadSortStack();
        const activeSortStack = reactive(
            savedStack && savedStack.length > 0 ? savedStack : DEFAULT_SORT_STACK(),
        );
        const favoritedTraits = reactive(loadFavorites());

        // ── Session state ──────────────────────────────────────────────────────────
        const searchQuery = ref('');
        // displayedTraits reads this debounced copy instead
        // since backspacing was feeling laggy when reading searchQuery directly
        const debouncedQuery = ref('');
        let _debounceTimer = null;
        watch(searchQuery, (val) => {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                debouncedQuery.value = val;
            }, 150);
        });

        const searchScope = reactive({ name: true, desc: true, effect: false });
        const activeFilters = reactive(Object.fromEntries(TRAIT_FILTERS.map((f) => [f.id, false])));
        const isControlPanelOpen = ref(true);
        // When true: all traits rendered as one flat list on the All tab, ignoring taxonomy sections.
        const isConsolidatedView = ref(false);

        // ── Derived flags ──────────────────────────────────────────────────────────
        const hasActiveNonTaxonomyFilters = computed(() =>
            TRAIT_FILTERS.filter((f) => f.group !== 'taxonomy').some((f) => activeFilters[f.id]),
        );

        const isSearchMode = computed(
            () => debouncedQuery.value.trim() !== '' || hasActiveNonTaxonomyFilters.value,
        );

        // ── Filter context builder ─────────────────────────────────────────────────
        function buildFilterContext() {
            return {
                traits,
                genome,
                tRanks,
                favorites: favoritedTraits,
                traitEffectCache,
                getTraitCost,
                getEffectiveTraitCost,
                getAvailableRanks,
                isWiki,
                effectiveRank: effectiveRank.value,
            };
        }

        // ── Search matching ────────────────────────────────────────────────────────
        function matchesSearch(key, query) {
            const q = query.toLowerCase();
            if (searchScope.name && traits[key]?.name?.toLowerCase().includes(q)) return true;
            if (searchScope.desc && traits[key]?.desc?.toLowerCase().includes(q)) return true;
            if (searchScope.effect && (traitEffectCache.get(key) || '').toLowerCase().includes(q))
                return true;
            return false;
        }

        // ── Main computed: flat sorted + filtered trait list ───────────────────────
        const displayedTraits = computed(() => {
            const ctx = buildFilterContext();
            const query = debouncedQuery.value.trim();
            let list = [...unlockedTraits.value];

            if (query) {
                list = list.filter((key) => matchesSearch(key, query));
            }

            // Group filters: same group = OR'd together; different groups = AND'd together
            const enabledFilters = TRAIT_FILTERS.filter((f) => activeFilters[f.id]);
            if (enabledFilters.length > 0) {
                const byGroup = new Map();
                for (const f of enabledFilters) {
                    const g = f.group ?? `__standalone_${f.id}`;
                    if (!byGroup.has(g)) byGroup.set(g, []);
                    byGroup.get(g).push(f);
                }
                list = list.filter((key) =>
                    [...byGroup.values()].every((group) => group.some((f) => f.filterFn(key, ctx))),
                );
            }

            // Multi-criterion sort: stack entries are highest-priority-first.
            // Falls back to alphabetical if no sort is active.
            if (activeSortStack.length > 0) {
                list.sort((a, b) => {
                    for (const entry of activeSortStack) {
                        const method = SORT_METHODS_BY_ID.get(entry.methodId);
                        if (!method) continue;
                        let result = method.compareFn(a, b, ctx, entry);
                        if (entry.reversed) result = -result;
                        if (result !== 0) return result;
                    }
                    return 0;
                });
            } else {
                list.sort((a, b) => traits[a].name.localeCompare(traits[b].name));
                const positives = list.filter((k) => !isNegativeTrait(k));
                const negatives = list.filter((k) => isNegativeTrait(k));
                list = [...positives, ...negatives];
            }

            // Post-sort polarity grouping: if any active sort entry has groupByPolarity enabled,
            // split the sorted list into positives-first then negatives, preserving order within each group.
            // Checked here (not inside the comparator) so Vue's reactive tracking fires correctly.
            const shouldGroupByPolarity = activeSortStack.some((e) => e.groupByPolarity);
            if (shouldGroupByPolarity) {
                const positives = list.filter((k) => !isNegativeTrait(k));
                const negatives = list.filter((k) => isNegativeTrait(k));
                list = [...positives, ...negatives];
            }

            return list;
        });

        const displayedByTaxon = computed(() => {
            const groups = {
                utility: [],
                resource: [],
                production: [],
                combat: [],
                other: [],
            };
            for (const key of displayedTraits.value) {
                const taxon = traits[key]?.taxonomy;
                (groups[taxon] ?? groups.other).push(key);
            }
            return groups;
        });

        // ── Methods ────────────────────────────────────────────────────────────────

        function toggleFilter(filterId) {
            const filter = TRAIT_FILTERS_BY_ID.get(filterId);
            if (!filter) return;
            const isEnabling = !activeFilters[filterId];
            if (isEnabling && filter.group) {
                TRAIT_FILTERS.filter((f) => f.group === filter.group && f.id !== filterId).forEach(
                    (f) => {
                        activeFilters[f.id] = false;
                    },
                );
            }
            activeFilters[filterId] = isEnabling;
        }

        function toggleFavorite(traitKey) {
            if (favoritedTraits.has(traitKey)) favoritedTraits.delete(traitKey);
            else favoritedTraits.add(traitKey);
            persistFavorites();
        }

        function addSortMethod(methodId) {
            if (activeSortStack.some((e) => e.methodId === methodId)) return;
            const method = SORT_METHODS_BY_ID.get(methodId);
            activeSortStack.push({
                methodId,
                reversed: false,
                groupByPolarity: method?.defaultGroupByPolarity ?? true,
            });
            persistSortStack();
        }

        function removeSortMethod(index) {
            activeSortStack.splice(index, 1);
            persistSortStack();
        }

        function toggleSortReversed(index) {
            if (!activeSortStack[index]) return;
            activeSortStack[index].reversed = !activeSortStack[index].reversed;
            persistSortStack();
        }

        // toggles the "positives before negatives" grouping for this sort criterion.
        function toggleGroupByPolarity(index) {
            if (!activeSortStack[index]) return;
            activeSortStack[index].groupByPolarity = !activeSortStack[index].groupByPolarity;
            persistSortStack();
        }

        // called from Sortable.js drag completion handler (in LabControlPanel)
        function onSortStackReorder(oldIndex, newIndex) {
            const [moved] = activeSortStack.splice(oldIndex, 1);
            activeSortStack.splice(newIndex, 0, moved);
            persistSortStack();
        }

        function resetDisplay() {
            searchQuery.value = '';
            debouncedQuery.value = '';
            clearTimeout(_debounceTimer);
            Object.assign(searchScope, { name: true, desc: true, effect: false });
            TRAIT_FILTERS.forEach((f) => {
                activeFilters[f.id] = false;
            });
            activeSortStack.splice(0, activeSortStack.length, ...DEFAULT_SORT_STACK());
            persistSortStack();
        }

        function persistFavorites() {
            try {
                localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify([...favoritedTraits]));
            } catch {
                /* ignore localStorage failure */
            }
        }

        function persistSortStack() {
            try {
                localStorage.setItem(LS_SORT_STACK_KEY, JSON.stringify(activeSortStack));
            } catch {
                /* ignore localStorage failure */
            }
        }

        return {
            searchQuery,
            searchScope,
            activeSortStack,
            activeFilters,
            favoritedTraits,
            isControlPanelOpen,
            isConsolidatedView,
            displayedTraits,
            displayedByTaxon,
            isSearchMode,
            hasActiveNonTaxonomyFilters,
            toggleFilter,
            toggleFavorite,
            addSortMethod,
            removeSortMethod,
            toggleSortReversed,
            toggleGroupByPolarity,
            onSortStackReorder,
            resetDisplay,
            SORT_METHODS,
            TRAIT_FILTERS,
        };
    }

    // ─── Identity ─────────────────────────────────────────────────────────────────

    const slot = hybrid ? 'race1' : 'race0';
    const dGenus = hybrid ? 'hybrid' : 'humanoid';

    // ─── Sandbox mode ─────────────────────────────────────────────────────────────

    const sandboxMode = ref(false);

    // ─── Wiki vars ────────────────────────────────────────────────────────────────
    // Ascended/technophobe levels for the wiki score calculator inputs.

    const wikiVars = reactive({
        ascended: Object.fromEntries(
            Object.keys(universe_types).map((uni) => [
                uni,
                global.stats.achieve['ascended']?.hasOwnProperty(universeAffix(uni))
                    ? global.stats.achieve.ascended[universeAffix(uni)]
                    : 0,
            ]),
        ),
        technophobe: global.stats.achieve['technophobe']?.l || 0,
    });

    // ─── Genome initialization ────────────────────────────────────────────────────

    const saved = global.custom?.[slot];
    const pNames = planetName();

    const genomeData = saved
        ? {
              name: saved.name,
              desc: saved.desc,
              entity: saved.entity,
              home: saved.home,
              red: saved.red,
              hell: saved.hell,
              gas: saved.gas,
              gas_moon: saved.gas_moon,
              dwarf: saved.dwarf,
              titan: saved.titan || pNames.titan,
              enceladus: saved.enceladus || pNames.enceladus,
              triton: saved.triton || pNames.triton,
              eris: saved.eris || pNames.eris,
              genes: 0,
              genus: saved.genus,
              traitlist: [...(saved.traits ?? [])],
              fanaticism: saved.fanaticism || false,
          }
        : {
              name: 'Zombie',
              desc: `Zombies aren't so much a species as they are the shambling remains of a race who succumbed to a nightmarish virus. Yet somehow they continue to drone on.`,
              entity: 'rotting bipedal creatures',
              home: 'Grave',
              red: 'Brains',
              hell: 'Rigor Mortis',
              gas: 'Decompose',
              gas_moon: 'Bones',
              dwarf: 'Double Tap',
              titan: 'Necromancer',
              enceladus: 'Skeleton',
              triton: 'Rot',
              eris: 'Zombieland',
              genes: 10,
              genus: dGenus,
              traitlist: [],
              fanaticism: false,
          };

    if (hybrid) {
        genomeData.hybrid = saved?.hybrid ?? ['humanoid', 'small'];
    }

    const genome = reactive(genomeData);

    // tRanks is the live source of truth for trait ranks,
    // separate from genome.ranks (which is only written on save/export)
    const tRanks = reactive(deepClone(saved?.ranks ?? {}));

    // ─── Basic UI state ───────────────────────────────────────────────────────────

    const errorMsg = ref('');
    const activeTab = ref(0); // 0 = All tab (default)

    // Slide direction for tab transitions.
    // Buefy 3.0.3 has a bug: activate()/deactivate() are never called on tab items,
    // so their internal transitionName stays null and no CSS transition classes are applied
    // We bypass this by computing direction ourselves and passing it via :animation,
    // which takes priority over transitionName in Buefy's render function.
    const slideDirection = ref('slide-next');
    watch(activeTab, (newVal, oldVal) => {
        slideDirection.value = newVal > oldVal ? 'slide-prev' : 'slide-next';
    });

    // Traits whose imported rank was clamped due to insufficient extinction achievement.
    // Cleared at the start of each import; shown as a warning indicator in LabTraitCard.
    const importRankViolations = reactive(new Set());

    // ─── Summary state ────────────────────────────────────────────────────────────
    // tracks traits that were deselected from within the summary
    // they stay visible in the summary (as unchecked) until the next outside-summary change
    // TODO fix, doesn't actually

    const summaryDeselectedSet = reactive(new Set());

    // ─── Unlocked traits ──────────────────────────────────────────────────────────
    // reactive computed array of major trait keys available to the player
    // recomputed when sandboxMode changes

    const EXCLUDED_RACES = new Set(['custom', 'hybrid', 'junker', 'sludge', 'ultra_sludge']);

    const unlockedTraits = computed(() => {
        const seen = new Set();
        const keys = [];
        for (const race of Object.keys(races)) {
            const type = races[race].type;
            const isUnlocked =
                sandboxMode.value ||
                global.stats.achieve[`extinct_${race}`]?.l > 0 ||
                global.stats.achieve[`genus_${type}`]?.l > 0;
            if (!isUnlocked || !races[race].traits || EXCLUDED_RACES.has(race)) continue;
            for (const trait of Object.keys(races[race].traits)) {
                if (!seen.has(trait) && traits[trait]?.taxonomy && traits[trait].type === 'major') {
                    seen.add(trait);
                    keys.push(trait);
                }
            }
        }
        return keys;
    });

    // ─── Target rank system ───────────────────────────────────────────────────────

    const targetRank = ref(1);
    const tempTargetRank = ref(null);
    const effectiveRank = computed(() => tempTargetRank.value ?? targetRank.value);

    // returns the set of ranks unlocked for a trait based on extinction achievement
    // range spans in both directions from rank 1 depending on achievement level
    function getAvailableRanks(trait) {
        const origin = traits[trait]?.origin;
        const extinctLevel =
            sandboxMode.value || !origin ? 5 : global.stats.achieve[`extinct_${origin}`]?.l || 0;
        const ranks = [1];
        if (extinctLevel >= 3) ranks.push(0.5, 2);
        if (extinctLevel >= 4) ranks.push(0.25, 3);
        if (extinctLevel >= 5) ranks.push(0.1, 4);
        return ranks;
    }

    // caps max useful rank at 3 for traits that Empowered would already push to rank 4 for free
    function getMaxUsefulRank(trait) {
        if (!genome.traitlist.includes('empowered')) return 4;
        const empoweredRank = tRanks['empowered'] || 1;
        const [minVal, maxVal] = traits.empowered.vars(empoweredRank);
        const traitVal = traits[trait]?.val ?? 0;
        const isEmpowerable =
            traitVal >= minVal &&
            traitVal <= maxVal &&
            !['empowered', 'catnip', 'anise'].includes(trait);
        return isEmpowerable ? 3 : 4;
    }

    // primary source of truth for rank resolution;
    // accounts for empowered and achievement status for availability
    // snaps to the closest available rank if the target rank isn't unlocked
    function getEffectiveTraitRank(trait, desiredRank = null) {
        const target = desiredRank ?? effectiveRank.value;
        const available = getAvailableRanks(trait);
        const maxUseful = getMaxUsefulRank(trait);

        if (available.includes(target)) {
            return target === 4 ? maxUseful : target;
        }

        let closest = 1;
        let minDiff = Math.abs(target - 1);
        for (const rank of available) {
            const diff = Math.abs(target - rank);
            if (diff < minDiff) {
                minDiff = diff;
                closest = rank;
            }
        }
        return closest;
    }

    // cost at effective target rank if trait is unselected, or at assigned rank if selected
    function getTraitCost(trait) {
        const isSelected = genome.traitlist.includes(trait);
        const rank = isSelected ? tRanks[trait] || 1 : getEffectiveTraitRank(trait);
        return geneCost(genome, trait, { ...tRanks, [trait]: rank });
    }

    // cost always at effective target rank
    function getEffectiveTraitCost(trait) {
        const rank = getEffectiveTraitRank(trait);
        return geneCost(genome, trait, { ...tRanks, [trait]: rank });
    }

    // ─── trait aura classes ───────────────────────────────────────────────────────
    // visual affordance when a non-default target rank is active
    // TODO: might consider scrapping this, it's kinda unnecessary with everything else
    // that's been added since I originally did this
    // might be worth shifting it for a different purpose instead

    const traitAuraClasses = computed(() => {
        const classes = {};
        const showAuras = effectiveRank.value !== 1;
        const selectedSet = new Set(genome.traitlist);

        for (const trait of unlockedTraits.value) {
            if (traits[trait]?.type !== 'major') continue;
            if (selectedSet.has(trait)) {
                classes[trait] = 'selected-trait';
                continue;
            }
            if (!showAuras) {
                classes[trait] = '';
                continue;
            }

            const effectRank = getEffectiveTraitRank(trait);
            const cost = geneCost(genome, trait, {
                ...tRanks,
                [trait]: effectRank,
            });
            const isNegative = (traits[trait].val ?? 0) < 0;

            if (isNegative && cost < 0) {
                classes[trait] = 'gene-positive'; // negative trait yields genes at this rank
            } else if (!isNegative && genome.genes >= cost) {
                classes[trait] = 'available-rank'; // positive trait is affordable
            } else {
                classes[trait] = '';
            }
        }
        return classes;
    });

    // ─── custom building methods ───────────────────────────────────────────────────────────

    function geneEdit() {
        // sync tRanks with traitlist: keep existing ranks, add r1 for new traits, remove deselected
        const newRanks = {};
        for (const trait of genome.traitlist) {
            newRanks[trait] = tRanks[trait] ?? 1;
        }
        for (const key of Object.keys(tRanks)) {
            if (!newRanks[key]) delete tRanks[key];
        }
        Object.assign(tRanks, newRanks);
        genome.genes = calcGenomeScore(genome, isWiki ? wikiVars : false, tRanks);
    }

    // returns true (disabled) when a trait cannot be toggled in the current context
    function allowed(trait) {
        if (
            (genome.traitlist.includes('catnip') && trait === 'anise') ||
            (genome.traitlist.includes('anise') && trait === 'catnip')
        ) {
            return true;
        }
        if (['deconstructor', 'imitation'].includes(trait)) {
            const hasSyntheticGenus =
                genome.genus === 'synthetic' ||
                (genome.genus === 'hybrid' && genome.hybrid?.includes('synthetic'));
            if (!hasSyntheticGenus) {
                const idx = genome.traitlist.indexOf(trait);
                if (idx !== -1) genome.traitlist.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    const isGenomeValid = computed(() => {
        if (genome.fanaticism && !genome.traitlist.includes(genome.fanaticism)) return false;
        if (calcGenomeScore(genome, false, tRanks) < 0) return false;
        const requiredFields = [
            'name',
            'desc',
            'entity',
            'home',
            'red',
            'hell',
            'gas',
            'gas_moon',
            'dwarf',
        ];
        return requiredFields.every((f) => (genome[f]?.length ?? 0) > 0);
    });

    function setRace() {
        if (!isGenomeValid.value) return;
        if (!global.custom) global.custom = {};
        global.custom[slot] = {
            name: genome.name,
            desc: genome.desc,
            entity: genome.entity,
            home: genome.home,
            red: genome.red,
            hell: genome.hell,
            gas: genome.gas,
            gas_moon: genome.gas_moon,
            dwarf: genome.dwarf,
            titan: genome.titan,
            enceladus: genome.enceladus,
            triton: genome.triton,
            eris: genome.eris,
            genus: genome.genus,
            traits: [...genome.traitlist],
            fanaticism: genome.fanaticism,
            ranks: { ...tRanks },
            planning: {
                fanaticismTarget: planningState.fanaticismTarget,
                deifyTarget: planningState.deifyTarget,
                imitationTarget: planningState.imitationTarget,
                mutateOutTraits: [...planningState.mutateOutTraits],
            },
        };
        document.getElementById('main')?.classList.remove('custom-lab-active');
        if (hybrid) {
            global.custom[slot].hybrid = genome.hybrid;
            apotheosis();
        } else {
            ascend();
        }
    }

    function reset() {
        summaryDeselectedSet.clear();
        genome.name = '';
        genome.desc = '';
        genome.entity = '';
        genome.home = '';
        genome.red = '';
        genome.hell = '';
        genome.gas = '';
        genome.gas_moon = '';
        genome.dwarf = '';
        genome.titan = '';
        genome.enceladus = '';
        genome.triton = '';
        genome.eris = '';
        genome.genus = dGenus;
        genome.traitlist = [];
        genome.fanaticism = false;
        for (const key of Object.keys(tRanks)) delete tRanks[key];
        genome.genes = calcGenomeScore(genome, isWiki ? wikiVars : false, tRanks);
    }

    // ─── modifier key handlers ───────────────────────────────────────────────────
    // overrides the target rank while ctrl/shift is held
    // blur/visibilitychange clear state to prevent permanent aura desync on lost focus

    function clearTempRank() {
        tempTargetRank.value = null;
    }

    // ctrl = minimum rank
    // shift = maximum(useful) rank
    function syncTempRank(event) {
        if (event.ctrlKey && !event.shiftKey) {
            tempTargetRank.value = 0.1;
        } else if (event.shiftKey && !event.ctrlKey) {
            tempTargetRank.value = 4;
        } else {
            tempTargetRank.value = null;
        }
    }

    const handleKeyDown = syncTempRank;
    const handleKeyUp = syncTempRank;

    // ─── popovers ──────────────────────────────────

    const knownPopovers = new Set();

    function setupPopovers() {
        for (const trait of traitDisplay.displayedTraits.value) {
            if (knownPopovers.has(trait)) continue;
            knownPopovers.add(trait);
            popover(
                `celestialLabtraitSelection${trait}`,
                () => {
                    const desc = $(`<div></div>`);
                    getTraitDesc(desc, trait, {
                        trank: tRanks[trait] || 1,
                        wiki: isWiki,
                    });
                    return desc;
                },
                { elm: `.t${trait}`, classes: 'w30', wide: true, self: true },
            );
        }
    }

    // ─── lifecycle ──────────────────────────────────────────────────────────

    onMounted(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearTempRank);
        document.addEventListener('visibilitychange', clearTempRank);

        // validate initial traitlist against what's actually unlocked
        const unlocked = new Set(unlockedTraits.value);
        genome.traitlist = genome.traitlist.filter(
            (t) => traits.hasOwnProperty(t) && unlocked.has(t) && traits[t].type === 'major',
        );

        // remove ranks for traits that didn't survive the filter
        for (const key of Object.keys(tRanks)) {
            if (!genome.traitlist.includes(key)) delete tRanks[key];
        }

        genome.genes = calcGenomeScore(genome, isWiki ? wikiVars : false, tRanks);

        nextTick(setupPopovers);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', clearTempRank);
        document.removeEventListener('visibilitychange', clearTempRank);
        clearTimeout(genusModalCooldownTimer);
        for (const trait of knownPopovers) clearPopper(`celestialLabtraitSelection${trait}`);
        knownPopovers.clear();
    });

    // ─── Additional UI state ──────────────────────────────────────────────────────

    const favoritingMode = ref(false); // click to favorite instead of select
    const isGenusModalOpen = ref(false);
    const genusModalSlot = ref(0); // 0 = primary genus, 1 = hybrid genus B
    const isFanaticismModalOpen = ref(false);

    // guards against rapid clicks opening the genus modal while Buefy's close animation
    // is still running — without this, the portal can get stuck open with no DOM element rendered
    let genusModalCooldownTimer = null;
    const isGenusModalBusy = ref(false);

    watch(isGenusModalOpen, (isOpen) => {
        if (!isOpen) {
            clearTimeout(genusModalCooldownTimer);
            genusModalCooldownTimer = setTimeout(() => { isGenusModalBusy.value = false; }, 300);
        }
    });

    function openGenusModal(slot) {
        if (isGenusModalBusy.value || isGenusModalOpen.value) return;
        isGenusModalBusy.value = true;
        genusModalSlot.value = slot;
        isGenusModalOpen.value = true;
    }

    // Genera the player currently has unlocked/all in wiki sandbox
    const availableGenera = computed(() =>
        Object.keys(genus_def).filter((g) => {
            if (['omnivore', 'hybrid'].includes(g)) return false; // pseudo-genera, never directly selectable
            if (sandboxMode.value) return true;
            return global.stats.achieve[`genus_${g}`]?.l > 0;
        }),
    );

    // uses breadth-first search to group genera options based on synergy/opposition
    // and then draws those groups in the genus selection modal as separate clusters
    // partial unlocks (IE carnivore without herbivore) just produce solo clusters
    function buildGenusOppositionGroups(genera) {
        const generaSet = new Set(genera);
        const visited = new Set();
        const groups = [];

        for (const g of genera) {
            if (visited.has(g)) continue;

            const group = [];
            const queue = [g];
            visited.add(g);

            while (queue.length > 0) {
                const current = queue.shift();
                group.push(current);
                for (const opponent of genus_def[current]?.oppose ?? []) {
                    if (generaSet.has(opponent) && !visited.has(opponent)) {
                        visited.add(opponent);
                        queue.push(opponent);
                    }
                }
            }

            groups.push(group);
        }

        return groups;
    }

    // builds a shallow-copy hypothetical genome with the candidate genus swapped into
    // whichever slot is currently being selected
    function buildHypotheticalGenome(candidateGenus) {
        const isHybrid = genome.genus === 'hybrid';
        const slot = genusModalSlot.value;

        if (!isHybrid) {
            return { ...genome, genus: candidateGenus };
        }

        const newHybrid = [...(genome.hybrid ?? [])];
        newHybrid[slot] = candidateGenus;
        return { ...genome, hybrid: newHybrid };
    }

    function selectGenus(g) {
        if (hybrid) {
            genome.hybrid[genusModalSlot.value] = g;
        } else {
            genome.genus = g;
            // update outer solar planet names to match new genus
            const pn = planetName();
            if (!genome.titan) genome.titan = pn.titan;
            if (!genome.enceladus) genome.enceladus = pn.enceladus;
            if (!genome.triton) genome.triton = pn.triton;
            if (!genome.eris) genome.eris = pn.eris;
        }
        isGenusModalOpen.value = false;
        geneEdit();
    }

    // groups available genera into opposition clusters for the modal display
    // draw the fey/eldritch/synthetic cluster last regardless of definition order
    const LAST_CLUSTER = new Set(['fey', 'eldritch', 'synthetic']);
    const genusGroups = computed(() => {
        const groups = buildGenusOppositionGroups(availableGenera.value);
        return groups.sort((a, b) => {
            const aInLastCluster = a.some((g) => LAST_CLUSTER.has(g));
            const bInLastCluster = b.some((g) => LAST_CLUSTER.has(g));
            return aInLastCluster === bInLastCluster ? 0 : aInLastCluster ? 1 : -1;
        });
    });

    // the genus currently active in whichever slot the modal was opened for
    const currentModalGenus = computed(() => {
        if (genome.genus === 'hybrid') return genome.hybrid?.[genusModalSlot.value] ?? '';
        return genome.genus;
    });

    // determine the net change in genes for if you were to switch to each available genus
    const genusGeneDeltaMap = computed(() => {
        const deltas = new Map();
        for (const g of availableGenera.value) {
            const hypothetical = buildHypotheticalGenome(g);
            const hypotheticalGenes = calcGenomeScore(
                hypothetical,
                isWiki ? wikiVars : false,
                tRanks,
            );
            deltas.set(g, hypotheticalGenes - genome.genes);
        }
        return deltas;
    });

    // fanaticism: pick the inheritable trait of your custom, just can't be imitation
    const fanaticismOptions = computed(() => genome.traitlist.filter((t) => t !== 'imitation'));

    const saved_planning = saved?.planning ?? {};
    const planningState = reactive({
        fanaticismTarget: saved_planning.fanaticismTarget ?? null,
        deifyTarget: saved_planning.deifyTarget ?? null,
        imitationTarget: saved_planning.imitationTarget ?? null,
        mutateOutTraits: saved_planning.mutateOutTraits ?? [],
        mutateInTraits: saved_planning.mutateInTraits ?? [],
        isPreviewMode: false,
        isInheritBarOpen: true,
        isMutationBarOpen: true,
    });

    // ─── Mutation cost calculation ─────────────────────────────────────────────
    // derived from arpa.js rmCost / addCost
    // each mutation increases cost for subsequent ones

    // rank multipliers for negative traits at sub-1 ranks
    const PURGE_RANK_MULTIPLIERS = { 0.1: 4, 0.25: 3, 0.5: 2 };

    // base plasmid cost to purge (remove) a trait, before the modified-count tax
    function basePurgeCost(traitKey, rank) {
        const val = traits[traitKey]?.val ?? 0;
        const isNegative = val < 0;
        let cost = Math.abs(val) * 50; // val * 5 * 10 (custom species mutation cost multiplier, update if any of that ever gets changed)
        if (isNegative && rank < 1) {
            cost *= PURGE_RANK_MULTIPLIERS[rank] ?? 1;
        }
        return cost;
    }

    // base Plasmid cost to gain (add) a trait, before the modified-count tax
    function baseGainCost(traitKey) {
        return Math.abs(traits[traitKey]?.val ?? 0) * 50;
    }

    // simulates the full mutation plan in order (purges first, then gains)
    // each step increments the "modified" counters, which add to subsequent step costs
    // returns: { purgeSteps: [{traitKey, cost}], gainSteps: [{traitKey, cost}], total }
    function simulateMutationPlan(mutateOutTraits, mutateInTraits) {
        const modified = { total: 0, negativeRemoved: 0, positiveAdded: 0 };

        const purgeSteps = mutateOutTraits.map((traitKey) => {
            const val = traits[traitKey]?.val ?? 0;
            const isNegative = val < 0;
            const rank = tRanks[traitKey] ?? 1;

            let cost = basePurgeCost(traitKey, rank);
            cost += modified.total * 10;
            if (isNegative) cost += modified.negativeRemoved * 10;

            modified.total++;
            if (isNegative) modified.negativeRemoved++;

            return { traitKey, cost };
        });

        const gainSteps = mutateInTraits.map((traitKey) => {
            const val = traits[traitKey]?.val ?? 0;
            const isPositive = val >= 0;

            let cost = baseGainCost(traitKey);
            cost += modified.total * 10;
            if (isPositive) cost += modified.positiveAdded * 10;

            modified.total++;
            if (isPositive) modified.positiveAdded++;

            return { traitKey, cost };
        });

        const total = [...purgeSteps, ...gainSteps].reduce((sum, s) => sum + s.cost, 0);
        return { purgeSteps, gainSteps, total };
    }

    const mutationPlan = computed(() =>
        simulateMutationPlan(planningState.mutateOutTraits, planningState.mutateInTraits),
    );

    const mutationPlasmidCost = computed(() => mutationPlan.value.total);

    // ─── derived computed ─────────────────────────────────────────────────────────

    const geneCountClass = computed(() => {
        if (genome.genes > 0) return 'has-text-success';
        if (genome.genes < 0) return 'has-text-danger';
        return 'has-text-warning';
    });

    // clear the fanaticism trait if it's removed from the build
    watch(
        () => genome.fanaticism && !genome.traitlist.includes(genome.fanaticism),
        (shouldClear) => {
            if (shouldClear) genome.fanaticism = false;
        },
    );

    const untappedGenes = computed(() => {
        const g = genome.genes;
        const num = g > 0 ? +((g / (g + 20) / 10 + 0.00024) * 100).toFixed(3) : 0;
        return `+${num}%`;
    });

    const isImitationVisible = computed(
        () => sandboxMode.value || Object.keys(global.stats?.synth ?? {}).length > 0,
    );

    const imitationOptions = computed(() => {
        if (sandboxMode.value) return Object.keys(races);
        return Object.keys(global.stats?.synth ?? {});
    });

    const availableRacesForPlanning = computed(() => Object.keys(races));

    // ─── template helper methods ──────────────────────────────────────────────────

    // handle a click on a trait checkbox: toggle selection (default) or favorite (temp alternative behavior)
    // fromSummary: deselecting keeps the trait visible in the summary as unchecked
    // when clicking from main list, deselecting removes the trait from summary
    function traitClick(trait, fromSummary = false) {
        if (allowed(trait)) return;
        if (favoritingMode.value) {
            traitDisplay.toggleFavorite(trait);
            return;
        }
        const idx = genome.traitlist.indexOf(trait);
        if (idx === -1) {
            genome.traitlist.push(trait);
            summaryDeselectedSet.delete(trait); // clear sticky state when re-adding
            tRanks[trait] = getEffectiveTraitRank(trait);
        } else {
            genome.traitlist.splice(idx, 1);
            if (fromSummary) {
                summaryDeselectedSet.add(trait); // keep visible in summary as unchecked
            } else {
                summaryDeselectedSet.delete(trait); // remove from summary entirely
            }
            delete tRanks[trait];
        }
        geneEdit();
    }

    // decrement the selected rank of a trait down through its available ranks
    function reduce(trait) {
        const available = getAvailableRanks(trait).sort((a, b) => a - b);
        const current = tRanks[trait] ?? 1;
        const idx = available.indexOf(current);
        if (idx > 0) tRanks[trait] = available[idx - 1];
        geneEdit();
    }

    // increment the selected rank of a trait up through its available ranks
    function increase(trait) {
        const available = getAvailableRanks(trait).sort((a, b) => a - b);
        const current = tRanks[trait] ?? 1;
        const maxUseful = getMaxUsefulRank(trait);
        const idx = available.indexOf(current);
        const nextRank = available[idx + 1];
        if (nextRank !== undefined && nextRank <= maxUseful) {
            tRanks[trait] = nextRank;
            geneEdit();
        }
    }

    // display string for a rank value, e.g. 1 → 'Rank1', 0.5 → 'Rank0.5'.
    function rankDisplay(rank) {
        return 'Rank' + rank;
    }

    // CSS class for a trait's name: red for negative base traits, green for positive.
    function traitNameClass(trait) {
        return isNegativeTrait(trait) ? 'has-text-danger' : 'has-text-success';
    }

    function updateTargetRank(rank) {
        targetRank.value = rank;
    }

    // just formats the gene delta as a signed string: "+5", "-3", or "±0".
    function formatGeneDelta(delta) {
        if (delta === 0) return '\u00b10'; // ±0
        return delta > 0 ? `+${delta}` : `${delta}`;
    }

    // buefy text-color class for a genus's gene delta (green = gain, red = loss, yellow = neutral)
    // TODO: remember this is a thing and check if it's backwards
    function geneDeltaClass(g) {
        const delta = genusGeneDeltaMap.value.get(g) ?? 0;
        if (delta > 0) return 'has-text-success';
        if (delta < 0) return 'has-text-danger';
        return 'has-text-warning';
    }

    // label for fanaticism display
    function fanaticismLabel(trait) {
        return trait ? loc(`trait_${trait}_name`) : loc('genelab_unset');
    }

    // returns true if a trait falls within the given Empowered rank's value range
    function isEmpowered(trait) {
        if (!genome.traitlist.includes('empowered')) return false;
        const empRank = tRanks['empowered'] || 1;
        const [minVal, maxVal] = traits.empowered.vars(empRank);
        const traitVal = traits[trait]?.val ?? 0;
        return (
            traitVal >= minVal &&
            traitVal <= maxVal &&
            !['empowered', 'catnip', 'anise'].includes(trait)
        );
    }

    // wiki mode: clamp a wikiVars field to [0, 5]
    function val(type) {
        if (type === 'technophobe') {
            wikiVars.technophobe = Math.max(0, Math.min(5, wikiVars.technophobe));
        } else {
            wikiVars.ascended[type] = Math.max(0, Math.min(5, wikiVars.ascended[type]));
        }
    }

    // import a custom from JSON file
    function customImport(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = (evt) => {
            let imported;
            try {
                imported = JSON.parse(evt.target.result);
            } catch {
                errorMsg.value = loc('string_pack_error', [file.name]);
                return;
            }

            const hasFormatError = Object.keys(genome).some((type) => {
                if (type === 'fanaticism' && genome[type] === false) return false;
                return imported[type] && typeof genome[type] !== typeof imported[type];
            });

            if (hasFormatError) {
                errorMsg.value = loc('string_pack_error', [file.name]);
                return;
            }

            // apply genome fields from import
            for (const type of Object.keys(genome)) {
                if (imported[type] !== undefined) genome[type] = imported[type];
            }

            // enforce field length limits and late-game planet name fallbacks
            const nameFields = [
                'name',
                'home',
                'red',
                'hell',
                'gas',
                'gas_moon',
                'dwarf',
                'titan',
                'enceladus',
                'triton',
                'eris',
            ];
            for (const field of nameFields) {
                if (!imported[field] && ['titan', 'enceladus', 'triton', 'eris'].includes(field)) {
                    genome[field] = loc(`genus_${genome.genus}_solar_${field}`);
                } else if (genome[field]?.length > 20) {
                    genome[field] = genome[field].substring(0, 20);
                }
            }
            if (genome.entity?.length > 40) genome.entity = genome.entity.substring(0, 40);
            if (genome.desc?.length > 255) genome.desc = genome.desc.substring(0, 255);

            // revert genus to default if the imported one isn't unlocked
            if (!isWiki && !(global.stats.achieve[`genus_${genome.genus}`]?.l > 0)) {
                genome.genus = dGenus;
            }

            // handle hybrid vs non-hybrid mismatch
            if (imported.genus !== 'hybrid' && hybrid) {
                genome.hybrid = [
                    imported.genus,
                    imported.genus === 'humanoid' ? 'small' : 'humanoid',
                ];
                genome.genus = 'hybrid';
            } else if (imported.genus === 'hybrid' && !hybrid) {
                genome.genus = imported.hybrid[0];
                delete genome.hybrid;
            }

            // filter traitlist to only valid, unlocked, major traits
            const unlockedSet = new Set(unlockedTraits.value);
            genome.traitlist = genome.traitlist.filter(
                (t) => traits.hasOwnProperty(t) && traits[t].type === 'major' && unlockedSet.has(t),
            );
            // deduplicate
            genome.traitlist = [...new Set(genome.traitlist)];

            // restore tRanks
            importRankViolations.clear();
            Object.keys(tRanks).forEach((k) => delete tRanks[k]);
            const importedRanks = imported.ranks ?? {};
            Object.assign(tRanks, importedRanks);

            // clamp any ranks that exceed the player's extinction achievement level when importing
            // wiki with sandbox mode enabled bypasses this, sandbox off enforces it again
            // TODO: harden sandbox mode enabled, not working right still
            if (!sandboxMode.value) {
                for (const traitKey of genome.traitlist) {
                    const assignedRank = tRanks[traitKey];
                    if (assignedRank == null) continue;
                    const available = getAvailableRanks(traitKey);
                    if (!available.includes(assignedRank)) {
                        const legalRank = available.reduce((best, r) =>
                            Math.abs(r - assignedRank) < Math.abs(best - assignedRank) ? r : best,
                        );
                        tRanks[traitKey] = legalRank;
                        importRankViolations.add(traitKey);
                    }
                }
            }

            genome.ranks = {};
            genome.fanaticism = imported.fanaticism ?? false;

            // restore previous planning state if present locally
            if (imported.planning) {
                Object.assign(planningState, imported.planning);
            }

            genome.genes = calcGenomeScore(genome, isWiki ? wikiVars : false, tRanks);
            errorMsg.value = '';
        };
        reader.onerror = () => console.error('error reading file');
    }

    // export custom as a downloadable .txt file
    function customExport() {
        const exportGenome = deepClone(genome);
        exportGenome.ranks = { ...tRanks };
        const json = JSON.stringify(exportGenome, null, 4);
        const blob = new Blob([json], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `evolve-${hybrid ? 'hybrid' : 'custom'}-${exportGenome.name}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // ─── trait display composable ─────────────────────────────────────────────────

    const traitDisplay = useTraitDisplay({
        genome,
        tRanks,
        unlockedTraits,
        getTraitCost,
        getEffectiveTraitCost,
        getAvailableRanks,
        isWiki,
        effectiveRank,
    });

    // destructure for direct template access
    const {
        searchQuery,
        searchScope,
        activeSortStack,
        activeFilters,
        isControlPanelOpen,
        isConsolidatedView,
        displayedTraits,
        displayedByTaxon,
        isSearchMode,
        toggleFilter,
        addSortMethod,
        removeSortMethod,
        toggleSortReversed,
        toggleGroupByPolarity,
        onSortStackReorder,
        resetDisplay,
    } = traitDisplay;

    // all traits that should appear in the summary: currently selected + sticky-deselected
    // summaryTraits depends on traitDisplay.displayedTraits, so it's defined here
    // sorted to match the current sort stack; sticky-deselected traits filtered out of the main list
    // are appended in definition order
    // TODO: sticky traits are actually TOO sticky, and can be annoying to remove sometimes.
    const summaryTraits = computed(() => {
        const allToShow = new Set([...genome.traitlist, ...summaryDeselectedSet]);
        const inDisplayOrder = traitDisplay.displayedTraits.value.filter((t) => allToShow.has(t));
        const inDisplaySet = new Set(inDisplayOrder);
        const order = getTraitDefinitionOrder();
        const remainder = [...summaryDeselectedSet]
            .filter((t) => !inDisplaySet.has(t))
            .sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999));
        return [...inDisplayOrder, ...remainder];
    });

    // Refresh popovers when the displayed trait list changes.
    watch(
        () => traitDisplay.displayedTraits.value,
        () => nextTick(setupPopovers),
    );

    // ─── Available traits to gain via mutation ────────────────────────────────────
    // sourced from races sharing the custom's genus (main genus at R1, sub-genus at R0.5 for hybrids).

    const GAIN_EXCLUDED_RACES = new Set(['custom', 'hybrid', 'junker', 'sludge', 'ultra_sludge']);

    // conflicting trait pairs: possessing one prevents gaining the other (only applies mid-run)
    const GAIN_CONFLICT_PAIRS = [['dumb', 'smart']];

    const availableTraitsToGain = computed(() => {
        const isHybrid = genome.genus === 'hybrid';
        const mainGenus = isHybrid ? (genome.hybrid?.[0] ?? genome.genus) : genome.genus;
        const accessibleGenera = isHybrid ? (genome.hybrid ?? [mainGenus]) : [genome.genus];

        const currentTraits = new Set(genome.traitlist);
        const result = new Map();

        for (const raceKey of Object.keys(races)) {
            if (GAIN_EXCLUDED_RACES.has(raceKey)) continue;
            const raceGenus = races[raceKey]?.type;
            if (!accessibleGenera.includes(raceGenus)) continue;

            const isOffspec = raceGenus !== mainGenus;
            const gainRank = isOffspec ? 0.5 : 1;

            for (const traitKey of Object.keys(races[raceKey].traits ?? {})) {
                if (currentTraits.has(traitKey)) continue;
                if (!traits[traitKey] || traits[traitKey].type !== 'major') continue;
                if (traitKey === 'soul_eater') continue;

                const isConflicted = GAIN_CONFLICT_PAIRS.some(
                    ([a, b]) =>
                        (traitKey === a && currentTraits.has(b)) ||
                        (traitKey === b && currentTraits.has(a)),
                );
                if (isConflicted) continue;

                // if a trait appears in multiple races, keep the highest rank
                const existingRank = result.get(traitKey);
                if (!existingRank || gainRank > existingRank) {
                    result.set(traitKey, gainRank);
                }
            }
        }

        return [...result.entries()]
            .map(([traitKey, gainRank]) => ({ traitKey, gainRank }))
            .sort((a, b) =>
                (traits[a.traitKey]?.name ?? a.traitKey).localeCompare(
                    traits[b.traitKey]?.name ?? b.traitKey,
                ),
            );
    });

    // ─── Provide context to child components ──────────────────────────────────────

    provide('labContext', {
        // trait card
        genome,
        tRanks,
        traitNameClass,
        traitAuraClasses,
        traitClick,
        getTraitCost,
        isEmpowered,
        reduce,
        increase,
        loc,
        rankDisplay,
        // Control panel
        isControlPanelOpen,
        searchQuery,
        searchScope,
        favoritingMode,
        isConsolidatedView,
        activeSortStack,
        activeFilters,
        addSortMethod,
        removeSortMethod,
        toggleSortReversed,
        toggleGroupByPolarity,
        resetDisplay,
        toggleFilter,
        onSortStackReorder,
        SORT_METHODS,
        SORT_METHODS_BY_ID,
        TRAIT_FILTERS,
        TRAIT_FILTERS_BY_ID,
        TAXONOMY_ORDER,
        // planning section
        planningState,
        availableRacesForPlanning,
        imitationOptions,
        isImitationVisible,
        races,
        // stat card
        untappedGenes,
        geneCountClass,
        mutationPlasmidCost,
        // Mutation planner
        mutationPlan,
        availableTraitsToGain,
        // import diagnostics
        importRankViolations,
    });
</script>

<template>
    <div>
        <!-- ── header: gene count ──────────────────────────────────────────────── -->
        <RaceStatCard />

        <!-- ── wiki specific controls ───────────────────────────────────────────────────── -->
        <div
            v-if="isWiki"
            style="margin-top: 0.5rem"
        >
            <div class="has-text-caution">{{ loc('achieve_ascended_name') }}</div>
            <div
                v-for="uni in Object.keys(universe_types)"
                :key="uni"
                class="calcInput"
            >
                <span>{{ loc('universe_' + uni) }}</span>
                <b-numberinput
                    v-model="wikiVars.ascended[uni]"
                    :input="val(uni)"
                    :min="0"
                    :max="5"
                    :controls="false"
                ></b-numberinput>
            </div>
            <div
                class="has-text-caution"
                style="margin-top: 0.25rem"
            >
                {{ loc('achieve_technophobe_name') }}
            </div>
            <div class="calcInput">
                <b-numberinput
                    v-model="wikiVars.technophobe"
                    :input="val('technophobe')"
                    :min="0"
                    :max="5"
                    :controls="false"
                ></b-numberinput>
            </div>
            <b-checkbox
                v-model="sandboxMode"
                style="margin-top: 0.25rem"
                >{{ loc('genelab_sandbox') }}</b-checkbox
            >
        </div>

        <!-- ── input fields: race identity ────────────────────────────────────────────────── -->
        <div class="fields">
            <div class="name">
                {{ loc('genelab_name') }}
                <b-input
                    v-model="genome.name"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="entity">
                {{ loc('genelab_entity') }}
                <b-input
                    v-model="genome.entity"
                    maxlength="40"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_home') }}
                <b-input
                    v-model="genome.home"
                    maxlength="20"
                ></b-input>
            </div>
            <div>
                {{ loc('genelab_desc') }}
                <b-input
                    v-model="genome.desc"
                    maxlength="255"
                ></b-input>
            </div>
        </div>

        <!-- ── input fields: standard planets ───────────────────────────────────────── -->
        <div class="fields">
            <div class="name">
                {{ loc('genelab_red') }}
                <b-input
                    v-model="genome.red"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_hell') }}
                <b-input
                    v-model="genome.hell"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_gas') }}
                <b-input
                    v-model="genome.gas"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_gas_moon') }}
                <b-input
                    v-model="genome.gas_moon"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_dwarf') }}
                <b-input
                    v-model="genome.dwarf"
                    maxlength="20"
                ></b-input>
            </div>
        </div>

        <!-- ── input fields: TP planets ──────────────────────────────────────── -->
        <div class="fields">
            <div class="name">
                {{ loc('genelab_titan') }}
                <b-input
                    v-model="genome.titan"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_enceladus') }}
                <b-input
                    v-model="genome.enceladus"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_triton') }}
                <b-input
                    v-model="genome.triton"
                    maxlength="20"
                ></b-input>
            </div>
            <div class="name">
                {{ loc('genelab_eris') }}
                <b-input
                    v-model="genome.eris"
                    maxlength="20"
                ></b-input>
            </div>
        </div>

        <!-- ── sequence area ───────────────────────────────────────────────────── -->
        <div class="sequence">
            <!-- ── Genus / control column ─────────────────────────────────────── -->
            <div class="genus_selection">
                <!-- Genus button (decent candidate for another smaller SFC soon) -->
                <div class="genus">
                    <div class="has-text-caution header">
                        {{ loc('genelab_genus') }}
                    </div>
                    <button
                        class="button"
                        :disabled="isGenusModalBusy"
                        @click.stop="openGenusModal(0)"
                    >
                        {{ loc('genelab_genus_' + (genome.hybrid ? genome.hybrid[0] : genome.genus)) }}
                    </button>
                </div>

                <!-- Hybrid genus B button -->
                <div
                    v-if="genome.hybrid"
                    class="genus"
                >
                    <div class="has-text-caution header">
                        {{ loc('genelab_genus_b') }}
                    </div>
                    <button
                        class="button"
                        :disabled="isGenusModalBusy"
                        @click.stop="openGenusModal(1)"
                    >
                        {{ loc('genelab_genus_' + genome.hybrid[1]) }}
                    </button>
                </div>

                <!-- Fanaticism button -->
                <div
                    id="geneLabFanatic"
                    class="genus"
                >
                    <div class="has-text-caution header">
                        {{ loc('tech_fanaticism') }}
                    </div>
                    <button
                        class="button"
                        @click.stop="isFanaticismModalOpen = true"
                    >
                        {{ fanaticismLabel(genome.fanaticism) }}
                    </button>
                </div>

                <!-- reset button -->
                <div class="resetLab">
                    <button
                        class="button"
                        @click="reset()"
                    >
                        {{ loc('genelab_reset') }}
                    </button>
                </div>

                <!-- sort and filter options control panel -->
                <lab-control-panel />
            </div>
            <!-- end genus_selection column -->

            <!-- ── trait display area ──────────────────────────────────────────── -->
            <div style="flex: 1; min-width: 0">
                <!-- target rank bar -->
                <div
                    class="targetRank"
                    style="display: flex; gap: 0.25rem; margin-bottom: 0.25rem; align-items: center"
                >
                    <button
                        v-for="rank in [0.1, 0.25, 0.5, 1, 2, 3, 4]"
                        :key="rank"
                        class="button is-small"
                        :class="{ 'is-primary': targetRank === rank }"
                        @click="updateTargetRank(rank)"
                    >
                        {{ rankDisplay(rank) }}
                    </button>
                    <span
                        v-if="tempTargetRank !== null"
                        class="has-text-caution"
                        style="
                            font-size: 0.8rem;
                            animation: pulse 1s infinite;
                            margin-left: 0.25rem;
                        "
                    >
                        {{ loc('genelab_rank_override') }}: {{ rankDisplay(tempTargetRank) }}
                    </span>
                </div>

                <!-- Trait tabs -->
                <b-tabs
                    v-model="activeTab"
                    :animation="slideDirection"
                >
                    <!-- All tab -->
                    <b-tab-item :label="loc('genelab_traits_all')">
                        <div id="traitAll">
                            <!-- consolidated view (default off): single flat list of all traits without taxonomy sections -->
                            <template v-if="isConsolidatedView">
                                <div class="lame trait_selection">
                                    <lab-trait-card
                                        v-for="trait in displayedTraits"
                                        :key="trait"
                                        :trait="trait"
                                    />
                                </div>
                            </template>

                            <!-- default All tab; all traits sectioned by taxonomy + Summary -->
                            <template v-else>
                                <template
                                    v-for="taxon in TAXONOMY_ORDER"
                                    :key="taxon"
                                >
                                    <h3 v-if="displayedByTaxon[taxon].length">
                                        {{ loc('genelab_traits_' + taxon) }}
                                    </h3>
                                    <div class="lame trait_selection">
                                        <lab-trait-card
                                            v-for="trait in displayedByTaxon[taxon]"
                                            :key="trait"
                                            :trait="trait"
                                        />
                                    </div>
                                </template>
                            </template>

                            <!-- Summary: all selected traits, unified across all tabs -->
                            <template v-if="summaryTraits.length">
                                <h3>
                                    {{ loc('genelab_traits_summary') }}
                                </h3>
                                <div
                                    id="allSum"
                                    class="trait_selection summary"
                                >
                                    <lab-trait-card
                                        v-for="trait in summaryTraits"
                                        :key="trait"
                                        :trait="trait"
                                        :in-summary="true"
                                    />
                                </div>
                            </template>
                        </div>
                    </b-tab-item>

                    <!-- per-taxonomy tabs -->
                    <b-tab-item
                        v-for="taxon in TAXONOMY_ORDER"
                        :key="taxon"
                        :label="loc('genelab_traits_' + taxon)"
                    >
                        <div
                            v-if="isSearchMode"
                            class="has-text-caution"
                            style="font-size: 0.8rem; margin-bottom: 0.25rem"
                        >
                            {{ loc('genelab_search_all_taxa') }}
                        </div>
                        <div class="cool trait_selection">
                            <lab-trait-card
                                v-for="trait in isSearchMode
                                    ? displayedTraits
                                    : displayedByTaxon[taxon]"
                                :key="trait"
                                :trait="trait"
                            />
                        </div>
                        <!-- Summary: all selected traits, unified across all tabs -->
                        <template v-if="summaryTraits.length">
                            <h3>{{ loc('genelab_traits_summary') }}</h3>
                            <div class="trait_selection summary">
                                <lab-trait-card
                                    v-for="trait in summaryTraits"
                                    :key="trait"
                                    :trait="trait"
                                    :in-summary="true"
                                />
                            </div>
                        </template>
                    </b-tab-item>
                </b-tabs>

                <!-- planning section: for planning/visualizing post-race-creation changes, IE
				an inherit(s)/imitation bar, a mutations bar, and a toggle for previewing the final resulting race -->
                <lab-planning-section />
            </div>
            <!-- end trait display area -->
        </div>
        <!-- end sequence area (should probably be renamed) -->

        <!-- ── Import / Export / Create ───────────────────────────────────────── -->
        <RaceStatCard style="margin-top: 0.75rem" />

        <ActionBar
            :errorMsg="errorMsg"
            style="margin-top: 0.5rem"
        >
            <template #left>
                <FileImportButton
                    :label="loc('genelab_import')"
                    @import="customImport($event)"
                />
            </template>
            <template #right>
                <button
                    class="button"
                    @click="customExport()"
                >
                    {{ loc('genelab_export') }}
                </button>
            </template>
        </ActionBar>

        <div
            v-if="!isWiki"
            class="create"
            style="margin-top: 0.5rem"
        >
            <button
                class="button is-primary"
                :disabled="!isGenomeValid"
                @click="setRace()"
            >
                {{ loc('genelab_create') }}
            </button>
        </div>

        <!-- genus selection modal -->
        <b-modal
            v-model="isGenusModalOpen"
            has-modal-card
            append-to-body
        >
            <div
                class="modal-card"
                style="border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px"
            >
                <header class="modal-card-head">
                    <p class="modal-card-title">{{ loc('genelab_genus') }}</p>
                </header>
                <section class="modal-card-body modalBody">
                    <!-- one row per genus opposition group; color-coded border to identify the cluster at a glance
                    a genus with no unlocked opponent(s) appears in its own solo cluster row -->
                    <div
                        v-for="(group, ci) in genusGroups"
                        :key="ci"
                        style="
                            display: flex;
                            gap: 0.4rem;
                            margin-bottom: 0.4rem;
                            padding-left: 0.5rem;
                            align-items: center;
                        "
                        :style="{
                            borderLeft: `3px solid ${CLUSTER_BORDER_COLORS[ci % CLUSTER_BORDER_COLORS.length]}`,
                        }"
                    >
                        <button
                            v-for="g in group"
                            :key="g"
                            class="button"
                            :class="{ 'is-primary': currentModalGenus === g }"
                            @click="selectGenus(g)"
                        >
                            {{ loc('genelab_genus_' + g) }}
                            <span
                                :class="geneDeltaClass(g)"
                                style="margin-left: 0.35rem; font-size: 0.85em"
                            >
                                ({{ formatGeneDelta(genusGeneDeltaMap.get(g) ?? 0) }})
                            </span>
                        </button>
                    </div>
                </section>
            </div>
        </b-modal>

        <!-- fanaticism selection modal -->
        <b-modal
            v-model="isFanaticismModalOpen"
            has-modal-card
            append-to-body
        >
            <div
                class="modal-card"
                style="border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px"
            >
                <header class="modal-card-head">
                    <p class="modal-card-title">{{ loc('tech_fanaticism') }}</p>
                </header>
                <section class="modal-card-body modalBody">
                    <div class="genus_selection">
                        <!-- None option -->
                        <div
                            class="field"
                            style="
                                margin-right: 0.5rem;
                                margin-bottom: 0.25rem;
                                display: inline-block;
                            "
                        >
                            <button
                                class="button"
                                :class="{ 'is-primary': !genome.fanaticism }"
                                @click="
                                    genome.fanaticism = false;
                                    isFanaticismModalOpen = false;
                                    geneEdit();
                                "
                            >
                                {{ loc('genelab_unset') }}
                            </button>
                        </div>
                        <!-- Eligible trait options -->
                        <div
                            v-for="t in fanaticismOptions"
                            :key="t"
                            class="field"
                            style="
                                margin-right: 0.5rem;
                                margin-bottom: 0.25rem;
                                display: inline-block;
                            "
                        >
                            <button
                                class="button"
                                :class="{ 'is-primary': genome.fanaticism === t }"
                                @click="
                                    genome.fanaticism = t;
                                    isFanaticismModalOpen = false;
                                    geneEdit();
                                "
                            >
                                {{ fanaticismLabel(t) }}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </b-modal>
    </div>
</template>
