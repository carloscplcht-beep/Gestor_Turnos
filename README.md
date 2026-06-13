# Gestor Local de Turnos de Enfermería

Aplicación local/offline para planificación de turnos de enfermería hospitalaria, generación de cuadrantes, cálculo de jornada, gestión básica de vacaciones y libre disposición, impresión y copias JSON.

Versión actual: **V0.1.1 en pruebas**. No es una herramienta asistencial definitiva; debe validarse en piloto antes de usarse como referencia operativa.

## URL pública

La aplicación publicada se abre desde:

https://carloscplcht-beep.github.io/Gestor_Turnos/

## Uso local

Puede utilizarse de tres formas:

- Desde GitHub Pages, con la URL pública anterior.
- Abriendo `index.html` en el navegador.
- Abriendo `dist/gestor-turnos-enfermeria.html` en el navegador.

Los datos se guardan en IndexedDB dentro del navegador del equipo. No se suben datos a servidores. Las copias JSON se exportan e importan manualmente, y la impresión se realiza localmente mediante el navegador.

## Funcionalidades V0.1.1

- Configuración de unidad, hospital, año activo y jornada personalizada.
- Gestión de profesionales con contrato, modalidad normativa, porcentaje de jornada, ciclo asignado y fecha de inicio de ciclo.
- Escalonamiento de profesionales mediante fechas de inicio de ciclo consecutivas; `posicionInicial` se mantiene internamente en `0`.
- Catálogo local de tipos de turno.
- Definición de ciclos rotatorios.
- Cuadrante mensual con resumen diario de turnos.
- Botón **Recalcular cuadrante** desde datos persistidos en IndexedDB.
- Resumen de jornada anual con base prevista, vacaciones, libre disposición, horas efectivas y diferencias.
- Incidencias básicas de vacaciones y libre disposición mediante modal visual.
- Impresión de mes actual, año completo, resumen general y planilla individual anual.
- Logos institucionales integrados como recursos locales.
- Exportación e importación manual de copias JSON.
- Auditoría local sin CDN, recursos remotos, backend ni envío de datos.
- Pruebas automatizadas de dominio, normativa, build, navegador y publicación estática.

La fuente validada incluye 146 filas de ponderación, desde 0 hasta 145 noches. El rango válido de la tabla normativa es `0-145 noches`; valores superiores requieren revisión manual.

## Desarrollo

Ejecutar la validación completa:

```bash
npm run verify
```

Este comando regenera la tabla normativa, valida la tabla de ponderación, ejecuta pruebas de dominio, construye `dist/gestor-turnos-enfermeria.html` e `index.html`, y lanza la prueba de navegador real.

Comandos individuales útiles:

```bash
npm test
npm run validate:tabla
npm run build
npm run test:browser
```

## Privacidad

La aplicación es HTML estático y JavaScript local. GitHub Pages solo sirve los archivos de la aplicación; los profesionales, turnos, ciclos, incidencias y copias JSON permanecen en el navegador del usuario salvo exportación manual.
