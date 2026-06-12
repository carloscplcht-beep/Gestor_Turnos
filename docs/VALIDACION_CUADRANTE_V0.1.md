# Validacion del cuadrante V0.1

## Casos corregidos

### 1. Escalonamiento de ciclos por profesional

Crear un ciclo de 7 posiciones, por ejemplo:

`L, D12, D12, N12, L, L, L`

Crear cuatro profesionales con el mismo ciclo y la misma posicion inicial `0`, pero con fechas de inicio de ciclo distintas:

- Profesional 1: `2026-01-01`
- Profesional 2: `2026-01-02`
- Profesional 3: `2026-01-03`
- Profesional 4: `2026-01-04`

En consola puede comprobarse el diagnostico con:

`gestorTurnosDiagnostico("<profesionalId>", "2026-01-01")`

La salida debe incluir `fechaInicioCiclo`, `posicionInicial`, `diasTranscurridos`, `indiceCalculado` y `turnoResultante`. Los indices esperados para el 1 de enero son `0`, `6`, `5` y `4`.

Repetir con misma fecha de inicio de ciclo y posiciones iniciales diferentes. En ese caso deben cambiar los indices por posicion, sin modificar automaticamente la fecha de inicio.

### 2. Orden visual persistente

Crear profesionales con orden visual no alfabetico, por ejemplo:

- Beatriz: 1
- Diana: 2
- Ana: 3
- Carlos: 4

Confirmar que las tablas de profesionales, jornada y cuadrante respetan ese orden. Usar los botones `Subir` y `Bajar`, recargar la pagina y verificar que el orden se conserva en IndexedDB y en una copia JSON exportada/importada.

### 3. Resumen diario del cuadrante

Abrir `Cuadrante` y comprobar que bajo la tabla mensual aparece el bloque `Resumen diario de turnos`, con una fila por codigo relevante y conteos por dia.

Validaciones:

- `Total de profesionales programados` solo cuenta turnos con `cuentaComoPresencia=true`.
- `Total de profesionales activos` cuenta profesionales activos dentro de contrato, aunque ese dia esten libres.
- El turno `L` no cuenta como presencia.
- Un turno inactivo sigue apareciendo en el resumen si esta usado historicamente en un ciclo.
- La casilla `Mostrar libres y ausencias en el resumen` muestra u oculta turnos que no cuentan como presencia.

## Validaciones automaticas

Ejecutar:

`npm run validate:tabla`

`npm test`

`npm run build`

`npm run verify`

Confirmar que `index.html` y `dist/gestor-turnos-enfermeria.html` se generan desde la misma construccion y que no contienen referencias remotas, CDN, rutas `C:/` ni rutas absolutas que empiecen por `/`.
