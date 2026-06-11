# Plan de pruebas

## Estrategia

Niveles:

- Unitarias: motores puros de ciclos, fechas, jornada, incidencias y cobertura.
- Integracion: IndexedDB, generacion anual, importacion/exportacion.
- Funcionales: flujos completos en navegador local.
- Validacion: comparacion con Excel heredado o casos aprobados por responsable funcional.

## Pruebas unitarias

### Ciclos

| Caso | Entrada | Esperado |
| --- | --- | --- |
| Ciclo 3 dias | `M,T,L`, inicio `2026-01-01` | 01=M, 02=T, 03=L, 04=M. |
| Ciclo 9 dias | `M,M,T,T,N,N,L,L,L`, inicio `2026-01-01` | 10/01 vuelve a `M`. |
| Inicio anterior al ano | inicio `2025-12-30`, ciclo `M,T,L`, fecha `2026-01-01` | posicion 3 = `L`. |
| Fecha anterior al inicio | inicio `2026-02-01`, fecha `2026-01-31` | sin turno previsto. |
| Duracion invalida | duracion 0 | error de validacion. |

### Fechas

| Caso | Entrada | Esperado |
| --- | --- | --- |
| Ano normal | 2026 | 365 dias. |
| Ano bisiesto | 2028 | 366 dias, incluye 29/02. |
| Cambio de mes | 31/01 -> 01/02 | diferencia 1 dia. |
| Cambio de ano | 31/12 -> 01/01 | diferencia 1 dia. |

### Turnos nocturnos

| Caso | Entrada | Esperado |
| --- | --- | --- |
| N 22:00-08:00 | cruza medianoche | `duracionMinutos=600`, dia de inicio para cuadrante. |
| N12 20:00-08:00 | cruza medianoche | `duracionMinutos=720`. |
| L libre | 00:00-00:00 o sin horario | `minutosComputables=0`. |

### Jornada

Casos con resultado numerico confirmado:

| Caso | Entrada | Esperado |
| --- | --- | --- |
| 5 mananas | 5 turnos `M` de 7 h | 35 h = 2100 min. |
| 2 tardes + 1 noche | `T,T,N` con N=10 h | 24 h = 1440 min. |
| 1 D12 + 1 L | `D12,L` | 12 h = 720 min. |

Casos pendientes de regla:

- Prorrata de contrato parcial.
- Jornada rotatoria por noches.
- Vacaciones computables.

Estos deben existir como tests marcados `pending` hasta validacion.

### Incidencias

| Caso | Entrada | Esperado |
| --- | --- | --- |
| IT sobre M | turno previsto M, incidencia IT | conserva turno previsto, presencia false, requiere sustitucion segun regla. |
| Vacaciones sobre N | turno previsto N, incidencia VAC | conserva turno previsto, computo segun regla configurable. |
| Permiso personal | `PP` | aplica regla `TipoIncidencia.PP`. |
| Excedencia | `EX` en rango | no presencia, contrato/periodo queda marcado. |

### Cobertura

| Caso | Regla | Asignacion | Esperado |
| --- | --- | --- | --- |
| Cobertura correcta | manana minimo 3 | 3 profesionales M presentes | deficit 0. |
| Deficit | manana minimo 3 | 2 presentes + 1 IT | deficit 1, causa IT. |
| Exceso | tarde minimo 2 | 3 presentes | exceso 1 si se define maximo 2. |
| Festivo | noche minimo 1 | 0 presentes | deficit 1 en tipo dia festivo. |

## Pruebas de integracion

### Generacion anual

- Crear unidad.
- Crear 3 profesionales.
- Crear ciclo.
- Asignar ciclo con fechas distintas.
- Generar ano.
- Verificar numero de `PlanificacionDiaria`.
- Verificar no hay dias fuera de contrato.

### Cambios manuales

- Generar cuadrante.
- Cambiar un `M` a `T`.
- Confirmar `turnoPrevisto=M`, `turnoManual=T`, `turnoComputado=T`.
- Regenerar futuro sin perder el cambio historico.

### Escenarios

- Crear oficial.
- Duplicar a simulacion.
- Cambiar turnos en simulacion.
- Confirmar oficial intacto.
- Comparar diferencias.

### IndexedDB

- Guardar catalogos.
- Cerrar/reabrir navegador.
- Recuperar datos.
- Migrar version de esquema con backup previo.

### JSON

- Exportar backup completo.
- Importar en base vacia.
- Comparar conteos y hashes de entidades.
- Importar como escenario nuevo sin sobrescribir.

### Excel

- Exportar informe de jornada.
- Abrir archivo en Excel.
- Verificar cabeceras, fechas, horas y totales.
- Confirmar que no requiere macros.

## Pruebas funcionales

### Flujo supervisor

1. Crear unidad.
2. Crear turnos.
3. Crear profesionales.
4. Crear ciclo.
5. Asignar ciclo.
6. Generar ano.
7. Revisar mes.
8. Registrar IT y vacaciones.
9. Consultar deficit.
10. Exportar informe.

Criterios:

- El flujo se completa sin Internet.
- No aparecen errores tecnicos.
- Cada calculo permite ver origen.

### Impresion

- Imprimir cuadrante mensual.
- Imprimir resumen profesional.
- Imprimir cobertura diaria.
- Verificar cabeceras y saltos de pagina.

### Accesibilidad

- Navegacion por teclado.
- Contraste suficiente.
- Tooltips o etiquetas en controles iconicos.
- Textos no solapados.

## Casos especificos solicitados

| Bloque | Prueba |
| --- | --- |
| Ciclos de diferente longitud | 3, 9, 28 y 42 dias. |
| Fechas anteriores al 1 de enero | Ciclo inicia en diciembre anterior. |
| Anos bisiestos | Generacion 2028. |
| Cambio mes/ano | Enero-febrero y diciembre-enero. |
| Nocturnos | `N` y `N12`. |
| 12 horas | `D12`, `N12`. |
| Alta mitad de ano | Profesional inicia 15/06. |
| Baja mitad de ano | Profesional finaliza 30/09. |
| Parciales | 50%, 66,67%, pendiente regla. |
| Vacaciones | Rango de 7 dias sobre turnos mixtos. |
| IT | IT sobre turno con cobertura minima. |
| Cambios manuales | Sustitucion de M por T. |
| Ponderacion noches | Tabla vigente; tests pendientes hasta cargar tabla validada. |
| Coberturas | Minimos por laborable/sabado/domingo/festivo. |
| Duplicacion escenarios | Oficial vs simulacion. |
| Guardado local | IndexedDB tras recarga. |
| Backup | Export/import JSON. |
| Import/export | JSON y Excel. |
| Impresion | CSS print. |

## Datos de prueba recomendados

Unidad `UCI Demo`, ano 2028:

- Turnos: M 7h, T 7h, N 10h, D12 12h, N12 12h, L 0h.
- Ciclo A: `M,M,T,T,N,N,L,L,L`.
- Ciclo B: `D12,L,N12,L`.
- 5 profesionales con fechas de alta/baja distintas.
- Festivos: 01/01, 06/01, 01/05, 25/12.
- Cobertura: laborable M=3, T=2, N=1.

## Criterios de salida

- Todas las pruebas unitarias confirmadas pasan.
- Las reglas pendientes estan marcadas y no se simulan como cerradas.
- Se ha comparado al menos un caso anonimo contra Excel o contra resultados validados.
- Backup/restore probado.
- La aplicacion funciona desde HTML local.
