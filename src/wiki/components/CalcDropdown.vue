<!--
    CalcDropdown renders its own calcInput wrapper (label row + dropdown row)
    whenever a label is present, either auto-derived from `trait`, or passed
    explicitly via `label`.
    without a label, it renders just the bare dropdown,
    and the callsite is responsible for any wrapper it needs.

    here are some various usage examples:

    trait mode; auto-derives label and rank options from trait; doesn't need a wrapper:
    <calc-dropdown 
        v-model="i.chicken.val" 
        trait="chicken"
    ></calc-dropdown>

    trait mode but with PascalCasing and self closing tags, for use in other .vue files(doesn't work in template literal strings):
    <CalcDropdown 
        v-model="i.chicken.val" 
        trait="chicken"
    />

    trait mode, but conditionally visible:
    <calc-dropdown 
        v-show="i.freespirit.vis" 
        v-model="i.freespirit.val" 
        trait="freespirit"
    ></calc-dropdown>

    labeled via explicit label prop (has its own wrapper; use for non-trait dropdowns):
    <calc-dropdown 
        :label="'${loc("civics_government")}'" 
        v-model="i.government.val" 
        :options="govOptions"
    ></calc-dropdown>

    standalone / no label (callsite will have any wrapper it needs):
    <calc-dropdown 
        v-model="i['class'].val" 
        :options="classOptions"
    ></calc-dropdown>
-->

<template>
    <!-- labeled: has its own calcInput wrapper, draws in two rows;
    label stacked above, and the dropdown stacked below -->
    <div
        v-if="resolvedLabel"
        class="calcInput"
    >
        <div>
            <span>
                {{ resolvedLabel }}
            </span>
        </div>
        <div>
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
                    v-for="option in resolvedOptions"
                    :key="option.value"
                    @click="$emit('update:modelValue', option.value)"
                >
                    {{ option.label }}
                </b-dropdown-item>
            </b-dropdown>
        </div>
    </div>

    <!-- standalone mode: no label, just the dropdown; callsite will have any wrapper it needs -->
    <b-dropdown
        v-else
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
            v-for="option in resolvedOptions"
            :key="option.value"
            @click="$emit('update:modelValue', option.value)"
        >
            {{ option.label }}
        </b-dropdown-item>
    </b-dropdown>
</template>

<script>
    import { loc } from '../../locale.js';

    // standard trait rank progression shared by all genus/major traits
    // update here if new trait ranks ever get added to the game
    const TRAIT_RANKS = [0.1, 0.25, 0.5, 1, 2, 3, 4];

    export default {
        name: "CalcDropdown",
        props: {
            modelValue: { default: undefined },
            options: { type: Array, default: null }, // [{ value, label }]
            scrollable: { type: Boolean, default: false },
            placeholder: { type: String, default: null },
            // trait key (IE "chicken"): auto-derives label and rank options from the passed trait
            trait: { type: String, default: null },
            // explicit label for non-trait labeled dropdowns; component will have its own calcInput wrapper when set
            label: { type: String, default: null },
        },
        emits: ["update:modelValue"],
        computed: {
            resolvedLabel() {
                if (this.label !== null) return this.label;
                if (this.trait) return loc(`trait_${this.trait}_name`);
                return null;
            },
            resolvedPlaceholder() {
                if (this.placeholder !== null) return this.placeholder;
                if (this.trait) return loc('wiki_calc_trait_unowned');
                return 'None Selected';
            },
            resolvedOptions() {
                if (this.options !== null) return this.options;
                if (this.trait) {
                    const unownedLabel = loc('wiki_calc_trait_unowned');
                    return [
                        { value: 0, label: unownedLabel },
                        ...TRAIT_RANKS.map(r => ({ value: r, label: String(r) })),
                    ];
                }
                return [];
            },
            selectedLabel() {
                const selected = this.resolvedOptions.find(
                    (o) => o.value === this.modelValue
                );
                return selected?.label ?? this.resolvedPlaceholder;
            },
        },
    };
</script>
