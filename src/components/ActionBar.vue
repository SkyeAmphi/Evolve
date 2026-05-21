<script setup>
    defineProps({
        errorMsg: { type: String, default: "" },
    });
</script>

<template>
    <div>
        <div style="display:flex; justify-content:space-between; align-items:center">
            <div>
                <slot name="left" />
            </div>
            <div>
                <slot name="right" />
            </div>
        </div>
        <div
            v-if="errorMsg"
            class="has-text-danger"
            style="margin-top:.25rem"
        >
            {{ errorMsg }}
        </div>
    </div>
</template>
