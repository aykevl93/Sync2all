
// prefix: gbm (Google BookMarks)

/*
See http://www.mmartins.com/mmartins/googlebookmarksapi/
for details of the Google Bookmarks API
*/

gbm = {};

gbm.name = 'Google Bookmarks';

gbm.api_url = 'https://www.google.com/bookmarks/mark';
gbm.labels;         // kind of label cache
// Copied from GMarks, from the top of the file components/nsIGmarksCom_google.js
gbm.BKMKLET_URL = "https://www.google.com/bookmarks/find?q=javascript&src=gmarksbkmklet";

gbm.rootNodeLabel = localStorage['gbm_rootNodeLabel'] || 'Bookmarks Bar';
gbm.folderSep       = localStorage['gbm_folderSep'] || '/';
gbm.lastSync      = localStorage['gbm_lastSync'] || 0;

use_rqueue(gbm);

gbm.start = function () {
	gbm.reqXml = new XMLHttpRequest();
	gbm.reqXml.open (
				"GET",
				"https://www.google.com/bookmarks/?zx="+syncStartTime+"&output=xml&num=10000",
				true);
	gbm.reqXml.onreadystatechange = gbm.onXmlLoaded;
	gbm.reqXml.send(null);
    gbm.bookmarks = {title: gbm.rootNodeLabel, bm: {}, f: {}};
	gbm.urls      = {}; // dictionary: url => list of bookmarks
	gbm.labels    = {};
	gbm.changed   = {}; // marked to be uploaded
}

gbm.finished_start = function () {
	target_finished(gbm);
	delete gbm.bookmarks;
	delete gbm.labels;
};


gbm.onXmlLoaded = function () {
	if (gbm.reqXml.readyState != 4) return;

	// finished loading

	if (gbm.reqXml.status != 200) {
		alert('Failed to retrieve bookmarks (XML). Is there an internet connection?');
	} else {
		gbm.reqRss = new XMLHttpRequest();
		gbm.reqRss.open("GET", "https://www.google.com/bookmarks/?zx="+syncStartTime+"&output=rss&num=1000&start=0", true);
		gbm.reqRss.onreadystatechange = gbm.onRssLoaded;
		gbm.reqRss.send(null);

		// parse XML while the page is loading
		gbm.parseXmlBookmarks(gbm.reqXml.responseXML);
	}
}

gbm.parseXmlBookmarks = function (xmlTree) {
	try {
		//var google_bookmarks = xmlTree.childNodes[0].childNodes[0].childNodes;
	} catch (err) {
		alert("Failed to parse bookmarks ("+err+") -- are you logged in?");
		return;
	}

	var bm_elements = xmlTree.getElementsByTagName('bookmarks')[0].getElementsByTagName('bookmark');
	for (var i=0; bm_element=bm_elements[i]; i++) {
		var title     =          bm_element.getElementsByTagName('title'    )[0].firstChild.nodeValue;
		var url       =          bm_element.getElementsByTagName('url'      )[0].firstChild.nodeValue;
		url = url.replace(/ /g, '%20');
		//gbm.urls[value] = bookmark;
		var timestamp = parseInt(bm_element.getElementsByTagName('timestamp')[0].firstChild.nodeValue)/1000; // same kind of value as returned by (new Date()).getTime();
		var id        =          bm_element.getElementsByTagName('id'       )[0].firstChild.nodeValue;
		var label_element;
		var label_elements = bm_element.getElementsByTagName('label');
		for (var j=0; label_element=label_elements[j]; j++) {
			var label = label_element.childNodes[0].nodeValue;
			var folder = undefined;
			if (label == gbm.rootNodeLabel) {
				folder = gbm.bookmarks;
			} else {
				if (!gbm.labels[label]) {
					// Add the new folder to the list
					var elements = label.split(gbm.folderSep);
					folder = gbm.bookmarks;
					var element;
					for (var i_element=0; element=elements[i_element]; i_element++) {
						// is this a new directory?
						if (folder.f[element] == undefined) {
							// yes, create it first
							folder.f[element] = {bm: {}, f: {}, title: element, parentNode: folder};
						}
						// folder does exist
						folder = folder.f[element];
					}
					gbm.labels[label] = folder;
				} else {
					folder = gbm.labels[label];
				}
			}
			var bookmark = {url: url, title: title, parentNode: folder, timestamp: timestamp};
			folder.bm[bookmark.url] = bookmark;
			gbm.added_bookmark(bookmark, id);
		}
		if (!label_elements.length) {
			// this bookmark has no labels, add it to root
			var bookmark = {url: url, title: title, parentNode: gbm.bookmarks, timestamp: timestamp};
			gbm.added_bookmark(bookmark, id);
			gbm.bookmarks.bm[url] = bookmark;
		}
	}
	
	/*var sub; // sub element of bookmark element, one bookmark node
	for (var i=0, g_bookmark; g_bookmark=google_bookmarks[i]; i++) {
		var bookmark = {labels: [], ids: []};
		for (var j=0; sub=g_bookmark.childNodes[j]; j++) {
			if (sub.nodeName == 'labels') {
				for (var k=0; labelNode=sub.childNodes[k]; k++) {
					if (labelNode.nodeName != 'label') continue;
					var label = labelNode.childNodes[0].nodeValue;
					if (label == gbm.rootNodeLabel) {
						var folder = gbm.bookmarks;
					} else {
						if (!gbm.labels[label]) {
							// Add the new folder to the list
							var elements = label.split(gbm.folderSep);
							var folder = gbm.bookmarks;
							var element;
							for (var i_element=0; element=elements[i_element]; i_element++) {
								// this is a new directory?
								if (folder.f[element] == undefined) {
									// yes, create it first
									folder.f[element] = {bm: {}, f: {}, title: element, parentNode: folder};
								}
								// folder does exist
								folder = folder.f[element];
							}
							gbm.labels[label] = folder;
						} else {
							var folder = gbm.labels[label];
						}
					}
					bookmark.labels.push(folder);
				}
				continue;
			}
			// the rest are keys/values
			var key = sub.nodeName;
			var value = sub.childNodes[0].nodeValue;
			if (key == 'url') {
				// strange... but is needed
				value = value.replace(/ /g, '%20');

				gbm.urls[value] = bookmark;
			}
			if (key == 'title') {
				// decode UTF-8 encoding in urls
				// maybe for URLs too? (I don't know)
				value = unescape(value);
			}
			bookmark[key] = value;
		}
		if (bookmark.labels.length == 0) {
			bookmark.labels.push(root);
			root.bm[bookmark.url] = bookmark;
		}
		bookmark.time = parseInt(bookmark.timestamp)/1000;
	}*/
}


gbm.onRssLoaded = function () {
	if (gbm.reqRss.readyState != 4) return;

	// readyState = 4
	downloading = false;
	update_ui();

	if (gbm.reqRss.status != 200) {
		alert('Failed to retrieve bookmarks (RSS). Is there an internet connection?');
		console.log(gbm.reqRss);
	} else {
        gbm.parseRssBookmarks(gbm.reqRss.responseXML);
        gbm.finished_start();
	}
}

gbm.parseRssBookmarks = function (xmlTree) {
	//try {
		var channel = xmlTree.firstChild.firstChild;
		gbm.sig     = channel.getElementsByTagName('signature')[0].firstChild.nodeValue;
	/*} catch (err) {
		alert("Failed to parse bookmarks ("+err+") -- are you logged in?");
		return;
	}*/
	var element;
	var elements = channel.getElementsByTagName('item');
	for (var i=0; element=elements[i]; i++) {
		var isbkmk = element.getElementsByTagName('bkmk')[0];
		if (!(isbkmk && isbkmk.firstChild.nodeValue == 'yes')) {
			//console.log(isbkmk);
			continue;
		}
		try {
			var url = element.getElementsByTagName('link' )[0].firstChild.nodeValue;
		} catch (err) {
			/*console.log('isbkmk:');
			console.log(isbkmk.firstChild.nodeValue);
			console.log(element.getElementsByTagName('link' )[0]);*/
		}
	}
}

gbm.added_bookmark = function (bm, id) {
	if (!gbm.urls[bm.url]) {
		gbm.urls[bm.url] = [];
	}
	gbm.urls[bm.url].push(bm);
	gbm.urls[bm.url].id = gbm.urls[bm.url].id || id;
}


gbm.bm_add = function (target, bookmark) {

	gbm.added_bookmark(bookmark);
	gbm.changed[bookmark.url] = bookmark;
	
};

gbm.bm_del = function (target, bookmark) {
	console.log(bookmark);
	// get all bookmarks with this url
	var gbookmark = gbm.urls[bookmark.url];
	// delete this label/folder
	gbookmark.remove(bookmark);
	// if there are labels left (most often: yes)
	if (!gbookmark.length) {
		// no labels, delete this bookmark
		gbm.delete_bookmark(gbookmark.id);
	} else {
		// has still at least one label, upload again (changing the bookmark)
		gbm.upload_bookmark(bookmark);
	}
}

gbm.f_add = false; // doesn't need implementing

gbm.f_del = function (target, folder) {
	for (url in folder.bm) {
		gbm.bm_del(target, folder.bm[url]);
	}
	for (title in folder.f) {
		gbm.f_del(target, folder.f[title]);
	}
};

gbm.bm_mv = function (target, bm, oldParent) {
	gbm.changed[bm.url] = bm;
}

gbm.f_mv = function (target, folder, oldParent) {
	gbm.upload_all(folder); // FIXME there is a better way, see below, but it doesn't work. Make it work.
	/*
	var oldlabel = oldParent == g_bookmarks ? folder.title : gbm.folder_get_label(oldParent)+gbm.folderSep+folder.title;
	var labels = oldlabel+','+gbm.folder_get_label(folder);
	gbm.add_to_queue({op: 'modlabel', labels: labels});*/
};

gbm.bm_mod_title = function (target, bm, oldtitle) {
	gbm.changed[bm.url] = bm;
};

gbm.bm_mod_url = function (target, bm, oldurl) {
	// nearly a copy of gbm.bm_del, unfortunately
	oldgbookmark = gbm.urls[oldurl];
	oldgbookmark.remove(bm);
	if (!oldgbookmark.length) {
		gbm.delete_bookmark(oldgbookmark.id);
	} else {
		gbm.changed[oldurl] = gbm.changed[oldurl] || oldgbookmark[0]; // choose one at random
	}

	gbm.bm_add(target, bm);
};

// title changed
gbm.f_mod_title = function (target, folder, oldtitle) {
	gbm.upload_all(folder);
};

// do an upload (for when an bookmark has been created/updated/label deleted)
// this needs a bookmark object because it uploads the latest title of the bookmark
gbm.upload_bookmark = function (bookmark) {
	var labels = gbm.bookmark_get_labels(bookmark.url);
	gbm.add_to_queue({bkmk: bookmark.url, title: bookmark.title, labels: labels},
			function (request) {
				gbm.urls[bookmark.url].id = request.responseText;
			});
};

// this doesn't need a dictionary of changes, because they will be removed anyway
gbm.delete_bookmark = function (id) {
	gbm.add_to_queue({dlq: id});
};

gbm.upload_all = function (folder) {
	for (url in folder.bm) {
		gbm.changed[url] = folder.bm[url];
	}
	for (title in folder.f) {
		gbm.upload_all(folder.f[title]);
	}
};

gbm.commit = function () {
	for (url in gbm.changed) {
		// gbm.changed contains the real urls, as in g_bookmarks
		gbm.upload_bookmark(gbm.changed[url]);
	}
	gbm.changed = {};
};

gbm.add_to_queue = function (params, callback) {
	params.zx   = new Date().getTime();
	if (!gbm.sig) {
		alert('No signature for Google Bookmarks (bug)!');
	}
	params.sig  = gbm.sig;
	params.prev = '';
	gbm.r_queue_add(gbm.api_url, params, callback);
}

gbm.bookmark_get_labels = function (url) {
	if (!gbm.urls[url] || gbm.urls[url].length == 0) {
		// no labels
		return false;
	}
	var folder;
	var labels = '';
	var label;
	var gbookmark;
	for (var i=0; gbookmark=gbm.urls[url][i]; i++) {
		var folder = gbookmark.parentNode;
		if (folder == g_bookmarks) {
			label = gbm.rootNodeLabel;
		} else {
			label = gbm.folder_get_label(folder);
		}
		labels = labels+((labels=='')?'':',')+label;
	}
	if (labels == gbm.rootNodeLabel) {
		labels = '';
	}
	return labels;
};

gbm.folder_get_label = function (folder) {
	if (!folder.parentNode) return gbm.rootNodeLabel;
	var label = '';
	while (true) {
		label = folder.title+(label.length?gbm.folderSep:'')+label;
		folder = folder.parentNode;
		if (!folder || !folder.parentNode) break; // first check introduced for bug when a bookmark is added to the Bookmarks Bar.
	}
	return label;
}


