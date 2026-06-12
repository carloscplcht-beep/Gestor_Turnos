# Validacion de vacaciones y libre disposicion

## Objetivo

Comprobar que el cuadrante permite marcar incidencias `V` y `LD` sin perder el turno base generado por el ciclo, y que las horas efectivas, saldos, sumatorio diario y copias JSON se mantienen correctos.

## Procedimiento manual

1. Crear un profesional activo para el ano de trabajo.
2. Asignarle un ciclo con turnos de 7, 10 y 12 horas, por ejemplo `M, N, D12, L`.
3. Abrir el modulo `Cuadrante`.
4. Comprobar las horas iniciales en `Jornada`.
5. Pulsar una celda con turno `M`.
6. Seleccionar `V`.
7. Verificar que la celda muestra `V`, el tooltip conserva el turno previsto y vacaciones descuenta 7 horas.
8. Pulsar una celda con turno `D12`.
9. Seleccionar `V`.
10. Verificar que vacaciones descuenta 12 horas.
11. Pulsar una celda con turno `N`.
12. Seleccionar `LD`.
13. Verificar que libre disposicion descuenta 10 horas.
14. Revisar en `Jornada`:
    - horas base previstas;
    - horas de vacaciones;
    - horas de libre disposicion;
    - horas efectivas;
    - derecho, utilizadas, pendientes y exceso.
15. Pulsar una celda con incidencia y escribir el codigo del turno base para eliminarla.
16. Confirmar que se restaura el turno original y sus horas.
17. Recargar el navegador y confirmar que las incidencias siguen visibles.
18. Exportar una copia JSON.
19. Importar esa copia en un perfil limpio.
20. Confirmar que se conservan cuadrante, incidencias, horas, saldos y sumatorios diarios.

## Validaciones esperadas

- `V` y `LD` no cuentan como presencia asistencial.
- `V` y `LD` aparecen como filas propias en el resumen diario cuando se muestran libres y ausencias.
- El turno base no se pierde y queda disponible en el tooltip.
- Las deducciones usan las horas computables del turno base: 7, 10 o 12 segun corresponda.
- La jornada objetivo normativa no se reduce por vacaciones ni LD.
- Si se supera la bolsa anual, la app muestra advertencia y pide confirmacion.
- Al cambiar ciclo, posicion o fecha de inicio de ciclo con incidencias existentes, la app advierte que pueden cambiar las horas descontadas.

## Comandos

`npm test`

`npm run verify`
