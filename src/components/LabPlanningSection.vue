<script setup>
    import { computed } from 'vue';
    import { inject } from 'vue';

    const {
        loc,
        genome,
        planningState,
        availableRacesForPlanning,
        imitationOptions,
        isImitationVisible,
        races,
        mutationPlan,
        availableTraitsToGain,
    } = inject('labContext');

    // maps traitKey to gainRank so we can display the rank in gain tags even after selection
    const gainRankByTrait = computed(() =>
        new Map(availableTraitsToGain.value.map(({ traitKey, gainRank }) => [traitKey, gainRank]))
    );

    function gainRankOf(traitKey) {
        return gainRankByTrait.value.get(traitKey) ?? 1;
    }

    function addToMutateOut(event) {
        const trait = event.target.value;
        if (trait && !planningState.mutateOutTraits.includes(trait)) {
            planningState.mutateOutTraits.push(trait);
        }
        event.target.value = '';
    }

    function addToMutateIn(event) {
        const trait = event.target.value;
        if (trait && !planningState.mutateInTraits.includes(trait)) {
            planningState.mutateInTraits.push(trait);
        }
        event.target.value = '';
    }
</script>

<template>
    <div style="margin-top:.75rem;border-top:1px solid rgba(255,255,255,.15);padding-top:.5rem">
        <b-checkbox
            v-model="planningState.isPreviewMode"
            >{{ loc('genelab_preview_mode') }}</b-checkbox
        >

        <!-- Inherit bar: selections for fanaticism/deify/imitation, and toggle for show/hide -->
        <div style="margin-top:.35rem;display:flex;align-items:center;flex-wrap:wrap;gap:.4rem">
            <button
                class="button is-small"
                @click="planningState.isInheritBarOpen = !planningState.isInheritBarOpen"
            >
                {{ planningState.isInheritBarOpen ? '▲' : '▼' }} {{ loc('genelab_inherit') }}
            </button>
            <template v-if="planningState.isInheritBarOpen">
                <div style="display:inline-flex;align-items:center;gap:.2rem">
                    <span
                        class="has-text-caution"
                        style="font-size:.8rem;white-space:nowrap"
                    >
                        {{ loc('tech_fanaticism') }}:
                    </span>
                    <select
                        v-model="planningState.fanaticismTarget"
                        style="font-size:.85rem"
                    >
                        <option :value="null">{{ loc('genelab_unset') }}</option>
                        <option
                            v-for="race in availableRacesForPlanning"
                            :key="race"
                            :value="race"
                        >
                            {{ races[race]?.name ?? race }}
                        </option>
                    </select>
                </div>
                <div style="display:inline-flex;align-items:center;gap:.2rem">
                    <span
                        class="has-text-caution"
                        style="font-size:.8rem;white-space:nowrap"
                        >{{ loc('tech_deify') }}:</span
                    >
                    <select
                        v-model="planningState.deifyTarget"
                        style="font-size:.85rem"
                    >
                        <option :value="null">{{ loc('genelab_unset') }}</option>
                        <option
                            v-for="race in availableRacesForPlanning"
                            :key="race"
                            :value="race"
                        >
                            {{ races[race]?.name ?? race }}
                        </option>
                    </select>
                </div>
                <div
                    v-if="isImitationVisible"
                    style="display:inline-flex;align-items:center;gap:.2rem"
                >
                    <span
                        class="has-text-caution"
                        style="font-size:.8rem;white-space:nowrap"
                        >{{ loc('genelab_imitation_target') }}:</span
                    >
                    <select
                        v-model="planningState.imitationTarget"
                        style="font-size:.85rem"
                    >
                        <option :value="null">{{ loc('genelab_unset') }}</option>
                        <option
                            v-for="race in imitationOptions"
                            :key="race"
                            :value="race"
                        >
                            {{ races[race]?.name ?? race }}
                        </option>
                    </select>
                </div>
            </template>
        </div>

        <!-- Mutation bar: single inline row, wraps if needed -->
        <div style="margin-top:.35rem;display:flex;align-items:center;flex-wrap:wrap;gap:.35rem">
            <button
                class="button is-small"
                @click="planningState.isMutationBarOpen = !planningState.isMutationBarOpen"
            >
                {{ planningState.isMutationBarOpen ? '▲' : '▼' }} {{ loc('genelab_mutations') }}
            </button>

            <template v-if="planningState.isMutationBarOpen">
                <!-- planning section for traits to mutate out -->
                <span
                    class="has-text-caution"
                    style="font-size:.8rem;white-space:nowrap"
                    >Remove:</span
                >
                <span
                    v-if="!mutationPlan.purgeSteps.length"
                    class="has-text-warning"
                    style="font-size:.8rem"
                    >{{ loc('genelab_none') }}</span
                >
                <span
                    v-for="step in mutationPlan.purgeSteps"
                    :key="step.traitKey"
                    class="tag is-danger"
                    style="cursor:pointer"
                    @click="planningState.mutateOutTraits = planningState.mutateOutTraits.filter(t => t !== step.traitKey)"
                    >{{ loc('trait_' + step.traitKey + '_name') }} ({{ step.cost }}) ×</span
                >
                <select
                    v-if="genome.traitlist.length"
                    style="font-size:.85rem"
                    @change="addToMutateOut"
                >
                    <option value="">
                        {{ loc('genelab_add_mutate_out') }}
                    </option>
                    <option
                        v-for="trait in genome.traitlist"
                        :key="trait"
                        :value="trait"
                        :disabled="planningState.mutateOutTraits.includes(trait)"
                    >
                        {{ loc('trait_' + trait + '_name') }}
                    </option>
                </select>

                <!-- planning section for traits to gain via mutations -->
                <template v-if="availableTraitsToGain.length">
                    <span
                        class="has-text-caution"
                        style="font-size:.8rem;white-space:nowrap;margin-left:.25rem"
                        >Gain:</span
                    >
                    <span
                        v-if="!mutationPlan.gainSteps.length"
                        class="has-text-warning"
                        style="font-size:.8rem"
                        >{{ loc('genelab_none') }}</span
                    >
                    <span
                        v-for="step in mutationPlan.gainSteps"
                        :key="step.traitKey"
                        class="tag is-success"
                        style="cursor:pointer"
                        @click="planningState.mutateInTraits = planningState.mutateInTraits.filter(t => t !== step.traitKey)"
                        >{{ loc('trait_' + step.traitKey + '_name') }}
                        (R{{ gainRankOf(step.traitKey) }} · {{ step.cost }}) ×</span
                    >
                    <select
                        style="font-size:.85rem"
                        @change="addToMutateIn"
                    >
                        <option value="">+ gain trait</option>
                        <option
                            v-for="entry in availableTraitsToGain"
                            :key="entry.traitKey"
                            :value="entry.traitKey"
                            :disabled="planningState.mutateInTraits.includes(entry.traitKey)"
                        >
                            {{ loc('trait_' + entry.traitKey + '_name') }} (R{{ entry.gainRank }})
                        </option>
                    </select>
                </template>
            </template>
        </div>
    </div>
</template>
