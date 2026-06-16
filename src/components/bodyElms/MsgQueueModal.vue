<script setup>
    import { ref, onMounted } from 'vue';
    import SeasonHunt from '../SeasonHunt.vue'; 

    import { loc } from '../../locale.js';
    import { global, message_logs, message_filters } from '../../vars.js';


    const s = ref(global.settings.msgFilters);
    const mi = ref({});
    const si = ref({});
    const is_active= ref(false);


    function check(filter){
        if (!global.settings.msgFilters[filter].vis && message_logs.view === filter){
            let haveVis = false;
            Object.keys(global.settings.msgFilters).forEach(function (filt){
                if (global.settings.msgFilters[filt].vis && !haveVis){
                    haveVis = true;
                    $(`#msgQueueFilter-${message_logs.view}`).removeClass('is-active');
                    $(`#msgQueueFilter-${filt}`).addClass('is-active');
                    message_logs.view = filt;
                    let queue = $(`#msgQueueLog`);
                    clearElement(queue);
                    message_logs[filt].forEach(function (msg){
                        queue.append($('<p class="has-text-'+msg.color+'"></p>').text(msg.msg));
                    });
                }
            });
        }
    }
    function checkDisabled(filter,fill){
        if (!s.value[filter].vis){
            return false;
        }
        let totVis = 0;
        Object.keys(s.value).forEach(function (filt){
            if (s.value[filt].vis){
                totVis++;
            }
        });
        
        return totVis === 1;
    }
    function maxVal(filter){
        if (mi.value[filter] < 1){
            mi.value[filter] = 1;
        }
    }
    function saveVal(filter){
        if (si.value[filter] < 0){
            si.value[filter] = 0;
        }
        else if (si.value[filter] > s.value[filter].max){
            si.value[filter] = s.value[filter].max;
        }
    }
    function applyMax(){
        message_filters.forEach(function (filter){
            let max = mi.value[filter];
            s.value[filter].max = max;
            if (max < s.value[filter].save){
                si.value[filter] = max;
                s.value[filter].save = max;
                s.value[filter].splice(max);
            }
            message_logs[filter].splice(max);
            if (message_logs.view === filter){
                $('#msgQueueLog').children().slice(max).remove();
            }
        });
    }
    function applySave(){
        message_filters.forEach(function (filter){
            s.value[filter].save = si.value[filter];
            global.lastMsg[filter].splice(si.value[filter]);
        });
    }
    onMounted(()=>{
        mi.value={};
        si.value={};
        message_filters.forEach(function (filter){
            
            mi.value[filter] = s.value[filter].max;
            si.value[filter] = s.value[filter].save;
        });
    });
</script>
<template>
    <div id="modalBox" class="modalBox">
        <p id="modalBoxTitle" class="has-text-warning modalTitle">{{ loc('message_log') }}<season-hunt :event="'easter'" :num="16" :size="12"></season-hunt></p>
        <div id="specialModal" class="modalBody vscroll">
            <div id="catVis">
                <div>
                    <span class="has-text-warning">{{ loc('message_log_settings_visible') }}</span>
                </div>

                visSet
                <div v-for="filter in message_filters" class="msgInput" v-show="s[filter].unlocked"><span>{{ loc('message_log_' + filter) }}</span> <b-checkbox class="patrol" v-model="s[filter].vis" :disabled="checkDisabled(filter,s[filter].vis)" :input="check(filter)"></b-checkbox></div>
            </div>

            <hr>
            <div id="catMax">
                <div>
                    <span class="has-text-warning">{{ loc('message_log_settings_length') }}</span>
                </div>

                maxSet
                
                <div class="msgInputApply">
                    <button class="button" @click="applyMax()">{{ loc('message_log_settings_apply') }}</button>
                </div>
            </div>

            <hr>
            <div id="catSave">
                <div>
                    <span class="has-text-warning">{{ loc('message_log_settings_save') }}</span>
                </div>

                saveSet
                
                <div class="msgInputApply">
                    <button class="button" @click="applySave()">{{ loc('message_log_settings_apply') }}</button>
                </div>
            </div>
        </div>
    </div>
</template>