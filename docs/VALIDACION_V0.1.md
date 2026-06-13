# Validacion manual V0.1

## Preparacion

1. Abrir `dist/gestor-turnos-enfermeria.html` en Edge o Chrome.
2. Confirmar que no hay conexion de red necesaria.
3. Abrir herramientas de desarrollo y revisar que no hay errores de consola.

## Procedimiento funcional

1. Entrar en `Configuracion`.
2. Crear o editar una unidad, por ejemplo `UCI Demo`.
3. Seleccionar el ano activo.
4. Entrar en `Turnos`.
5. Confirmar que existen `M`, `T`, `N` y `L`; si se desea, editar horas y colores.
6. Entrar en `Ciclos`.
7. Crear un ciclo con la secuencia `M, M, T, T, N, N, L, L, L`.
8. Entrar en `Profesionales`.
9. Crear ocho profesionales.
10. Asignar a todos el ciclo creado.
11. Aplicar posiciones iniciales distintas: 0, 1, 2, 3, 4, 5, 6 y 7.
12. Usar fecha de inicio de contrato `01/01` y fin `31/12` para algunos profesionales.
13. Crear al menos un profesional con alta a mitad de ano y comprobar la alerta `Prorrata pendiente`.
14. Entrar en `Cuadrante`.
15. Seleccionar enero.
16. Comprobar que la secuencia se repite modularmente segun la posicion inicial.
17. Comprobar que sabados y domingos aparecen diferenciados.
18. Comprobar que las celdas fuera de contrato quedan vacias.
19. Comprobar el total mensual al final de cada fila.
20. Entrar en `Jornada`.
21. Comprobar horas mensuales, horas anuales y diferencia.
22. Para profesionales rotatorios, comprobar el numero de noches contado.
23. Confirmar que la jornada rotatoria procede de la tabla de ponderacion y no de un valor fijo.
24. Confirmar que 42 noches aplican jornada a realizar de 1.491 horas si el profesional genera exactamente 42 noches.

## Copia de seguridad

1. Entrar en `Copias`.
2. Pulsar `Exportar JSON`.
3. Guardar el archivo.
4. Pulsar `Restablecer datos` y aceptar la doble confirmacion.
5. Confirmar que los datos vuelven al estado inicial.
6. Importar el JSON exportado.
7. Confirmar el resumen mostrado antes de importar.
8. Confirmar que se recuperan unidad, profesionales, turnos, ciclos y ano activo.

## Criterios de aceptacion manual

- La aplicacion abre desde archivo local.
- No hay errores de consola.
- IndexedDB conserva datos tras cerrar y reabrir.
- La generacion modular coincide con la secuencia del ciclo.
- Las horas se recalculan al cambiar ciclo, posicion o fechas.
- La tabla normativa disponible cubre 0 a 145 noches.
- La fuente validada incluye 146 filas de ponderación, desde 0 hasta 145 noches. El rango válido de la tabla es 0-145 noches.
