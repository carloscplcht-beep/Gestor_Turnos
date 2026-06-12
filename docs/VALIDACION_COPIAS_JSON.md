# Validacion de copias JSON

## Exportar una copia

1. Abrir el modulo `Copias`.
2. Pulsar `Exportar copia JSON`.
3. Guardar el archivo generado, con nombre similar a `gestor-turnos_copia_2026-06-12_1200.json`.

La copia contiene la configuracion general, unidad, ano activo, profesionales, orden visual, turnos, colores, `cuentaComoPresencia`, ciclos, secuencias, asignaciones, fechas de contrato, fechas de inicio de ciclo, posiciones iniciales, configuracion de jornada, tabla normativa y una instantanea de IndexedDB.

## Importar en otro equipo

1. Abrir la aplicacion en el otro ordenador.
2. Entrar en `Copias`.
3. Pulsar `Importar copia JSON`.
4. Seleccionar el archivo `.json`.
5. Revisar el resumen previo: fecha de exportacion, esquema, version, unidad, profesionales, turnos, ciclos y anos incluidos.
6. Confirmar la sustitucion de datos.

La importacion funciona en local: el archivo se lee en el navegador y no se sube a ningun servidor.

## Proteccion de datos actuales

Antes de sustituir datos, la aplicacion descarga automaticamente una copia previa con un nombre similar a:

`gestor-turnos_copia-antes-de-importar_2026-06-12_1205.json`

Si la copia entrante no es valida, no se importa. Si falla la escritura, se conserva el estado anterior.

## Seguridad y limites

- No existe sincronizacion automatica entre ordenadores.
- El archivo JSON debe guardarse en una ubicacion segura.
- Importar una copia sustituye todos los datos almacenados actualmente en ese navegador.
- La fusion de unidades o escenarios sin sobrescribir queda como mejora futura.

## Validacion completa

1. Crear una unidad.
2. Crear ocho profesionales.
3. Definir orden visual.
4. Crear turnos.
5. Crear un ciclo.
6. Asignar fechas y posiciones.
7. Generar el cuadrante.
8. Exportar JSON.
9. Abrir la aplicacion en un perfil limpio.
10. Importar el JSON.
11. Confirmar que profesionales, orden, ciclos, fechas, posiciones, horas, noches y sumatorios diarios coinciden.

Ejecutar tambien:

`npm test`

`npm run verify`
