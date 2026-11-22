# Inventario Ford — guía para Claude

App web para un concesionario Ford (Chile): **inventario de vehículos + planificador de entregas + avisos push**. Pensada para venderse al dueño del concesionario. Quien la mantiene (Nacho) trabaja en español informal y quiere respuestas **concisas y ordenadas**.

- App: https://nachioc.github.io/FordInventory/ (GitHub Pages)
- Manuales: `manual/` · Landing: `landing/`

## Arquitectura

- **Un solo archivo**: `index.html` (HTML + CSS + JS, sin build). JS estilo ES5 (`var`, `function`), indentado con tabs, comentarios en español, formateado con Prettier. Evitar frameworks y dependencias nuevas.
- **Supabase**: Auth (login por RUT → email sintético `<rut>@rut.inventario.app`), Postgres con **RLS**, Realtime, Edge Functions.
- **PWA**: `manifest.json`, `sw.js` (solo push + clic en aviso; no cachea), íconos `icon-*.png`.
- **Push**: `push_suscripciones` + trigger/Database Webhook `push_notificaciones` (INSERT en `notificaciones`) → Edge Function (`enviar-push.ts`, desplegada como `clever-processor`; Verify JWT apagado; `PUSH_SECRET` opcional con header `x-push-secret`). Título del aviso según el prefijo del mensaje.
- Librerías por CDN (jsdelivr): `@supabase/supabase-js@2.55.0`, `zxing-wasm@3.1.6` (VIN 2D), `tesseract.js@5.1.1` (OCR), `xlsx@0.18.5` (Excel, carga perezosa). Manuales: Bootstrap 5.3.3.

## Roles y permisos

`admin`, `jefe` (= admin vía `es_admin()`; no crea administradores), `preparador`, `vendedor`, `consulta`.

| Rol | Inventario | Entregas | Avisos |
|---|---|---|---|
| admin/jefe | todas las sucursales, escribe | todo, elimina | todos + resumen |
| preparador | su sucursal, ingresa/edita/traslada | estado, grabado, comenta; "Mis tareas" | su asignación, traslados, resumen |
| vendedor | todas, solo lectura | crea y edita las suyas | "lista para entregar", resumen |
| consulta | su sucursal, lectura | lectura | ninguno |

Funciones SQL de apoyo: `mi_rol()`, `mi_sucursal()`, `es_admin()`. **Los permisos viven en RLS**, la UI solo oculta botones: nunca confiar en la UI.

## Mapa del código (`index.html`)

Secciones comentadas con bloques `// ====`: sesión, utilidades (`esc`, `fmt`, `hoy`, `dias`, `go`, `vista`), `render()` → `renderApp()` (enrutador por hash), inventario (`inventario`, `invFiltrado`, `lista`, `tablaInv`), VIN, planificador (`planVista`, `listaPlan`, `cardE`, `accE`, `tablaPlan`), formulario (`pform`), alertas/push, sucursales/cuentas/catálogos, pickers de fecha y hora (`PK`), menú lateral/inferior (`pintaNav`), y al final el bloque **MEJORAS** (ajustes, antigüedad, traslados, panel, Mis tareas, calendario, exportar, resumen diario).

Convenciones:
- Acciones por delegación: `ACC.nombre = function (btn) {...}` y `data-a="nombre"` en el HTML.
- Vistas: `VM` (localStorage `vm2`). **Por defecto todo abre en lista**; se puede pasar a tarjetas con `vmBar(k)`. El planificador es solo calendario (`calHtml`). Botones «Agregar»: clase `.btn.add` + `btnMas(texto)` (mismo diseño que «Nueva entrega»). Panel: `PANVIS` barras/torta (`torta()`), PDF con `window.print()` + CSS `@media print`. Configurar inventario: búsqueda y orden de modelos (`CATQ`, `CATO`).
- Modales: `.modal > .mp`, se cierran con `cierraModal()`.
- Tokens de color en `:root` (azul Ford en claro; azul vivo en oscuro). No hardcodear colores: usar `var(--pr)`, `--ok`, `--warn`, `--bad`, `--badbg`, etc.
- Los datos del usuario siempre pasan por `esc()` antes de ir a `innerHTML`.
- Datos globales: `data` (vehículos), `ent` (entregas), `notifs`, `SUC`, `CAT`, `AJ` (ajustes), `perfil`, `sesion`.

## Rutas (hash)

`#` Inicio · `#inv` Inventario · `#ingresar` · `#traslado` (`#salida` redirige aquí) · `#editar` · `#plan` · `#pform` · `#alertas` · `#panel` (admin/jefe) · `#tareas` (preparador) · `#sucursales` · `#sucursal/none` (Cuentas) · `#sucursal/<id>` · `#cfginv` · `#cfgplan` · `#historial`. Un hash sin permiso redirige a Inicio.

## Base de datos

Tablas: `perfiles`, `sucursales`, `vehiculos`, `entregas`, `notificaciones`, `historial`, `modelos`, `estados_inventario`, `estados_entrega`, `codigos_vin`, `push_suscripciones`, `ajustes`.

- `ajustes(clave, valor jsonb)`: `antiguedad {amarillo, rojo}` y `resumen_diario {activo, hora, dias[1-7], roles{preparador,vendedor,jefe}}`; `resumen_ultimo` lo usa el servidor. Lectura para cualquier rol, escritura solo `es_admin()`.
- RPC: `trasladar_vehiculo(p_id, p_destino, p_ubicacion, p_nota)`, `resumen_diario(p_forzar)`, `sucursales_publicas()`, `pedir_acceso`, `restablecer_clave`, `renombrar_catalogo`, `preparadores_sucursal`, `email_de_rut`.
- Historial total (`mejoras_parte4.sql`): trigger genérico `auditar()` en vehiculos, entregas, perfiles, sucursales, modelos, estados_*, codigos_vin y ajustes (guarda `entidad`, `registro`, `cambios` {campo:{antes,despues}}); `registrar_evento(entidad, accion, registro, detalle)` para sesión, exportación y avisos desde la app (`evento()`). Los cambios masivos con `app.silencio` no se repiten por fila.
- Triggers: (el historial de vehículos ahora lo hace `auditar()`), `notificar_entrega()` (avisa solo al preparador asignado; "Sin asignar" → todos los de la sucursal), `entrega_salida` (mejoras_parte7): al pasar una entrega a «Entregado» el auto con ese VIN recibe `fecha_salida`; si se devuelve, se deshace. Un auto sin vender nunca sale: se traslada.
- `resumen_diario()` corre con **pg_cron** cada 15 min (hora `America/Santiago`) y inserta en `notificaciones`; el webhook existente lo manda como push.

### Orden de ejecución de los SQL (SQL Editor de Supabase)

1. `supabase_setup.sql` 2. `planificador_parte1–4` 3. `roles_parte1–4` 4. `jefe_parte1–3` 5. `sucursales_parte1–7` 6. `fase2_parte1–6` 7. `fase3_parte1` 8. `rut_admin` 9. `jefe_total_parte1–4` 10. `vendedor_sync` 11. `codigos_vin_parte1–2` 12. `push_parte1` 13. `vendedor_aviso` 14. `orden_bd` 15. `indices` 16. `mejoras_parte1–3` (activar antes la extensión **pg_cron**) 17. `mejoras_parte4` (historial total) 18. `mejoras_parte5` (preparador/vendedor por id, estados válidos, índices) 19. `mejoras_parte6` (RPC `eliminar_usuario`) 20. `mejoras_parte7` (salida automática al entregar).

Los archivos se pueden correr más de una vez. Si el editor muestra "RUN QUERY", es solo la confirmación de Supabase.

## Despliegue

1. Subir al repositorio: `index.html`, `sw.js`, `manifest.json`, íconos, `manual/`, `landing/`, `CLAUDE.md`.
2. Ejecutar los SQL pendientes.
3. Pegar `enviar-push.ts` en el `index.ts` de la Edge Function `clever-processor` y desplegar.
4. Si cambia `sw.js`, el navegador lo actualiza solo; en pruebas, recargar con Ctrl+Shift+R.

## Cómo probar (sin Supabase real)

Se usa un stub de `supabase-js` (intercepta `supabase*.js` en Playwright) con datos en memoria y roles `u-admin`, `u-jefe`, `u-prep`, `u-vend`, `u-pend`. Para la base se usa un Postgres local con `auth.uid()` simulado (`set_config('request.jwt.claim.sub', ...)`). Revisar siempre: `node --check` del script, consola sin errores, claro y oscuro, 390 px y 1280 px, y cada rol.

## Reglas al modificar

- Mantener todo en `index.html`; comentarios en español; tabs.
- Probar cada cambio con los 5 roles; ningún rol debe ver botones que RLS le niega.
- Textos de la interfaz en español de Chile, cortos y claros (tuteo).
- Toda tabla nueva: RLS activado + políticas + `grant` explícito.
- Al agregar avisos nuevos: usar un prefijo único en `notificaciones.mensaje` y añadirlo al mapa de títulos de `enviar-push.ts`.
- Datos sensibles: no guardar RUT completos en logs ni en `localStorage`.

## Pendiente / ideas

- Íconos de la app aún son imágenes azules de Ford (cambiar a gusto del dueño).
- `PUSH_SECRET` opcional para blindar la Edge Function.
- Revisar que el vendedor vea el stock de todas las sucursales en producción (política `ver vehiculos`).
