// background.js — Manifest V3 service worker
// Fetches AWS public pricing data every 24 hours

const CACHE_KEY = 'aws_lens_specs';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// EC2 instance data from Vantage (most comprehensive public source)
const EC2_INSTANCES_URL = 'https://instances.vantage.sh/instances.json';

chrome.runtime.onInstalled.addListener(() => {
  refreshData();
});

chrome.alarms.create('refresh', { periodInMinutes: 1440 }); // every 24h
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') refreshData();
});

async function refreshData() {
  try {
    const resp = await fetch(EC2_INSTANCES_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const instances = await resp.json();

    // Transform Vantage format → our format
    const ec2 = {};
    for (const inst of instances) {
      const name = inst.instance_type;
      ec2[name] = {
        vcpu: inst.vCPU,
        ram_gb: inst.memory,
        network: inst.network_performance || 'Unknown',
        storage: inst.storage?.devices
          ? `${inst.storage.devices}× ${inst.storage.size}GB ${inst.storage.type}`
          : 'EBS only',
        price_usd_hr: inst.pricing?.['us-east-1']?.linux?.ondemand ?? null,
      };
    }

    // Store EC2 data
    await chrome.storage.local.set({
      [CACHE_KEY + '_ec2']: ec2,
      [CACHE_KEY + '_updated']: Date.now(),
    });

    console.log(`[AWS Lens] Updated EC2 specs: ${Object.keys(ec2).length} instance types`);
  } catch (e) {
    console.warn('[AWS Lens] Failed to refresh EC2 data:', e.message);
    // Content script will fall back to bundled data/instance_specs.json
  }
}
