<script setup>
    import { ref, onMounted, onUnmounted, inject } from 'vue';

    const {
        loc,
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
    } = inject('labContext');

    // group visible filters into rows by their group key for rendering
    // filters with no group are independent toggles that get their own row
    // filters from the same group share row(s), and are mutually exclusive
    const visibleFilterGroups = (() => {
        const visible = TRAIT_FILTERS.filter(f => !f.hide);

        // bucket by group key while still preserving definition order
        const groupMap = new Map();
        for (const filter of visible) {
            const key = filter.group ?? '__independent__';
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key).push(filter);
        }

        // split each group's filters into their own row(s), 
        // wrapping at rowBreakBefore markers if we wanna control aesthetics
        const rows = [];
        for (const groupFilters of groupMap.values()) {
            let currentRow = [];
            for (const filter of groupFilters) {
                if (filter.rowBreakBefore && currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
                currentRow.push(filter);
            }
            if (currentRow.length > 0) rows.push(currentRow);
        }
        return rows;
    })();

    const sortStackEl = ref(null);
    let sortableInstance = null;

    onMounted(() => {
        if (typeof Sortable !== 'undefined' && sortStackEl.value) {
            sortableInstance = Sortable.create(sortStackEl.value, {
                animation: 150,
                onEnd(e) {
                    onSortStackReorder(e.oldIndex, e.newIndex);
                },
            });
        }
    });

    onUnmounted(() => {
        sortableInstance?.destroy();
        sortableInstance = null;
    });
</script>

<template>
    <!-- Control panel toggle button -->
    <div style="margin-top:.5rem;text-align:center">
        <button
            class="button is-small"
            @click="isControlPanelOpen = !isControlPanelOpen"
        >
            {{ isControlPanelOpen ? '▲' : '▼' }} {{ loc('genelab_filters') }}
        </button>
    </div>

    <!-- Control panel body -->
    <div
        v-show="isControlPanelOpen"
        style="margin-top:.4rem"
    >
        <!-- Search bar -->
        <b-input
            v-model="searchQuery"
            :placeholder="loc('genelab_search')"
            size="is-small"
            style="margin-bottom:.25rem"
        ></b-input>
        <div style="margin-bottom:.25rem;font-size:.8rem">
            <b-checkbox
                v-model="searchScope.name"
                size="is-small"
                >{{ loc('genelab_search_name') }}</b-checkbox
            >
            <b-checkbox
                v-model="searchScope.desc"
                size="is-small"
                >{{ loc('genelab_search_desc') }}</b-checkbox
            >
            <b-checkbox
                v-model="searchScope.effect"
                size="is-small"
                >{{ loc('genelab_search_effect') }}</b-checkbox
            >
        </div>

        <!-- Favoriting mode toggle -->
        <div style="margin-bottom:.35rem">
            <b-checkbox
                v-model="favoritingMode"
                size="is-small"
            >
                {{ loc('genelab_favoriting_mode') }}
            </b-checkbox>
        </div>

        <!-- consolidated view toggle -->
        <div style="margin-bottom:.35rem">
            <b-checkbox
                v-model="isConsolidatedView"
                size="is-small"
            >
                {{ loc('genelab_consolidated_view') }}
            </b-checkbox>
        </div>

        <!-- sort stack label -->
        <h2 style="font-size:.9rem;margin-bottom:.15rem">
            {{ loc('genelab_sort_order') }}
        </h2>

        <!-- active sort stack (priority based; drag to reorder) -->
        <ul
            ref="sortStackEl"
            style="list-style:none;padding:0;margin-bottom:.25rem !important;margin-left:0;overflow:hidden"
        >
            <li
                v-for="(entry, idx) in activeSortStack"
                :key="entry.methodId"
                style="display:flex;align-items:center;gap:.2rem;margin-bottom:.15rem;cursor:grab;font-size:.8rem;min-width:0"
            >
                <span style="flex-shrink:0">☰</span>
                <span
                    style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"
                >
                    {{ SORT_METHODS_BY_ID.get(entry.methodId)?.label ?? entry.methodId }}
                </span>
                <button
                    class="button is-small"
                    :title="loc('genelab_sort_reverse')"
                    @click="toggleSortReversed(idx)"
                >
                    {{ entry.reversed ? '↑' : '↓' }}
                </button>
                <button
                    class="button is-small"
                    :class="{ 'is-primary': !entry.groupByPolarity }"
                    title="Group positives before negatives"
                    @click="toggleGroupByPolarity(idx)"
                >
                    ±
                </button>
                <button
                    class="button is-small is-danger"
                    @click="removeSortMethod(idx)"
                >
                    ×
                </button>
            </li>
        </ul>

        <!-- add sort method dropdown -->
        <div style="margin-bottom:.35rem">
            <select
                style="font-size:.8rem;width:100%"
                @change="addSortMethod($event.target.value); $event.target.value = ''"
            >
                <option value="">{{ loc('genelab_add_sort') }}</option>
                <option
                    v-for="m in SORT_METHODS.filter(m => !m.hide)"
                    :key="m.id"
                    :value="m.id"
                >
                    {{ m.label }}
                </option>
            </select>
        </div>

        <!-- filters section header -->
        <h2
            style="font-size:.9rem;margin-bottom:.15rem">
            {{ loc('genelab_filters_section') }}
        </h2>

        <!-- filter buttons: data-driven from TRAIT_FILTERS, grouped by filter.group -->
        <div
            v-for="(group, idx) in visibleFilterGroups"
            :key="idx"
            style="display:flex;gap:.25rem;margin-bottom:.2rem;flex-wrap:wrap"
        >
            <button
                v-for="f in group"
                :key="f.id"
                class="button is-small"
                :class="{ 'is-primary': activeFilters[f.id] }"
                @click="toggleFilter(f.id)"
            >
                {{ f.label }}
            </button>
        </div>

        <!-- reset all display settings -->
        <button
            class="button is-small is-warning"
            style="margin-top:.1rem;width:100%"
            @click="resetDisplay()"
        >
            {{ loc('genelab_reset_filters') }}
        </button>
    </div>
</template>
