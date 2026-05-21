<!-- call site usage example(self closing tags where applicable):

    <CalcWrapper calcId="massCalc" :title="loc('...')">
        <template #formula>...</template>
        <template #variables>
            input fields here
            <CalcButtons showImport
                :resetLabel="loc('wiki_calc_reset')"
                :importLabel="loc('wiki_calc_import')"
                @reset="resetInputs()"
                @import="importFromGame()"
            />
        </template>
    </CalcWrapper>

    this one def isn't finished yet
-->

<template>
    <div
        class="calc"
        :id="calcId"
    >
        <h2
            v-if="title"
            class="has-text-caution"
        >
            {{ title }}
        </h2>
        <slot name="formula" />
        <slot name="variables" />
    </div>
</template>

<script>
    export default {
        name: "CalcWrapper",
        props: {
            calcId: { type: String, required: true },
            title: { type: String, default: null },
        },
    };
</script>
