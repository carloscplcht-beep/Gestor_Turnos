# Arquitectura tecnica

## Restricciones obligatorias

- Funcionamiento 100% local.
- Sin conexion a Internet.
- Sin instalacion de Node.js, Python, servidor, base de datos ni ejecutables para el usuario final.
- Apertura mediante archivo HTML local.
- Datos solo en el equipo del usuario.
- Persistencia en IndexedDB.
- Importacion/exportacion JSON y Excel.
- Sin CDN, fuentes remotas, APIs externas ni telemetria.
- Desarrollo modular, con empaquetado final en HTML unico.

## Estilo arquitectonico

Aplicacion HTML/JavaScript local con separacion en capas:

```text
src/
  app/              coordinacion, rutas, estado de pantalla
  ui/               componentes y vistas
  domain/           entidades, reglas y casos de uso
  calculation/      motores de ciclos, jornada, cobertura
  persistence/      IndexedDB, migraciones, repositorios
  import-export/    JSON, Excel, validadores de importacion
  reporting/        informes imprimibles y exportables
  audit/            trazabilidad local
  styles/           CSS local
  assets/           logos y recursos locales
```

Distribucion final:

```text
dist/turnos-enfermeria.html
```

El HTML distribuible incluira CSS, JS y librerias locales empaquetadas.

## Capas

### Interfaz

Responsabilidades:

- Navegacion.
- Grillas de cuadrante.
- Formularios.
- Validaciones inmediatas.
- Estados visuales de origen de dato.
- Impresion.

No debe contener formulas de jornada ni logica normativa.

### Dominio

Responsabilidades:

- Entidades.
- Invariantes.
- Casos de uso.
- Validaciones funcionales.

Ejemplos:

- Crear ciclo.
- Asignar ciclo.
- Generar planificacion.
- Registrar incidencia.
- Comparar escenarios.

### Calculo

Motores puros y testeables:

- `cycleEngine`.
- `calendarEngine`.
- `shiftEngine`.
- `incidentEngine`.
- `worktimeEngine`.
- `coverageEngine`.
- `scenarioDiffEngine`.

Los motores reciben datos y devuelven resultados sin acceder a IndexedDB ni DOM.

### Persistencia

IndexedDB con repositorios:

- `unidadRepository`.
- `profesionalRepository`.
- `escenarioRepository`.
- `turnoRepository`.
- `cicloRepository`.
- `planificacionRepository`.
- `incidenciaRepository`.
- `jornadaRepository`.
- `auditoriaRepository`.

Se recomienda usar una pequena capa propia sobre IndexedDB o una libreria local empaquetada. Si se usa libreria, debe quedar incrustada en el HTML final y con licencia compatible.

## IndexedDB

Base de datos:

```text
turnos_enfermeria_db
```

Object stores iniciales:

- `metadata`.
- `unidades`.
- `profesionales`.
- `contratos`.
- `tiposTurno`.
- `ciclos`.
- `posicionesCiclo`.
- `asignacionesCiclo`.
- `escenarios`.
- `planificacionDiaria`.
- `tiposIncidencia`.
- `incidencias`.
- `perfilesJornada`.
- `tablasPonderacionNoches`.
- `reglasCobertura`.
- `festivos`.
- `auditoria`.

Indices:

- `planificacionDiaria`: `escenarioId+fecha`, `escenarioId+profesionalId+fecha`.
- `incidencias`: `escenarioId+profesionalId`, `fechaInicio`, `fechaFin`.
- `contratos`: `profesionalId`, `unidadId`, `fechaInicio`.
- `reglasCobertura`: `unidadId+escenarioId`.

## Migraciones

Cada version de esquema tendra migracion explicita:

```js
const migrations = {
  1(db) {},
  2(db, tx) {}
};
```

Reglas:

- No borrar stores sin copia previa.
- Crear backup automatico antes de migracion mayor.
- Guardar version de aplicacion y esquema en `metadata`.
- Permitir exportar JSON completo antes de actualizar.

## Funcionamiento offline

- Todo recurso vive dentro del HTML o como archivo local opcional seleccionado por el usuario.
- No hay llamadas `fetch` a Internet.
- No hay fuentes remotas.
- Los logos se incrustan como `data:` o se empaquetan localmente.
- La aplicacion puede trabajar con `file://`.

## Excel

Importacion:

- Primera version puede importar plantillas propias `.xlsx` generadas por la aplicacion.
- Importar directamente `.xls` heredados no debe ser requisito de uso final salvo fase especifica, porque los `.xls` binarios requieren parsers pesados y reglas de migracion cuidadosas.
- Para migracion inicial se puede usar herramienta de desarrollo con Excel/LibreOffice/Python, no para usuario final.

Exportacion:

- Exportar informes a `.xlsx` mediante libreria JavaScript local empaquetada.
- Exportar datos completos a JSON como formato canonico.
- Exportar CSV solo como formato auxiliar si se solicita.

## HTML distribuible

Durante desarrollo:

```text
src/*.js
src/*.css
tests/*.js
```

Distribucion:

- Build que concatena/minifica recursos.
- Incrusta CSS/JS.
- Incrusta logos.
- Incluye version y hash.
- No requiere servidor.

El proceso de build puede usar Node/Python como herramienta de desarrollo, pero el usuario final solo recibe HTML.

## Impresion

- CSS `@media print`.
- Informes imprimibles por unidad, profesional, mes y escenario.
- Cabeceras con hospital, unidad, ano, escenario, fecha de generacion.
- No depender de macros ni plantillas Office.

## Seguridad y privacidad

- Datos en IndexedDB del navegador local.
- Sin envio externo.
- Sin telemetria.
- Sin datos personales innecesarios.
- Exportaciones JSON/Excel deben advertir que contienen datos laborales.
- Posibilidad de borrar datos locales desde la aplicacion.

## Copias de seguridad

Formato JSON:

```json
{
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAt": "2026-06-11T18:00:00+02:00",
  "unidades": [],
  "escenarios": [],
  "datos": {}
}
```

Reglas:

- Exportacion completa.
- Exportacion por unidad/ano/escenario.
- Importacion con previsualizacion.
- Validacion antes de sobrescribir.
- Opcion de importar como escenario nuevo.

## Librerias locales candidatas

Pendientes de decision tecnica tras prototipo:

- IndexedDB: wrapper ligero propio o libreria local tipo Dexie empaquetada.
- Excel `.xlsx`: libreria local empaquetada compatible con navegador/file.
- Fechas: funciones propias con `Date`/UTC o libreria local muy pequena; evitar dependencia pesada si no aporta.

Ninguna libreria debe cargarse desde CDN.

## Estrategia de pruebas tecnicas

- Tests unitarios de motores puros.
- Tests de integracion con IndexedDB usando base temporal.
- Tests de import/export JSON.
- Tests de exportacion Excel.
- Tests de UI con navegador local durante desarrollo.
- Fixtures basados en reglas confirmadas de los Excel.

## Riesgos tecnicos

- `file://` tiene diferencias entre navegadores; validar Chrome/Edge corporativo.
- IndexedDB puede ser borrado por politicas del navegador; por eso JSON backup es obligatorio.
- Exportar Excel desde navegador local exige libreria robusta y empaquetada.
- HTML unico puede crecer; conviene mantener build reproducible.
- Migrar `.xls` heredados directamente dentro del navegador puede ser costoso; mejor separar migracion inicial.
