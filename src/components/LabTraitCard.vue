<script setup>
    import { inject } from "vue";
    import TraitCostBadge from "./TraitCostBadge.vue";

    defineProps({
        trait: { type: String, required: true },
        inSummary: { type: Boolean, default: false },
    });

    const {
        genome,
        traitNameClass,
        traitAuraClasses,
        traitClick,
        reduce,
        increase,
        loc,
        importRankViolations,
    } = inject("labContext");
</script>

<template>
    <!-- main trait list variant: checkbox + name + cost + Empowered indicator -->
    <div
        v-if="!inSummary"
        class="field"
        :class="[traitAuraClasses[trait], 't' + trait]"
        style="cursor: pointer"
        @click="traitClick(trait)"
    >
        <label
            class="b-checkbox checkbox"
            style="pointer-events: none"
        >
            <input
                type="checkbox"
                :checked="genome.traitlist.includes(trait)"
                autocomplete="off"
            />
            <span class="check"></span>
            <span class="control-label">
                <span :class="traitNameClass(trait)">
                    {{ loc('trait_' + trait + '_name') }}
                </span>
                <span
                    v-if="importRankViolations.has(trait)"
                    class="has-text-warning"
                    style="margin-left:.25rem; font-size:.85em"
                    title="Your Extinction achievement level was too low for the rank imported from file; it was assigned at the nearest legal rank."
                    >⚠</span
                >
                <TraitCostBadge :trait="trait" />
            </span>
        </label>
    </div>

    <!-- Summary variant: checkbox + name + cost/rank/Empowered + rank controls -->
    <div
        v-else
        class="field"
        style="cursor: pointer"
        @click="traitClick(trait, true)"
    >
        <label
            class="b-checkbox checkbox"
            style="pointer-events: none; flex-shrink: 0; margin-right: 0.3rem;"
        >
            <input
                type="checkbox"
                :checked="genome.traitlist.includes(trait)"
                autocomplete="off"
            />
            <span class="check"></span>
        </label>
        <span :class="traitNameClass(trait)">
            {{ loc('trait_' + trait + '_name') }}
        </span>
        <span
            v-if="importRankViolations.has(trait)"
            class="has-text-warning"
            style="margin-left:.25rem; font-size:.85em"
            title="Your Extinction achievement level was too low for the rank imported from file; it was assigned at the nearest legal rank."
            >⚠</span
        >
        <span class="rc">
            <TraitCostBadge
                :trait="trait"
                in-summary
            />
        </span>
        <span
            class="sub"
            @click.stop="reduce(trait)"
            >-</span
        >
        <span
            class="add"
            @click.stop="increase(trait)"
            >+</span
        >
    </div>
</template>
