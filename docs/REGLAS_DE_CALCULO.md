# Reglas de calculo

## Clasificacion

Cada regla se marca como:

- Confirmada: observada en los Excel o definida explicitamente en el encargo.
- Deducida: inferida de formulas, cabeceras o estructura, pendiente de validacion funcional.
- Pendiente: requiere decision del responsable funcional o fuente normativa legible.

## Ciclos

Estado: Confirmada en PTE para la mecanica de repeticion.

Formula observada:

```excel
=IF(C$260-$AL6<0,"",INDEX(Ciclos!$C$6:$CW$47,(($AK6-1)*2)+1,((C$260-$AL6)-(INT((C$260-$AL6)/$AM6))*$AM6+1)))
```

Regla propuesta:

```text
si fechaDia < fechaInicioCiclo:
  turnoPrevisto = null
si no:
  diasTranscurridos = diasEntre(fechaInicioCiclo, fechaDia)
  posicion = (diasTranscurridos mod duracionCiclo) + 1
  turnoPrevisto = ciclo.posiciones[posicion]
```

Requisitos:

- `mod` debe ser robusto para fechas anteriores al 1 de enero.
- La fecha de inicio del ciclo puede ser anterior al ano planificado.
- La duracion del ciclo debe ser mayor que 0.
- Si el ciclo o turno esta inactivo, se conserva historico y se avisa.

## Posicion diaria

Estado: Confirmada en PTE.

La posicion diaria se obtiene con aritmetica modular. En JavaScript debe evitarse el comportamiento de `%` con negativos:

```js
function mod(n, m) {
  return ((n % m) + m) % m;
}
```

Para ciclos iniciados antes del ano:

```text
posicion = mod(diasEntre(fechaInicioCiclo, fechaDia), duracionCiclo) + 1
```

## Horas por turno

Estado: Parcialmente confirmada.

Valores iniciales del encargo:

| Codigo | Horario | Horas |
| --- | --- | ---: |
| `M` | 08:00-15:00 | 7 |
| `T` | 15:00-22:00 | 7 |
| `N` | 22:00-08:00 | 10 |
| `D12` | 08:00-20:00 | 12 |
| `N12` | 20:00-08:00 | 12 |
| `L` | Libre | 0 |

Valores detectados en PTE:

- `M=7`.
- `T=7`.
- `MA=9,5`.
- `MB=10`.
- `m2`, `t2`, `t1`, `Tercios` aparecen como parcialidades.

Regla:

- Las horas reales y computables pertenecen a `TipoTurno`.
- El motor no debe deducir horas desde el codigo textual.
- El usuario podra versionar o desactivar turnos.

## Turnos nocturnos

Estado: Definido como requisito; efectos concretos pendientes.

Reglas propuestas:

- Un turno con `cruzaMedianoche=true` pertenece al dia de inicio a efectos de cuadrante.
- Sus horas reales pueden ocupar dos fechas naturales.
- Para cobertura, el grupo `noche` se computa en el dia de inicio salvo que la unidad configure otro criterio.
- Para conteo de noches, se cuenta una noche efectiva por turno nocturno trabajado/computable.

Pendiente:

- Confirmar si ausencias en noche computan por dia de inicio, dia de salida o ambos.
- Confirmar tratamiento de noches festivas.

## Jornada mensual

Estado: Confirmada parcialmente en PTE/GTE.

PTE calcula horas mensuales multiplicando conteos por horas de codigo:

```excel
=(AY6*AN6)+(AZ6*AO6)+...+(BJ6*AW6)
```

GTE incorpora incidencias y computo horario.

Regla propuesta:

```text
horasProgramadasMes = suma(turnoPrevisto.horasComputables)
horasTrabajadasMes = suma(resultadoDia.horasTrabajadas)
horasComputablesMes = suma(resultadoDia.horasComputablesJornada)
```

Debe mantenerse desglose por origen:

- Ciclo.
- Modificacion manual.
- Incidencia.
- Ajuste normativo.

## Jornada anual

Estado: Requisito definido; tabla historica detectada no aplicable automaticamente.

Perfiles iniciales del encargo:

| Perfil | Vigencia | Jornada |
| --- | --- | ---: |
| Diurno | desde 2019 | 1.519 h |
| Nocturno | desde 2019 | 1.450 h |
| Rotatorio referencia | desde 2019 | 1.491 h para 42 noches |
| Diurno historico | 2016 | 1.603 h |
| Nocturno historico | 2016 | 1.460 h |
| Rotatorio historico | 2016 | 1.512 h referencia |

Regla:

- Las jornadas anuales viven en `PerfilNormativoJornada`.
- La tabla de ponderacion por noches vive en `TablaPonderacionNoches`.
- No se inventara formula si falta tabla validada.

## Ponderacion de noches

Estado: Pendiente.

GTE contiene `Tabla de Horas` con `NOCHES TEORICAS` y `JORNADA ANUAL A REALIZAR`, enlazada a matriz externa de 2013. Ejemplos: 0 noches -> 1645 h, 1 -> 1641 h, 2 -> 1637 h. Esta tabla no coincide con la normativa moderna aportada.

Regla propuesta:

- Para rotatorio, buscar en tabla vigente por `numeroNoches`.
- Si no existe entrada exacta, marcar pendiente de validacion; no interpolar sin autorizacion.
- La tabla sera importable y editable.

## Contratos parciales

Estado: Pendiente.

No se confirma formula de proporcionalidad. Regla provisional configurable:

```text
jornadaTeoricaPeriodo = jornadaPerfil * porcentajeJornada * factorDiasVigencia
```

Pero esta regla no debe cerrarse hasta validar:

- Si se prorratea por dias naturales, laborables o meses.
- Si vacaciones/permisos alteran el divisor.
- Como aplicar reducciones superpuestas.

## Vacaciones

Estado: Requisito definido; reglas concretas pendientes.

Principio:

- Vacaciones no equivalen necesariamente a restar horas del turno.
- Se debe conservar turno previsto.
- Se debe separar ausencia real, horas trabajadas, horas computables y efecto en cobertura.

Campos calculados por dia:

- `turnoPrevisto`.
- `incidencia=VAC`.
- `presenciaAsistencial=false`.
- `horasTrabajadas=0`.
- `horasComputablesJornada`: segun regla de incidencia.
- `requiereSustitucion`: segun regla de cobertura.

## Permisos e incidencias

Estado: Codigos parcialmente confirmados en GTE.

Codigos detectados:

- `IT`.
- `PP`.
- `PB`.
- `BM`.
- `LM`.
- `LT`.
- `EX`.
- `PSS`.
- Probables `LP`, permiso formacion y libre disposicion.

Regla:

- Cada incidencia tendra `ReglaComputoIncidencia`.
- La regla indicara si computa jornada, si cuenta como ausencia, si consume saldo, y si afecta cobertura.
- Una incidencia no debe borrar el turno previsto.

## Cobertura

Estado: Requisito definido; no confirmada como regla estructurada en Excel.

Regla propuesta:

```text
coberturaReal(dia, grupo) =
  profesionales con resultadoDia.presenciaAsistencial=true
  y resultadoDia.grupoCobertura=grupo

deficit = max(0, minimoRequerido - coberturaReal)
exceso = max(0, coberturaReal - maximoDeseado opcional)
```

Debe poder diferenciar:

- Deficit por incidencia.
- Deficit por vacante/contrato finalizado.
- Deficit por ciclo mal dimensionado.
- Deficit por modificacion manual.

## Exceso o deficit de jornada

Estado: Requisito definido.

```text
diferencia = horasComputablesPeriodo - jornadaTeoricaPeriodo
```

Se informara:

- Por mes.
- Acumulado anual.
- Por contrato/periodo.
- Por escenario.

## Redondeos

Estado: Pendiente.

Regla tecnica propuesta:

- Almacenar horas en minutos enteros para evitar errores decimales.
- Mostrar horas con 2 decimales o formato `h:mm` segun decision funcional.
- Redondear solo en presentacion, salvo regla normativa explicita.

## Reglas confirmadas, deducidas y pendientes

| Bloque | Estado | Evidencia |
| --- | --- | --- |
| Repeticion modular de ciclos | Confirmada | Formula `INDEX`/`INT` en PTE mensual. |
| No programar antes de inicio de ciclo | Confirmada | `IF(fecha-inicio<0,"",...)`. |
| Conteo por codigos | Confirmada | `COUNTIF` en PTE/GTE. |
| Horas por codigo configurables | Deducida | Cabeceras `M=7`, `T=7`, `MA=9,5`, `MB=10`. |
| Incidencias con efecto de computo | Deducida | Formulas GTE con `PP`, `PB`, `LM`, `LT`, `EX`, `PSS`. |
| Ponderacion moderna por noches | Pendiente | PDF no extraible; tabla Excel historica 2013. |
| Contratos parciales | Pendiente | No hay formula normativa acreditada. |
| Cobertura minima | Pendiente | Requisito nuevo; no aparece como entidad clara en Excel. |
