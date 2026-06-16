<script setup>
    import { ref } from 'vue';

    import { loc } from '../../locale.js';
    import { global, message_logs } from '../../vars.js';
    import { clearElement } from '../../functions.js';
    // import { swapFilter }
    const { filter } = defineProps({
        filter: { type: String },
    });
    const s = ref(global.settings.msgFilters);
    const m = ref(message_logs);

    function swapFilter(filter){
        console.log('swap to',filter);
        if (m.value.view !== filter){
            $(`#msgQueueFilter-${m.value.view}`).removeClass('is-active').attr('aria-disabled', 'false');
            $(`#msgQueueFilter-${filter}`).addClass('is-active').attr('aria-disabled', 'true');
            m.value.view = filter;
            let jqueue = $(`#msgQueueLog`);
            clearElement(jqueue);
            m.value[filter].forEach(function (msg){
                jqueue.append($(`<p class="has-text-${msg.color}"></p>`).text(msg.msg));
            });
        }
    }
</script>
<template>
    <span
        :id="'msgQueueFilter-' + filter"
        :class="filter === 'all' ? 'is-active' : ''"
        :aria-disabled="filter === 'all' ? 'true' : 'false'"
        @click="swapFilter(filter)"
        v-show="s[filter].vis"
        role="button"
    >{{ loc('message_log_' + filter) }}</span>
</template>