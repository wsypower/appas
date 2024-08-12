/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols

import type { App } from 'vue';
import useUserStore from '@/store/modules/user';

export function isApass() {
  return import.meta.env.MODE === 'apaas';
}

function injectAdapterStyle() {
  const style = document.createElement('style');
  const css = `
  #app-main > header{
    display: none
  }
  #app-main .topbar-container{
    display: none
  }
`;
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

function injectAppStyle(app: App) {
  app._container.style.height = '100vh';
}

function injectReviseCssVar() {
  const cssVars = {
    '--g-header-height': '0',
    '--g-main-sidebar-width': '0',
    '--g-sub-sidebar-width': '0',
    '--g-sub-sidebar-collapse-width': '0',
    '--g-sidebar-logo-height': '0',
    '--g-tabbar-height': '0',
    '--g-toolbar-height': '0',
    '--g-tabbar-tab-max-width': '0',
    '--g-tabbar-tab-min-width': '0',
  };
  const root = document.documentElement;

  for (const [varName, value] of Object.entries(cssVars)) {
    root.style.setProperty(varName, value);
  }
}

function adapterStyle(app: App) {
  injectAdapterStyle();
  injectReviseCssVar();
  injectAppStyle(app);
}

function adapterContainer(app: App) {
  window.addEventListener('unmount', () => {
    app.unmount();
  });
}

function adapterToken() {
  const token = sessionStorage.getItem('Access-Token');
  const userStore = useUserStore();
  userStore.user.token = token!;
}

export function apaasClean() {
  window.microApp.dispatch({ type: 'logout' });
  localStorage.clear();
  sessionStorage.clear();
}

export function adapterApaas(app: App) {
  if (isApass()) {
    adapterStyle(app);
    adapterContainer(app);
    adapterToken();
  }
}
