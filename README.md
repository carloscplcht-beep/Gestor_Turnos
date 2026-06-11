# Gestor de Turnos

Documentacion inicial para el diseno de una aplicacion local de planificacion y gestion de turnos de enfermeria hospitalaria.

## Documentos

- `docs/ANALISIS_EXCEL.md`: analisis de los libros `PTE13.xls` y `GTE13.xls`.
- `docs/ESPECIFICACION_FUNCIONAL.md`: actores, casos de uso, modulos, pantallas y criterios.
- `docs/REGLAS_DE_CALCULO.md`: reglas confirmadas, deducidas y pendientes.
- `docs/MODELO_DE_DATOS.md`: entidades principales y ejemplos JSON.
- `docs/ARQUITECTURA_TECNICA.md`: arquitectura local, offline, IndexedDB y empaquetado.
- `docs/PLAN_DESARROLLO.md`: fases de implementacion verificables.
- `docs/PLAN_DE_PRUEBAS.md`: pruebas unitarias, integracion y funcionales.
- `docs/PREGUNTAS_PENDIENTES.md`: decisiones pendientes de validacion funcional.
- `docs/VALIDACION_TABLA_PONDERACION.md`: validacion de la tabla SESCAM 2019 incluida.
- `docs/VALIDACION_V0.1.md`: procedimiento de validacion manual de la primera version funcional.

## Estado

La V0.1 incluye una aplicacion local funcional sin servidor:

- Configuracion de unidad, hospital, ano activo y jornada personalizada.
- Gestion de profesionales, tipos de turno y ciclos rotatorios.
- Generacion de cuadrante anual y vista mensual.
- Calculo de horas mensuales/anuales, noches y diferencia frente a jornada objetivo.
- Persistencia local en IndexedDB.
- Exportacion e importacion de copia de seguridad JSON.
- Tabla normativa SESCAM 2019 integrada desde la fuente adjunta.

## Uso

Abrir directamente en el navegador:

`dist/gestor-turnos-enfermeria.html`

No requiere CDN, servidor local ni instalacion por parte del usuario final.

## Desarrollo

Con Node.js disponible:

```bash
npm run verify
```

Este comando regenera la normativa, valida la tabla de ponderacion, ejecuta pruebas de dominio y reconstruye el HTML autonomo de `dist/`.
