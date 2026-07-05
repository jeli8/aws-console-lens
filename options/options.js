async function init() {
  const manifest = chrome.runtime.getManifest();
  document.getElementById('ver-label').textContent = `v${manifest.version}`;
  document.getElementById('about-version').textContent = manifest.version;

  // Spec data freshness
  const stored = await chrome.storage.local.get('aws_lens_specs_updated');
  document.getElementById('about-data').textContent = stored.aws_lens_specs_updated
    ? 'Updated ' + new Date(stored.aws_lens_specs_updated).toLocaleDateString()
    : 'Bundled (open popup to refresh)';

  // Current shortcut
  const commands = await chrome.commands.getAll();
  const actionCmd = commands.find(c => c.name === '_execute_action');
  const shortcutEl = document.getElementById('shortcut-display');
  if (actionCmd?.shortcut) {
    shortcutEl.textContent = actionCmd.shortcut;
  } else {
    shortcutEl.textContent = 'Not set';
    document.getElementById('shortcut-note').textContent =
      'No shortcut assigned. Click "Change shortcut" to set one.';
  }

  document.getElementById('change-shortcut-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

init();
