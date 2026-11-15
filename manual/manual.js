// Comportamiento de los manuales: modo oscuro, búsqueda, enlaces a secciones y volver arriba
(function () {
	var raiz = document.documentElement;
	function leer() {
		try {
			return localStorage.getItem("manual-tema");
		} catch (e) {
			return null;
		}
	}
	function guardar(t) {
		try {
			localStorage.setItem("manual-tema", t);
		} catch (e) {}
	}
	var t = leer() || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	raiz.setAttribute("data-bs-theme", t);
	var b = document.getElementById("tema");
	if (b)
		b.addEventListener("click", function () {
			t = raiz.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
			raiz.setAttribute("data-bs-theme", t);
			guardar(t);
		});

	// Enlace directo a cada sección (el # aparece al pasar el mouse)
	document.querySelectorAll(".msec > h2").forEach(function (h) {
		var a = document.createElement("a");
		a.className = "anc";
		a.href = "#" + h.parentNode.id;
		a.setAttribute("aria-label", "Enlace a esta sección");
		a.textContent = "#";
		h.appendChild(a);
	});

	// Buscador: marca las secciones que contienen el texto y oculta el resto
	var q = document.getElementById("buscar");
	if (q)
		q.addEventListener("input", function () {
			var v = q.value.trim().toLowerCase();
			document.querySelectorAll(".msec").forEach(function (s) {
				var ok = !v || s.textContent.toLowerCase().indexOf(v) > -1;
				s.hidden = !ok;
				var link = document.querySelector('#toc a[href="#' + s.id + '"]');
				if (link) link.hidden = !ok;
			});
		});

	// Botón volver arriba
	var up = document.getElementById("arriba");
	if (up) {
		addEventListener(
			"scroll",
			function () {
				up.hidden = scrollY < 500;
			},
			{ passive: true },
		);
		up.addEventListener("click", function () {
			scrollTo({ top: 0, behavior: "smooth" });
		});
	}
})();
