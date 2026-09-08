(function () {
  // Strip the /open/ prefix → "<space>/<path...>"
  var rest = location.pathname.replace(/^\/open\/?/, '');
  var segments = rest.split('/').filter(Boolean);
  var space = segments[0] || '';
  var subPath = segments.slice(1);

  // Validate: space is a slug, no path-traversal segments. The desktop
  // app validates again on its side — this is defense in depth and keeps
  // the page from ever building anything but a construct:// URL.
  var validSpace = /^[a-z0-9-]+$/.test(space);
  var safePath = subPath.every(function (s) { return s !== '..' && s !== '.'; });

  if (!validSpace || !safePath) {
    document.getElementById('ok').classList.add('hidden');
    document.getElementById('bad').classList.remove('hidden');
    return;
  }

  // Friendly destination label. The page can't resolve a name from the
  // space's (private) graph, so a link can carry one explicitly via
  // ?title= / ?name= — e.g. meet appends the meeting title at share time.
  // We use it as the interstitial label AND forward it on, because the app
  // needs it too: a cross-org/guest recipient can't read the meeting record,
  // so the room page shows the name from ?title=. (Don't strip it.)
  var params = new URLSearchParams(location.search);
  var label = (params.get('title') || params.get('name') || '').trim();

  // construct://app/<space>/<sub-path>?<query>#<hash> — mirrors the in-app
  // route and what useDeepLink.ts already understands.
  var fwd = params.toString();
  var tail = subPath.length ? '/' + subPath.join('/') : '';
  var target = 'construct://app/' + space + tail + (fwd ? '?' + fwd : '') + location.hash;

  document.getElementById('target-label').textContent = label || humanize(space, subPath);

  function launch() { window.location.href = target; }
  document.getElementById('open-btn').addEventListener('click', launch);

  // Auto-attempt the launch on load. Browsers that block scheme launches
  // without a user gesture simply no-op here; the button covers them.
  launch();

  // Fallback label when no ?title is supplied: capitalised space + a
  // humanised trailing path, e.g. "meet" + ["room","32"] → "Meet · Room 32".
  function humanize(spaceId, parts) {
    var s = cap(spaceId);
    if (!parts.length) return s;
    var tailHuman = parts.map(cap).join(' ').replace(/[-_]/g, ' ');
    return s + ' · ' + tailHuman;
  }
  function cap(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }
})();
