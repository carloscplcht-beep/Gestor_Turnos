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

Caso obligatorio de continuidad entre anos:

Secuencia: `D12, D12, N12, L, L, L, L, L`

Fecha consultada: `2026-01-01`

| Profesional | Inicio ciclo | Dias transcurridos | Indice | Turno esperado |
| --- | --- | ---: | ---: | --- |
| P1 | 2025-12-01 | 31 | 7 | L |
| P2 | 2025-12-02 | 30 | 6 | L |
| P3 | 2025-12-03 | 29 | 5 | L |
| P4 | 2025-12-04 | 28 | 4 | L |
| P5 | 2025-12-05 | 27 | 3 | L |
| P6 | 2025-12-06 | 26 | 2 | N12 |
| P7 | 2025-12-07 | 25 | 1 | D12 |
| P8 | 2025-12-08 | 24 | 0 | D12 |

Aunque algunos profesionales coincidan el 1 de enero, sus filas no pueden repetir exactamente la misma secuencia mensual.

Las fechas internas deben conservarse en ISO `YYYY-MM-DD`. Si existieran valores antiguos en formato `dd/mm/aaaa`, la migracion los convierte de forma explicita a ISO antes de calcular.

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
