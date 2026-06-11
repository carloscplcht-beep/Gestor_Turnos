# Especificacion funcional

## Objetivo

Crear una aplicacion local, offline y distribuible como HTML para planificar turnos de unidades de enfermeria hospitalaria, sustituyendo la pareja de libros `PTE13.xls` y `GTE13.xls` por un modelo unico, trazable, configurable y auditable.

La primera version no tendra servidor, autenticacion, inteligencia artificial, multiusuario ni app movil.

## Actores

| Actor | Necesidad principal |
| --- | --- |
| Supervisor/a de enfermeria | Crear y ajustar cuadrantes, controlar cobertura, registrar incidencias y revisar jornada. |
| Direccion de enfermeria | Revisar informes agregados, deficits, excesos, indicadores y escenarios. |
| Administrativo/a autorizado | Mantener profesionales, contratos, incidencias, festivos y exportaciones. |
| Responsable funcional | Validar reglas de jornada, permisos, vacaciones, nocturnidad y cobertura. |

## Modulos funcionales

1. Parametros generales.
2. Unidades y escenarios.
3. Profesionales y contratos.
4. Catalogo de turnos.
5. Constructor de ciclos.
6. Generador anual.
7. Cuadrante mensual/anual editable.
8. Incidencias y ausencias.
9. Motor de jornada.
10. Cobertura asistencial.
11. Informes.
12. Importacion/exportacion y copias de seguridad.
13. Auditoria local.

## Casos de uso

### Gestion de unidades y escenarios

- Crear hospital, unidad o servicio.
- Definir ano de planificacion.
- Crear escenario oficial.
- Duplicar escenario oficial para simulacion.
- Comparar escenarios.
- Archivar escenarios antiguos.
- Bloquear sobrescritura accidental del escenario oficial.

Criterios de aceptacion:

- Un escenario de simulacion no modifica datos oficiales.
- La aplicacion muestra claramente el escenario activo.
- Toda exportacion identifica unidad, ano y escenario.

### Gestion de profesionales

Cada profesional tendra:

- Nombre y apellidos.
- Identificador interno.
- Categoria profesional.
- Unidad.
- Observaciones.

Cada contrato o periodo laboral tendra:

- Fecha de inicio.
- Fecha de fin opcional.
- Porcentaje de jornada.
- Modalidad de turno.
- Perfil normativo de jornada.
- Posibles reducciones.

Validaciones:

- No permitir contrato sin fecha de inicio.
- Avisar si hay solapes de contratos del mismo profesional.
- No exigir DNI, telefono, direccion ni fecha de nacimiento.

### Catalogo de turnos

El usuario podra crear y editar turnos:

- Codigo.
- Denominacion.
- Hora inicio.
- Hora fin.
- Duracion real.
- Horas computables.
- Grupo de cobertura.
- Si cruza medianoche.
- Color.
- Activo/inactivo.

Criterios de aceptacion:

- Cambiar un turno no destruye historico ya calculado sin confirmacion.
- Los codigos no son fijos en codigo fuente.
- El usuario puede desactivar un turno antiguo y mantenerlo en datos historicos.

### Constructor de ciclos

Permite:

- Crear ciclos de duracion configurable.
- Introducir secuencias por posicion.
- Calcular resumen automatico del ciclo.
- Asignar ciclos a multiples profesionales con desfase.
- Definir fecha de inicio del ciclo.

Resumen esperado:

- Duracion.
- Horas totales.
- Mananas.
- Tardes.
- Noches.
- Descansos.
- Promedio semanal.
- Proyeccion anual estimada.

### Generacion anual

El sistema generara `PlanificacionDiaria` para cada profesional y dia del ano o del periodo de contrato.

Reglas:

- No generar antes de la fecha de inicio del contrato/asignacion.
- No generar despues de la fecha de fin.
- Soportar ciclos iniciados antes del 1 de enero.
- Permitir regenerar solo futuro preservando modificaciones historicas.

### Cuadrante

Vistas:

- Vista mensual por unidad.
- Vista anual compacta.
- Vista por profesional.
- Vista de incidencias.

Cada celda debe distinguir:

- Turno previsto por ciclo.
- Modificacion manual.
- Incidencia.
- Turno computado.
- Origen del calculo.

Acciones:

- Editar turno de un dia.
- Registrar incidencia.
- Ver detalle/auditoria.
- Filtrar por profesional, categoria, contrato, turno o incidencia.

### Incidencias

Catalogo inicial:

- Vacaciones.
- Incapacidad temporal.
- Permiso personal.
- Permiso por matrimonio.
- Maternidad/nacimiento y cuidado.
- Lactancia.
- Formacion.
- Libre disposicion.
- Excedencia.
- Permiso sin sueldo.
- Otras configurables.

Cada tipo de incidencia tendra reglas:

- Presencia asistencial.
- Horas trabajadas.
- Horas computables.
- Efecto en cobertura.
- Efecto en jornada anual.
- Si conserva turno previsto.
- Si requiere sustitucion.

### Jornada

La jornada se calculara por profesional, contrato, periodo y escenario:

- Jornada teorica.
- Horas programadas.
- Horas trabajadas.
- Horas computables.
- Noches efectivas.
- Festivos/fines de semana.
- Exceso/deficit.

Los perfiles normativos seran datos versionados. La aplicacion no dispersara cifras fijas por el codigo.

### Cobertura

El usuario definira reglas por unidad:

- Dia de semana.
- Laborable/sabado/domingo/festivo.
- Turno o grupo de cobertura.
- Minimo requerido.

El sistema detectara:

- Cobertura correcta.
- Deficit.
- Exceso.
- Dias sin cobertura.
- Incidencia causante.
- Profesionales disponibles.
- Necesidad de sustitucion.

### Informes

Informes previstos:

- Resumen de jornada por profesional.
- Horas mensuales/acumuladas.
- Exceso/deficit.
- Conteo de mananas, tardes, noches.
- Fines de semana y festivos.
- Vacaciones e incidencias.
- Cobertura diaria.
- Dias con deficit.
- Comparacion de escenarios.
- Exportacion Excel.
- Informes imprimibles.

## Pantallas previstas

| Pantalla | Contenido |
| --- | --- |
| Inicio/selector | Unidad, ano, escenario activo, avisos. |
| Unidades | Hospitales, servicios, categorias y parametros. |
| Profesionales | Lista, contratos, ciclo asignado, perfil jornada. |
| Turnos | Catalogo editable con colores y horas. |
| Ciclos | Editor de patron y resumen automatico. |
| Cuadrante mensual | Grilla principal de trabajo. |
| Cuadrante anual | Vista compacta para revision global. |
| Incidencias | Registro y catalogo de reglas. |
| Cobertura | Deficits/excesos por dia y grupo. |
| Jornada | Detalle auditable por profesional. |
| Escenarios | Crear, duplicar, comparar, archivar. |
| Informes | Exportacion, impresion y resumenes. |
| Copias | Importar/exportar JSON y Excel. |

## Criterios generales de aceptacion

- Abre desde un archivo HTML local sin instalar nada.
- Funciona sin Internet.
- No usa CDN, fuentes remotas ni APIs externas.
- Guarda datos en IndexedDB.
- Exporta e importa JSON.
- Exporta Excel usando libreria local empaquetada.
- Permite revisar origen de calculos relevantes.
- Mantiene separadas planificacion oficial y simulaciones.
- No modifica los Excel originales.
