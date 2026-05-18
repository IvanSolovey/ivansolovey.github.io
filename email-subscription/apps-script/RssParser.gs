// ============================================================
// RssParser.gs — parses Atom (jekyll-feed default) and RSS 2.0
// ============================================================

var RssParser = (function () {

  function parse(xmlText) {
    var doc  = XmlService.parse(xmlText);
    var root = doc.getRootElement();
    return root.getName() === 'feed' ? parseAtom(root) : parseRss(root);
  }

  // ---- Atom (jekyll-feed produces this) ----

  function parseAtom(root) {
    var atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');

    var entries = root.getChildren('entry', atomNs);
    if (!entries || entries.length === 0) {
      entries = root.getChildren('entry'); // fallback: no namespace
    }

    var items = entries.map(function (entry) {
      var id        = text(entry, 'id', atomNs)        || text(entry, 'id');
      var title     = text(entry, 'title', atomNs)     || text(entry, 'title');
      var published = text(entry, 'published', atomNs) || text(entry, 'updated', atomNs)
                   || text(entry, 'published');
      var summary   = text(entry, 'summary', atomNs)   || text(entry, 'summary');

      // <link href="..." rel="alternate"/>
      var link = '';
      var linkEls = entry.getChildren('link', atomNs);
      if (!linkEls || linkEls.length === 0) linkEls = entry.getChildren('link');
      for (var i = 0; i < linkEls.length; i++) {
        var relAttr = linkEls[i].getAttribute('rel');
        if (!relAttr || relAttr.getValue() === 'alternate') {
          var hrefAttr = linkEls[i].getAttribute('href');
          if (hrefAttr) { link = hrefAttr.getValue(); break; }
        }
      }

      return { guid: id, title: title, link: link, summary: summary, published: published };
    });

    return { items: items };
  }

  // ---- RSS 2.0 ----

  function parseRss(root) {
    var channel = root.getChild('channel');
    if (!channel) return { items: [] };

    var items = channel.getChildren('item').map(function (item) {
      var guid = text(item, 'guid') || text(item, 'link');
      return {
        guid:      guid,
        title:     text(item, 'title'),
        link:      text(item, 'link'),
        summary:   text(item, 'description'),
        published: text(item, 'pubDate')
      };
    });

    return { items: items };
  }

  // ---- Utility ----

  function text(el, name, ns) {
    var child = ns ? el.getChild(name, ns) : el.getChild(name);
    return child ? child.getText() : null;
  }

  return { parse: parse };

})();
