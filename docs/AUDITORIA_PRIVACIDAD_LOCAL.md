# Auditoría de privacidad y funcionamiento local

## Alcance

Revisión técnica de la V0.1.1 del Gestor Local de Turnos de Enfermería. El objetivo es confirmar que la aplicación mantiene la filosofía local: HTML estático, cálculos en navegador, persistencia en IndexedDB y exportación/importación manual de copias JSON.

## Comprobaciones realizadas

| Comprobación | Patrón o evidencia revisada | Resultado |
| --- | --- | --- |
| Llamadas de red programáticas | `fetch(` | No encontrado |
| Llamadas XHR | `XMLHttpRequest` | No encontrado |
| Envío por beacon | `sendBeacon`, `navigator.sendBeacon` | No encontrado |
| URLs remotas | `http://`, `https://` en `src`, `dist` e `index.html` | No encontrado |
| Scripts externos | `<script ... src=...>` remoto | No encontrado |
| Hojas externas | `<link ... href="http...">` | No encontrado |
| Imágenes externas | `<img ... src="http...">` | No encontrado |
| Iframes | `<iframe` | No encontrado |
| Google Analytics / Tag Manager | `google-analytics`, `googletagmanager` | No encontrado |
| Google Fonts | `fonts.googleapis`, `fonts.gstatic` | No encontrado |
| CDN | `cdn.` | No encontrado |
| Persistencia local | `indexedDB.open` en `src/js/storage/indexedDb.js` | Confirmado |
| Carga de estado local | `loadState()` desde IndexedDB | Confirmado |
| Guardado de estado local | `saveState()` hacia IndexedDB | Confirmado |
| Reset local | `clearState()` sobre IndexedDB | Confirmado |
| Exportación manual | `Blob`, `URL.createObjectURL`, enlace de descarga | Confirmado |
| Importación manual | `input type="file"` y `file.text()` | Confirmado |
| Impresión local | Plantillas HTML locales y `window.print()` | Confirmado |
| HTML autosuficiente | `index.html` y `dist/gestor-turnos-enfermeria.html` generados por el mismo build | Confirmado |

## Resultado de privacidad

- La aplicación no contiene código para subir datos a servidores.
- No existen llamadas HTTP/HTTPS desde el código de la aplicación.
- No se cargan scripts, estilos, fuentes, iframes, imágenes ni librerías desde Internet.
- Los logos institucionales se integran como recursos locales y el build los incrusta en el HTML distribuible como `data:image/jpeg;base64`.
- GitHub Pages solo sirve archivos estáticos del repositorio; no recibe datos de turnos, profesionales, ciclos ni copias JSON desde esta aplicación.
- Los cálculos de turnos, horas, noches y jornada se ejecutan en JavaScript dentro del navegador.
- La persistencia usa IndexedDB en el navegador/equipo del usuario.
- La exportación JSON se inicia manualmente por el usuario y genera una descarga local.
- La importación JSON se inicia manualmente seleccionando un archivo local.
- La impresión de cuadrantes y resúmenes se genera como HTML local dentro del navegador y usa el diálogo nativo mediante `window.print()`.
- Las vistas imprimibles reutilizan los datos ya cargados en memoria/IndexedDB y no invocan servicios de PDF ni APIs externas.

## UX y confirmaciones

- La edición de vacaciones y libre disposición ya no usa `prompt()` nativo; utiliza un modal interno con saldos y confirmación de exceso.
- Los avisos ordinarios de recálculo, importación y errores visibles se muestran como avisos integrados en la aplicación.
- Se mantienen `confirm()` nativos en borrados, cambios estructurales con incidencias, importación completa y restablecimiento de datos por ser acciones destructivas o de sustitución total.

## Limitaciones y advertencias

- Al estar publicada en GitHub Pages, el navegador descarga el HTML estático desde GitHub para abrir la aplicación. Una vez cargada, la aplicación no envía los datos introducidos.
- IndexedDB depende de las políticas del navegador. Si el navegador bloquea IndexedDB en algún contexto, la aplicación muestra un aviso y puede funcionar temporalmente en memoria durante esa sesión.
- La privacidad efectiva también depende de que el usuario no comparta manualmente los JSON exportados.
- La versión sigue en pruebas y no debe considerarse aún una herramienta validada para uso asistencial definitivo.

## Comandos de verificación

```text
npm run verify
npm test
npm run validate:tabla
npm run build
npm run test:browser
```
