<!-- usage example at call site:

    <CalcDropdown
        v-model="i['class'].val"
        :options="classOptions"
    />
-->

<template>
    <b-dropdown
        hoverable
        :scrollable="scrollable"
    >
        <template #trigger>
            <button class="button is-primary">
                <span>
                    {{ selectedLabel }}
                </span>
                <i class="fas fa-sort-down" />
            </button>
        </template>
        <b-dropdown-item
            v-for="option in options"
            :key="option.value"
            @click="$emit('update:modelValue', option.value)"
        >
            {{ option.label }}
        </b-dropdown-item>
    </b-dropdown>
</template>

<script>
    export default {
        name: "CalcDropdown",
        props: {
            modelValue: { default: undefined },
            options: { type: Array, required: true }, // [{ value, label }]
            scrollable: { type: Boolean, default: false },
            placeholder: { type: String, default: 'None Selected' },
        },
        emits: ["update:modelValue"],
        computed: {
            selectedLabel() {
                const selected = this.options.find(
                    (o) => o.value === this.modelValue
                );
                return selected?.label ?? this.placeholder;
            },
        },
    };
</script>
