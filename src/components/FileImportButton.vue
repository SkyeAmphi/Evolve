<script setup>
    import { ref } from "vue";

    defineProps({
        label:       { type: String, required: true },
        accept:      { type: String, default: ".txt" },
        buttonClass: { type: String, default: "button" },
    });

    const emit = defineEmits(["import"]);

    const fileInput = ref(null);
    const stagedFile = ref(null);

    function openPicker() {
        fileInput.value?.click();
    }

    function onFileSelected(event) {
        stagedFile.value = event.target.files?.[0] ?? null;
    }

    function applyFile() {
        if (!stagedFile.value) return;
        emit("import", stagedFile.value);
    }
</script>

<template>
    <div style="display:inline-flex; align-items:center; gap:.5rem">
        <!-- hidden native input to trigger the OS/platform file picker -->
        <input
            ref="fileInput"
            type="file"
            :accept="accept"
            style="display:none"
            @change="onFileSelected"
        />

        <!-- Import Species button: left-most, disabled until a file is staged -->
        <button :class="buttonClass" :disabled="!stagedFile" @click="applyFile">
            {{ label }}
        </button>

        <!-- Browse button: no game class so it keeps native browser appearance -->
        <button @click="openPicker">Browse...</button>

        <!-- filename/selection indicator: plain text, to the right of browse button -->
        <span style="font-size:.85em; opacity:.7">
            {{ stagedFile ? stagedFile.name : "No file selected." }}
        </span>
    </div>
</template>
