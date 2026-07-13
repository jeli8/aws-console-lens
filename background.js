// background.js — Manifest V3 service worker
// Instance specs are now fetched on-demand via ec2.shop in popup.js
// This worker cleans up stale cache entries once per day.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('cache-cleanup', { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'cache-cleanup') return;
  const all = await chrome.storage.local.get(null);
  const staleKeys = [];
  for (const [key, val] of Object.entries(all)) {
    if (key.endsWith('_ts') && Date.now() - val > CACHE_TTL_MS) {
      staleKeys.push(key, key.replace(/_ts$/, ''));
    }
  }
  if (staleKeys.length) await chrome.storage.local.remove(staleKeys);
});
