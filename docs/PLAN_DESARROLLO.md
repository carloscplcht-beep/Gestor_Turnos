# Plan de desarrollo

## Fase 0: analisis y decisiones

Objetivo: cerrar reglas funcionales minimas antes de implementar.

Tareas:

- Revisar estos documentos con responsable funcional.
- Validar codigos de turnos e incidencias.
- Obtener OCR o version textual normativa.
- Decidir librerias locales.
- Definir formato JSON de backup.

Archivos afectados:

- `docs/*`.
- Prototipos de prueba no distribuibles.

Pruebas:

- Revision funcional.
- Checklist de restricciones offline.

Criterios de aceptacion:

- Preguntas bloqueantes resueltas.
- Reglas de ciclo aprobadas.
- Perfil normativo base configurado.

Riesgos:

- Normativa no legible.
- Codigos historicos ambiguos.

Dependencias:

- Responsable funcional.

## Fase 1: estructura base y navegacion

Objetivo: crear esqueleto local sin funcionalidad de calculo completa.

Tareas:

- Estructura `src`.
- Navegacion principal.
- Layout profesional y accesible.
- IndexedDB inicial.
- Pantalla selector unidad/ano/escenario.

Archivos afectados:

- `index.html`.
- `src/app/*`.
- `src/ui/*`.
- `src/persistence/*`.
- `src/styles/*`.

Pruebas:

- Abre desde `file://`.
- No realiza peticiones de red.
- Crea base IndexedDB.

Criterios:

- Navegacion estable.
- Sin CDN.
- Sin servidor requerido.

Riesgos:

- Restricciones de navegador corporativo.

Dependencias:

- Decision de librerias.

## Fase 2: unidades, profesionales y turnos

Objetivo: mantener datos maestros.

Tareas:

- CRUD de unidades.
- CRUD de profesionales.
- CRUD de contratos.
- Catalogo de turnos.
- Validaciones basicas.

Archivos:

- `src/domain/profesionales.js`.
- `src/domain/turnos.js`.
- `src/ui/profesionales/*`.
- `src/ui/turnos/*`.

Pruebas:

- Crear/editar/desactivar turno.
- Profesional con contrato parcial.
- Validar solape de contratos.

Criterios:

- No se solicitan datos personales innecesarios.
- Turnos no hardcodeados.

Riesgos:

- Campos heredados de Excel no necesarios pueden generar ruido.

Dependencias:

- Modelo de datos aprobado.

## Fase 3: constructor de ciclos

Objetivo: reemplazar hoja `Ciclos`.

Tareas:

- Editor de secuencia.
- Resumen automatico.
- Asignacion a profesionales.
- Desfase y fecha de inicio.

Archivos:

- `src/domain/ciclos.js`.
- `src/calculation/cycleEngine.js`.
- `src/ui/ciclos/*`.

Pruebas:

- Ciclo de 9 dias.
- Ciclo de 28 dias.
- Fecha de inicio antes del 1 de enero.
- Turno inactivo.

Criterios:

- Resultados coinciden con formula modular de PTE.

Riesgos:

- Diferencias por fechas/zonas horarias.

Dependencias:

- Catalogo de turnos.

## Fase 4: generacion anual

Objetivo: generar planificacion diaria.

Tareas:

- Motor anual.
- Limites por contrato.
- Regeneracion futura.
- Auditoria de generacion.

Archivos:

- `src/calculation/calendarEngine.js`.
- `src/domain/planificacion.js`.
- `src/persistence/planificacionRepository.js`.

Pruebas:

- Ano bisiesto.
- Alta a mitad de ano.
- Baja a mitad de ano.
- Ciclo iniciado en ano anterior.

Criterios:

- No genera fuera de contrato.
- No borra modificaciones historicas.

Riesgos:

- Volumen de datos IndexedDB.

Dependencias:

- Fase 3.

## Fase 5: cuadrante editable

Objetivo: interfaz principal de supervision.

Tareas:

- Vista mensual.
- Vista anual compacta.
- Edicion manual de turno.
- Marcas de origen.
- Detalle por celda.

Archivos:

- `src/ui/cuadrante/*`.
- `src/domain/modificaciones.js`.
- `src/audit/*`.

Pruebas:

- Editar turno.
- Ver origen ciclo/manual.
- Revertir modificacion.

Criterios:

- Trazabilidad visible.
- Edicion clara y reversible.

Riesgos:

- Grillas grandes y rendimiento.

Dependencias:

- Fase 4.

## Fase 6: jornada e incidencias

Objetivo: registrar incidencias y calcular jornada.

Tareas:

- Catalogo de incidencias.
- Registro por dia/rango.
- Motor de computo.
- Perfil normativo.
- Tabla de noches.

Archivos:

- `src/domain/incidencias.js`.
- `src/calculation/incidentEngine.js`.
- `src/calculation/worktimeEngine.js`.
- `src/ui/jornada/*`.

Pruebas:

- Vacaciones.
- IT.
- Permiso personal.
- Noches.
- Contrato parcial.

Criterios:

- Turno previsto no se pierde.
- Jornada muestra desglose auditable.

Riesgos:

- Reglas normativas incompletas.

Dependencias:

- Preguntas bloqueantes resueltas.

## Fase 7: cobertura

Objetivo: detectar deficits y excesos.

Tareas:

- Reglas de cobertura.
- Calculo diario.
- Vista de deficits.
- Profesionales disponibles.

Archivos:

- `src/domain/cobertura.js`.
- `src/calculation/coverageEngine.js`.
- `src/ui/cobertura/*`.

Pruebas:

- Laborable.
- Sabado.
- Domingo.
- Festivo.
- Incidencia causante.

Criterios:

- Deficit explica causa.
- Reglas editables por unidad.

Riesgos:

- Coberturas reales no presentes en Excel.

Dependencias:

- Fase 6.

## Fase 8: escenarios

Objetivo: separar oficial y simulaciones.

Tareas:

- Duplicar escenario.
- Bloquear oficial.
- Comparar diferencias.
- Archivar.

Archivos:

- `src/domain/escenarios.js`.
- `src/calculation/scenarioDiffEngine.js`.
- `src/ui/escenarios/*`.

Pruebas:

- Duplicacion profunda.
- Simulacion no modifica oficial.
- Comparacion de jornada/cobertura.

Criterios:

- Escenario activo visible.
- Oficial protegido.

Riesgos:

- Duplicacion de volumen alto.

Dependencias:

- Fases 4-7.

## Fase 9: importacion y exportacion

Objetivo: copias e intercambio.

Tareas:

- Exportar JSON.
- Importar JSON como nuevo escenario.
- Exportar Excel.
- Validar esquema.

Archivos:

- `src/import-export/jsonExport.js`.
- `src/import-export/jsonImport.js`.
- `src/import-export/excelExport.js`.

Pruebas:

- Backup completo.
- Restauracion.
- Error por version incompatible.
- Excel abre correctamente.

Criterios:

- Importacion nunca sobrescribe sin confirmacion.
- Exportacion identifica unidad/ano/escenario.

Riesgos:

- Libreria Excel local.

Dependencias:

- Modelo estable.

## Fase 10: informes y validacion final

Objetivo: cerrar primera version revisable.

Tareas:

- Informes de jornada.
- Informes de cobertura.
- Informes de incidencias.
- Impresion.
- Validacion con casos reales anonimizados.

Archivos:

- `src/reporting/*`.
- `src/ui/informes/*`.
- `src/styles/print.css`.

Pruebas:

- Comparar contra Excel con datos anonimizados.
- Revision por supervisor.
- Prueba offline completa.

Criterios:

- Informes auditables.
- Sin errores de calculo conocidos.
- Backups probados.

Riesgos:

- Casos excepcionales no representados.

Dependencias:

- Todas las fases anteriores.
