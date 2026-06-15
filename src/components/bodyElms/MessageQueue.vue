<script setup>
    import { ref } from "vue";

    import { global, message_logs, message_filters } from '../../vars.js';
    import { loc } from '../../locale.js';

    let s = ref(global.settings.msgFilters);
    let m = ref(message_logs);
    let queue = ref(global.queue);
    console.log(s);

    
    function swapFilter(name){
        console.log('swap to',name);
    }

    function msgQueueFilters(){
        let filters='';
        message_filters.forEach(function (filter){
            filters+=`
                <span id="msgQueueFilter-${filter}" class="${filter === 'all' ? 'is-active' : ''}" aria-disabled="${filter === 'all' ? 'true' : 'false'}" @click="swapFilter('${filter}')" v-show="s.${filter}.vis" role="button">${loc('message_log_' + filter)}</span>
            `;
        });
        return filters;
    }
</script>
<template>
    <div id="buildQueue" class="bldQueue standardqueuestyle has-text-info" v-show="queue.display"></div>

    <div id="msgQueue" class="msgQueue vscroll has-text-info" aria-live="polite">
        <div id="msgQueueHeader">

            <h2 class="has-text-success">{{ loc('message_log') }}</h2>

            <span class="special" role="button" title="message queue options" @click="trigModal">
                <svg version="1.1" x="0px" y="0px" width="12px" height="12px" viewBox="340 140 280 279.416" enable-background="new 340 140 280 279.416" xml:space="preserve">
                    <path class="gear" d="M620,305.666v-51.333l-31.5-5.25c-2.333-8.75-5.833-16.917-9.917-23.917L597.25,199.5l-36.167-36.75l-26.25,18.083
                    c-7.583-4.083-15.75-7.583-23.916-9.917L505.667,140h-51.334l-5.25,31.5c-8.75,2.333-16.333,5.833-23.916,9.916L399.5,163.333
                    L362.75,199.5l18.667,25.666c-4.083,7.584-7.583,15.75-9.917,24.5l-31.5,4.667v51.333l31.5,5.25
                    c2.333,8.75,5.833,16.334,9.917,23.917l-18.667,26.25l36.167,36.167l26.25-18.667c7.583,4.083,15.75,7.583,24.5,9.917l5.25,30.916
                    h51.333l5.25-31.5c8.167-2.333,16.333-5.833,23.917-9.916l26.25,18.666l36.166-36.166l-18.666-26.25
                    c4.083-7.584,7.583-15.167,9.916-23.917L620,305.666z M480,333.666c-29.75,0-53.667-23.916-53.667-53.666s24.5-53.667,53.667-53.667
                    S533.667,250.25,533.667,280S509.75,333.666,480,333.666z"/>
                </svg>
            </span>

            <span role="button" class="zero has-text-advanced" @click="clearLog(m.view)">{{ loc('message_log_clear') }}</span>

            <span role="button" class="zero has-text-advanced" @click="clearLog()">{{ loc('message_log_clear_all') }}</span>

        </div>

        <h2 class="is-sr-only">{{ loc('message_filters') }}</h2>
        
        <div id="msgQueueFilters" class="hscroll msgQueueFilters" v-html="msgQueueFilters()">
            
        </div>
        <!-- <span 
                v-for="filter in message_filters"
                :id="'msgQueueFilter-' + filter"
                :class="(filter === 'all' ? 'is-active' : '')"
                :aria-disabled="(filter === 'all' ? 'true' : 'false')"
                @click="swapFilter(filter)"
                v-show="s[filter].vis"
                role="button"
            >{{ loc('message_log_' + filter) }}</span> -->
        
        <h2 class="is-sr-only">{{ loc('messages') }}</h2>
        
        <div id="msgQueueLog" aria-live="polite"></div>
    </div>
</template>