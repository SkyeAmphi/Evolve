<!--
    renders the ( cost[, rank][E] ) badge for a trait

    props:
        trait      – required, the trait key string
        inSummary  – show rank inside the parens (summary view only); default false

    usage examples:
    
        list view: 
        <TraitCostBadge :trait="trait" />

        summary view: 
        <TraitCostBadge 
            :trait="trait" 
            in-summary 
        />

    inject (from 'labContext'):
        genome, tRanks, getTraitCost, isEmpowered, rankDisplay
-->

<script setup>
    import { inject } from "vue";

    defineProps({
    	trait: { type: String, required: true },
    	inSummary: { type: Boolean, default: false },
    });

    const { genome, tRanks, getTraitCost, isEmpowered, rankDisplay } =
    	inject("labContext");
</script>

<template>
    (
        <span :class="getTraitCost(trait) >= 0 ? 'has-text-advanced' : 'has-text-caution'">
            {{ getTraitCost(trait) }}
        </span>
        <template v-if="(inSummary && genome.traitlist.includes(trait)) || isEmpowered(trait)"
            >,<template 
                v-if="inSummary && genome.traitlist.includes(trait)"
            >
                {{ rankDisplay(tRanks[trait] || 1) }}
            </template>
            <span
                v-if="isEmpowered(trait)"
                class="has-text-caution"
                >E</span
            >
        </template>
    )
</template>
