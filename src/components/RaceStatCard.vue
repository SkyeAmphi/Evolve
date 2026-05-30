<script setup>
    import { inject } from "vue";

    const {
        loc,
        genome,
        untappedGenes,
        geneCountClass,
        planningState,
        mutationPlasmidCost,
    } = inject("labContext");
</script>

<template>
    <div>
        <h3
            class="has-text-danger"
            style="display:inline"
        >
            {{ loc('genelab_title') }}
        </h3>
        -
        <span class="has-text-warning"
            >{{ loc('genelab_genes') }}
            <span :class="geneCountClass">{{ genome.genes }}</span>
        </span>
        -
        <span class="has-text-warning"
            >{{ loc('trait_untapped_name') }}: {{ untappedGenes }}</span
        >
        <span
            v-if="planningState.mutateOutTraits.length || planningState.mutateInTraits.length"
            style="margin-left:1rem"
        >
            {{ loc('genelab_mutation_cost') }} {{ mutationPlasmidCost }}
        </span>
    </div>
</template>
