// src/vue-cdn-shim.js
const V = window.Vue;
export default V;

// All named exports that compiled SFC templates and Vue APIs need
export const {
    // App & lifecycle
    createApp, defineComponent, nextTick, h,
    onMounted, onUnmounted, onBeforeMount, onBeforeUnmount, onUpdated,
    // Reactivity
    reactive, ref, computed, watch, watchEffect, toRefs, toRef, unref, isRef,
    markRaw, toRaw, shallowRef, shallowReactive, triggerRef,
    // Render helpers used by compiled templates
    openBlock, createBlock, createElementBlock, createElementVNode,
    createCommentVNode, createTextVNode, createVNode,
    Fragment, Teleport, Suspense,
    resolveComponent, resolveDirective,
    withCtx, withDirectives, withModifiers, withKeys,
    renderSlot, renderList,
    toDisplayString, normalizeClass, normalizeStyle, normalizeProps,
    guardReactiveProps, mergeProps, cloneVNode,
    // Built-in directives
    vShow, vModelText, vModelCheckbox, vModelSelect, vModelRadio, vModelDynamic,
    // Built-in components
    Transition, TransitionGroup, KeepAlive,
    // Provide/inject
    provide, inject,
    // Misc
    getCurrentInstance, useSlots, useAttrs, version
} = V;