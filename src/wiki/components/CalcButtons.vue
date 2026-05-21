<!-- usage examples at call site (with self-closing tags):
 
just reset button:
    <CalcButtons
        :resetLabel="loc('wiki_calc_reset')"
        @reset="resetInputs()"
    />

reset and import:
    <CalcButtons
        showImport
        :resetLabel="loc('wiki_calc_reset')"
        :importLabel="loc('wiki_calc_import')"
        @reset="resetInputs()"
        @import="importInputs()"
    />

just import button:
    <CalcButtons
        :showReset="false"
        showImport
        :importLabel="loc('wiki_calc_import')"
        @import="importInputs()"
    />

-->

<template>
    <div class="calcButton">
        <button
            v-if="showReset"
            class="button"
            @click="$emit('reset')"
        >
            {{ resetLabel }}
        </button>
        <button
            v-if="showImport"
            class="button"
            @click="$emit('import')"
        >
            {{ importLabel }}
        </button>
    </div>
</template>

<script>
    export default {
        name: "CalcButtons",
        props: {
            resetLabel: { type: String, default: "Reset" },
            importLabel: { type: String, default: "Import from game" },
            showReset: { type: Boolean, default: true },
            showImport: { type: Boolean, default: false },
        },
        emits: ["reset", "import"],
    };
</script>
