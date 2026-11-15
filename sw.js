// Service worker de Inventario Ford: instalación como app y avisos push.
self.addEventListener("install", function () {
	self.skipWaiting();
});
self.addEventListener("activate", function (e) {
	e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", function () {});

// Llega un aviso desde el servidor (aunque la app esté cerrada)
self.addEventListener("push", function (e) {
	var d = {};
	try {
		d = e.data ? e.data.json() : {};
	} catch (x) {
		d = { cuerpo: e.data ? e.data.text() : "" };
	}
	e.waitUntil(
		self.registration.showNotification(d.titulo || "Inventario Ford", {
			body: d.cuerpo || "",
			icon: "icon-192.png",
			badge: "icon-192.png",
			tag: d.tag || "aviso",
			renotify: true,
			data: { url: d.url || "./#alertas" },
		}),
	);
});

// Al tocar el aviso: abre la app en Alertas (o la trae al frente si ya está abierta)
self.addEventListener("notificationclick", function (e) {
	e.notification.close();
	var url = (e.notification.data && e.notification.data.url) || "./#alertas";
	e.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
			for (var i = 0; i < cs.length; i++) {
				if ("focus" in cs[i]) {
					cs[i].navigate(url).catch(function () {});
					return cs[i].focus();
				}
			}
			return self.clients.openWindow(url);
		}),
	);
});
