# Auditoria de privacidad y funcionamiento local

## Alcance

Revision tecnica de la V0.1 visualmente mejorada del Gestor Local de Turnos de Enfermeria. El objetivo es confirmar que la aplicacion mantiene la filosofia local: HTML estatico, calculos en navegador, persistencia en IndexedDB y exportacion/importacion manual de copias JSON.

## Comprobaciones realizadas

| Comprobacion | Patron o evidencia revisada | Resultado |
| --- | --- | --- |
| Llamadas de red programaticas | `fetch(` | No encontrado |
| Llamadas XHR | `XMLHttpRequest` | No encontrado |
| Envio por beacon | `sendBeacon`, `navigator.sendBeacon` | No encontrado |
| URLs remotas | `http://`, `https://` en `src`, `dist` e `index.html` | No encontrado |
| Scripts externos | `<script ... src=...>` remoto | No encontrado |
| Hojas externas | `<link ... href="http...">` | No encontrado |
| Imagenes externas | `<img ... src="http...">` | No encontrado |
| Iframes | `<iframe` | No encontrado |
| Google Analytics / Tag Manager | `google-analytics`, `googletagmanager` | No encontrado |
| Google Fonts | `fonts.googleapis`, `fonts.gstatic` | No encontrado |
| CDN | `cdn.` | No encontrado |
| Persistencia local | `indexedDB.open` en `src/js/storage/indexedDb.js` | Confirmado |
| Carga de estado local | `loadState()` desde IndexedDB | Confirmado |
| Guardado de estado local | `saveState()` hacia IndexedDB | Confirmado |
| Reset local | `clearState()` sobre IndexedDB | Confirmado |
| Exportacion manual | `Blob`, `URL.createObjectURL`, enlace de descarga | Confirmado |
| Importacion manual | `input type="file"` y `file.text()` | Confirmado |
| Impresion local | Plantillas HTML locales y `window.print()` | Confirmado |
| HTML autosuficiente | `index.html` y `dist/gestor-turnos-enfermeria.html` generados por el mismo build | Confirmado |

## Resultado de privacidad

- La aplicacion no contiene codigo para subir datos a servidores.
- No existen llamadas HTTP/HTTPS desde el codigo de la aplicacion.
- No se cargan scripts, estilos, fuentes, iframes, imagenes ni librerias desde Internet.
- Los logos institucionales se integran como recursos locales y el build los incrusta en el HTML distribuible como `data:image/jpeg;base64`.
- GitHub Pages solo sirve archivos estaticos del repositorio; no recibe datos de turnos, profesionales, ciclos ni copias JSON desde esta aplicacion.
- Los calculos de turnos, horas, noches y jornada se ejecutan en JavaScript dentro del navegador.
- La persistencia usa IndexedDB en el navegador/equipo del usuario.
- La exportacion JSON se inicia manualmente por el usuario y genera una descarga local.
- La importacion JSON se inicia manualmente seleccionando un archivo local.
- La impresion de cuadrantes y resumenes se genera como HTML local dentro del navegador y usa el dialogo nativo mediante `window.print()`.
- Las vistas imprimibles reutilizan los datos ya cargados en memoria/IndexedDB y no invocan servicios de PDF ni APIs externas.

## Limitaciones y advertencias

- Al estar publicada en GitHub Pages, el navegador descarga el HTML estatico desde GitHub para abrir la aplicacion. Una vez cargada, la aplicacion no envia los datos introducidos.
- IndexedDB depende de las politicas del navegador. Si el navegador bloquea IndexedDB en algun contexto, la aplicacion muestra un aviso y puede funcionar temporalmente en memoria durante esa sesion.
- La privacidad efectiva tambien depende de que el usuario no comparta manualmente los JSON exportados.
- La version sigue en pruebas y no debe considerarse aun una herramienta validada para uso asistencial definitivo.

## Comandos de verificacion ejecutados

```text
node tools/validar-tabla-ponderacion.mjs
node tests/domain.test.mjs
node tools/build-dist.mjs
```

Busqueda precisa de patrones:

```text
fetch\s*\(
XMLHttpRequest
sendBeacon
navigator\.sendBeacon
https?://
<script\s+[^>]*src=
<link\s+[^>]*href=\"https?://
<img\s+[^>]*src=\"https?://
<iframe\b
google-analytics
googletagmanager
fonts\.googleapis
fonts\.gstatic
cdn\.
```

La unica etiqueta `<script src>` encontrada pertenece a `src/index.html` y apunta a `./js/app.js`, una ruta local de desarrollo. Los HTML distribuibles no dependen de scripts externos.
