# Analisis de los Excel heredados

## Alcance y metodo

Se analizaron los libros originales en modo solo lectura mediante Excel COM, con macros deshabilitadas y sin guardar cambios:

- `PTE13.xls`, 7.867.904 bytes, modificado el 12/01/2013 23:14:33.
- `GTE13.xls`, 8.217.600 bytes, modificado el 12/01/2013 23:18:52.

El PDF `jornada-2020 (1).pdf` contiene 15 paginas, pero no tiene texto extraible con `pypdf` y no hay OCR/renderizador PDF disponible en el entorno. Por tanto, su contenido queda pendiente de validacion manual/OCR. Las cifras normativas aportadas en el encargo se tratan como requisitos de configuracion, no como reglas verificadas contra el PDF.

## PTE13.xls

### Estructura

Libro de programacion de turnos y ciclos. Contiene 15 hojas visibles:

| Hoja | Uso detectado | Rango usado | Formulas/validaciones destacadas |
| --- | --- | --- | --- |
| `Inicio` | Parametros generales: ano, hospital, unidad, categoria y festivos. | `A1:S63` | Vinculos a festivos externos. |
| `Personal` | Datos de profesionales e incidencias/observaciones anuales. | `A1:CP206` | Fechas de trimestres y propagacion de datos a meses. Validaciones en filas de personal. |
| `Ciclos` | Definicion manual de ciclos. | `A1:CW67` | Sin formulas detectadas; tabla de entrada. |
| `Ene`...`Dic` | Cuadrantes mensuales generados desde ciclos. | Aproximadamente `A1:EX396` | Formula modular de ciclo, computos mensuales, contadores por codigo. |

No se detectaron hojas ocultas entre las hojas de calculo expuestas por Excel; `Visible=-1` en todas.

### Vínculos externos

El libro depende de un archivo externo de festivos:

```text
\\ficheros\servicios\DIRECCION_ENFERMERIA\#DISTRIBUCION#\Matriz\FESTIVOS\FESTIVOS PTA 2013.xls
```

Rangos afectados:

- Nombre definido `FESTIVOS`: `=Inicio!$B$15:$B$19,Inicio!$F$15:$F$19,Inicio!$I$15:$I$18`.
- `Inicio!B15:B19`, `Inicio!F15:F19`, `Inicio!I15:I18`.

La nueva aplicacion no debe depender de ese archivo: los festivos deben convertirse en entidad local importable/configurable.

### Rangos con nombre

Se identificaron 14 nombres. Relevantes:

- `FESTIVOS`: rango combinado en `Inicio`.
- Areas de impresion mensuales: `Abr!Print_Area`, `Ago!Print_Area`, `Dic!Print_Area`, etc., normalmente `A1:AG214`.
- `Ene!Print_Titles`: `=Ene!$1:$5`.
- `_xlfn.SINGLE`: `=#NAME?`, residuo de compatibilidad.

### Macros

Excel informa `HasVBProject=True`, pero la enumeracion de `VBProject.VBComponents` devuelve 0 componentes en `PTE13.xls`. No se ha identificado codigo VBA operativo desde COM. Debe validarse manualmente si hay botones, eventos perdidos, modulos protegidos o restos historicos.

### Funcionamiento actual

`Inicio` fija el contexto del ano. En la muestra analizada:

- Ano: `2013`.
- Hospital: `VIRGEN DE LA SALUD`.
- Categoria: `ENFERMERAS`.
- Festivos enlazados externamente.

`Personal` contiene columnas de identificacion y seguimiento. Cabeceras detectadas:

- `Nº Orden`.
- `Nombre y apellidos`.
- `Observaciones`.
- `DNI`.
- `Fecha inicio`.
- `Fecha fin`.
- `Telefono1`, `Telefono 2`.
- Meses de enero a diciembre.
- Bloques de festivos y propagacion trimestral.

La futura aplicacion no debe migrar campos personales innecesarios como DNI o telefono salvo que se decida expresamente para otro proceso. Para planificacion de turnos bastan identificador interno, nombre, categoria, unidad, contrato, perfil y observaciones profesionales.

`Ciclos` es una matriz de entrada:

- Fila 1: "Para crear ciclos, introducir el numero de dias del ciclo y los turnos".
- Fila 3: `Nº Ciclo`, `Nº dias de ciclo`, posiciones `1`, `2`, `3`...
- Se detecta capacidad hasta la columna `CW`, por lo que el diseno actual admite ciclos largos pero poco gobernados.

Las hojas mensuales generan turnos por profesional desde `Ciclos`, con parametros por fila:

- `AK`: numero de ciclo.
- `AL`: fecha de inicio de ciclo.
- `AM`: numero de dias del ciclo.
- `AN:AW`: horas por codigos de turno.
- `AY:BJ`: contadores por codigo.

Formula representativa de generacion de turno en `PTE13.xls`, hoja `Ene`, fila de profesional:

```excel
=IF(C$260-$AL6<0,"",INDEX(Ciclos!$C$6:$CW$47,(($AK6-1)*2)+1,((C$260-$AL6)-(INT((C$260-$AL6)/$AM6))*$AM6+1)))
```

Interpretacion:

- Si la fecha del dia es anterior a la fecha de inicio del ciclo, no programa.
- Busca en `Ciclos` la fila asociada al ciclo: `(($AK6-1)*2)+1`.
- Calcula la posicion dentro del ciclo con aritmetica modular: `(dia - inicio) - INT((dia - inicio)/duracion) * duracion + 1`.

Formula representativa de horas mensuales:

```excel
=(AY6*AN6)+(AZ6*AO6)+(BA6*AP6)+(BB6*AQ6)+(BC6*AR6)+(BD6*AS6)+(BE6*AS6)+(BF6*AT6)+(BG6*AT6)+(BH6*AU6)+(BI6*AV6)+(BJ6*AW6)
```

Interpretacion:

- Multiplica contadores mensuales por tabla de horas editable.
- Hay codigos con la misma duracion agrupada, por ejemplo `BD/BE` comparten `AS` y `BF/BG` comparten `AT`.

### Codigos de turno detectados en PTE

En las cabeceras mensuales se observaron codigos y equivalencias horarias:

| Codigo | Lectura detectada | Horas detectadas |
| --- | --- | --- |
| `M` | Manana | 7 |
| `T` | Tarde | 7 |
| `N` | Noche | pendiente de confirmar en PTE; en el encargo se propone 10 |
| `m2` | Media jornada/manana parcial | pendiente |
| `t2` | Tarde parcial | pendiente |
| `t1` | Tercios u otra parcialidad | pendiente |
| `MA` | Turno especial | 9,5 |
| `MB` | Turno especial | 10 |
| Otros | codigos historicos no normalizados | pendiente |

No se deben hardcodear estos codigos: deben migrarse como `TipoTurno` configurable.

### Limitaciones detectadas en PTE

- Orientacion anual fija y hojas por mes.
- Fuerte dependencia de posiciones de celda.
- Ciclos introducidos como matriz sin entidad ni historial.
- Festivos enlazados a archivo externo no disponible.
- Datos personales innecesarios mezclados con planificacion.
- Trazabilidad limitada: el turno generado y el modificado manualmente pueden coincidir en la misma celda.
- Capacidad aproximada de 100 profesionales si cada profesional ocupa dos filas; el rango de personal llega a `206` y los meses usan filas hasta `205`.

## GTE13.xls

### Estructura

Libro de gestion de jornada, incidencias, comprobaciones e informes. Contiene 20 hojas visibles:

| Hoja | Uso detectado | Rango usado | Observaciones |
| --- | --- | --- | --- |
| `Inicio` | Parametros importados desde PTE y festivos. | `A1:S63` | Vincula con `PTE13.xls` y festivos externos. |
| `Personal` | Copia/actualizacion desde programador y datos de contratos/incidencias. | `A1:CP139` | Incluye advertencias sobre fecha inicio/fin. |
| `Ene`...`Dic` | Gestor mensual con turno programado, incidencias, computo horario y comprobaciones. | De `A1:EX319` a `A1:IK319` segun mes | Hojas mucho mas anchas que PTE. |
| `Planilla` | Vista imprimible por profesional. | `A1:BK618` | Sin formulas detectadas en la muestra COM; probablemente alimentada por macros/seleccion manual o formulas no activas. |
| `cuadro mando` | Resumen mensual/acumulado por unidad. | `A1:Y50` | Alimenta indicadores. |
| `Finiquito virtual` | Modelo de comunicacion/liquidacion. | `A1:AQ1137` | Plantilla de baja/finiquito. |
| `EXPQVTITULARES` | Tabla resumen exportable. | `A1:R20` | Referencia `cuadro mando`. |
| `indicadores` | Ratios trimestrales/anuales. | `A1:J21` | Contiene divisiones con `#DIV/0!` si no hay plantilla. |
| `Tabla de Horas` | Tabla de jornada anual por noches teoricas. | `A1:B169` | Vinculada a archivo externo de festivos/matriz. |

No se detectaron hojas ocultas entre las hojas expuestas por Excel.

### Vínculos externos

GTE depende de:

```text
\\ficheros\servicios\DIRECCION_ENFERMERIA\#DISTRIBUCION#\Matriz\FESTIVOS\FESTIVOS PTA 2013.xls
https://d.docs.live.net/b6dd814814acbc6a/Carlos/Drive/Trabajo/SESCAM/GAE%20TOLEDO/Gestores/PTE13.xls
```

Ejemplos:

```excel
Inicio!E5 = '[PTE13.xls]Inicio'!$E$5
Inicio!E7:H7 = '[PTE13.xls]Inicio'!$E$7
Abr!C6:AF77 = '[PTE13.xls]Abr'!C6
Tabla de Horas!B3:B150 = '[FESTIVOS PTA 2013.xls]Tabla de Horas'!B3
```

La dependencia entre libros es directa: GTE consume PTE para ano, hospital, unidad, categoria, personal, ciclos y turnos programados. En la aplicacion nueva esto debe ser un unico modelo local; no dos artefactos conectados por vinculos.

### Rangos con nombre

Se detectaron nombres similares a PTE:

- Areas de impresion mensuales.
- `Personal!Print_Area`.
- `Planilla!Print_Area`.
- `'Finiquito virtual'!Print_Area`.
- `FESTIVOS`.
- `'cuadro mando'!_FilterDatabase`.
- `_xlfn.SINGLE = #NAME?`.

### Macros

Excel informa `HasVBProject=True`, pero `VBComponentsCount=0` en `GTE13.xls`. No se ha extraido codigo VBA. En la interfaz hay textos como "Doble click para ver datos totales", por lo que se debe validar manualmente si existian comportamientos de evento, formularios o automatismos perdidos.

### Funcionamiento actual

`GTE13.xls` amplia el cuadrante importado con:

- Computo horario.
- Permisos y licencias oficiales.
- Vacaciones.
- Incapacidad transitoria.
- Baja maternal/lactancia.
- Libre disposicion.
- Libre trienio.
- Permiso paternal.
- Permiso sin sueldo.
- Reduccion de jornada.
- Noches y noches festivas.
- Excedencias y permisos sin sueldo.

Cabeceras detectadas en hojas mensuales:

- `COMPUTO HORARIO`.
- `PERMISOS Y LICENCIAS OFICIALES`.
- `VACACIONES`.
- `NOCHES`.
- `NOCHES FESTIVOS`.
- `REDUCCION DE JORNADA`.
- `RESPETO DE JORNADA PROGRAMADA Y EXCEDENCIAS Y PSS`.
- `TURNOS ESPECIALES`.

Formula representativa de parcialidades:

```excel
=COUNTIF($C6:$AG7,"=m2")+COUNTIF($C6:$AG7,"=t2")
```

Formula representativa de incidencias con efecto de computo/cobertura:

```excel
=IF(AND(OR(C7="PP",C7="PB",C7="LM",C7="LT",C7="EX",C7="PSS", ... )))
```

La formula aparece truncada en la extraccion de muestras, pero evidencia que determinadas incidencias se evaluan contra el turno/dia para generar marcadores de computo.

### Codigos de incidencias detectados en GTE

| Codigo/etiqueta | Interpretacion probable | Estado |
| --- | --- | --- |
| `IT` | Incapacidad transitoria/temporal | Confirmado por cabecera. |
| `PP` | Permiso personal | Confirmado por cabecera. |
| `PB` | Permiso boda | Confirmado por cabecera. |
| `BM` | Baja maternal | Confirmado por cabecera. |
| `LM` | Lactancia materna | Confirmado por cabecera. |
| `LF` | Libre formacion o permiso formacion | Deducido; validar codigo exacto. |
| `LP` | Libre disposicion | Deducido; validar codigo exacto. |
| `LT` | Libre trienio | Deducido; validar codigo exacto. |
| `EX` | Excedencia | Detectado en formulas. |
| `PSS` | Permiso sin sueldo | Detectado en formulas. |

El modelo nuevo debe registrar cada incidencia con reglas configurables de presencia, computo, cobertura y jornada.

### Tabla de jornada

La hoja `Tabla de Horas` contiene:

| Columna | Contenido |
| --- | --- |
| `A` | `NOCHES TEORICAS` |
| `B` | `JORNADA ANUAL A REALIZAR` |

Ejemplos detectados:

| Noches teoricas | Jornada anual |
| ---: | ---: |
| 0 | 1645 |
| 1 | 1641 |
| 2 | 1637 |
| 3 | 1633 |
| 4 | 1636 |
| 5 | 1632 |
| 6 | 1628 |
| 7 | 1624 |
| 8 | 1620 |
| 9 | 1616 |

Esta tabla esta enlazada a un archivo externo de 2013. No coincide con los perfiles normativos modernos indicados en el encargo. Debe tratarse como tabla historica importada, no como regla universal.

### Informes detectados

`cuadro mando` resume variables por mes y acumulado:

- Horas trabajadas.
- Dias IT.
- Dias permiso personal.
- Dias permiso boda.
- Dias baja maternal.
- Dias lactancia materna.
- Dias vacaciones.
- Dias permiso formacion.
- Dias libre disposicion.
- Dias permiso paternal.
- Dias permiso sin sueldo.

`indicadores` calcula ratios sobre plantilla:

```excel
=B5/B3
```

Esto produce `#DIV/0!` cuando la plantilla es 0. La nueva aplicacion debe evitar errores visibles y mostrar "sin datos" o equivalente.

## Correspondencia entre libros

| Concepto | PTE13.xls | GTE13.xls | Propuesta nueva |
| --- | --- | --- | --- |
| Ano/hospital/unidad/categoria | `Inicio` | `Inicio` vinculado a PTE | Entidad `Unidad` + `Escenario` + ano. |
| Festivos | `Inicio` enlazado a matriz externa | `Inicio` enlazado a matriz externa | Entidad `Festivo`, importable por ano/unidad/ambito. |
| Profesionales | `Personal` | `Personal` vinculado/actualizado | `Profesional` + `Contrato`. |
| Ciclos | `Ciclos` | Parametros importados desde PTE | `Ciclo`, `PosicionCiclo`, `AsignacionCiclo`. |
| Turnos previstos | Hojas mensuales generadas | Hojas mensuales importadas desde PTE | `PlanificacionDiaria.origen=ciclo`. |
| Modificaciones manuales | Celdas del mes | Celdas del mes y filas alternas | `ModificacionManual` con auditoria. |
| Incidencias | Observaciones en `Personal` | Bloques mensuales de permisos/licencias | `Incidencia` + reglas de computo. |
| Jornada | Contadores por codigo y horas | Computo horario + tabla de horas | Motor de jornada versionado por perfil. |
| Informes | Total jornada mensual/anual | Cuadro mando, indicadores, planilla, finiquito | Informes parametrizados y exportables. |

## Riesgos de migracion

- Reglas dispersas en formulas de hojas mensuales, no en un motor unico.
- Dependencias externas no disponibles o no deseables en entorno offline.
- Codigos de turno/incidencia parcialmente implicitos.
- Tabla historica de jornada de 2013 no aplicable directamente a 2019+.
- Posible uso historico de doble click/eventos no visible como VBA.
- Datos personales excesivos para la nueva finalidad.
- Excel mezcla turno previsto, incidencia, jornada computada y salida impresa.
- PTE y GTE usan filas dobles por profesional en varias hojas; debe normalizarse.

## Dudas documentadas

- Confirmar si `HasVBProject=True` con 0 componentes implica proyecto vacio o si hay proteccion/automatismos no expuestos.
- Confirmar codigos exactos y horas de `m2`, `t2`, `t1`, `MA`, `MB` y otros turnos especiales.
- Confirmar efectos de `PP`, `PB`, `LM`, `LT`, `EX`, `PSS`, `BM`, `LP` sobre cobertura y computo.
- Validar si la tabla `Tabla de Horas` de 2013 debe conservarse solo para consulta historica.
- Obtener OCR o version textual del PDF normativo para cerrar reglas de jornada.
