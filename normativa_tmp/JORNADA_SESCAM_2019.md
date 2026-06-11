# Jornada SESCAM vigente desde el 1 de enero de 2019

## Fuente

Resolución de 28 de diciembre de 2018, de la Directora Gerente del Servicio de Salud de Castilla-La Mancha, con efectos desde el 1 de enero de 2019.

Archivo de referencia: `jornada-2020.pdf`.

## Jornadas anuales

- Turno diurno: **1.519 horas**.
- Turno nocturno: **1.450 horas**.
- Turno rotatorio: se determina mediante la tabla oficial de ponderación según el número de noches efectivamente programadas.
- Referencia del turno rotatorio para 42 noches: **1.491 horas**.
- Atención continuada de Atención Primaria: **1.500 horas**.
- Unidad móvil de emergencias y centro coordinador: **1.488 horas**.
- SUAP: **1.488 horas**.

## Tabla de ponderación

La tabla completa está disponible en:

- `ponderacion_jornada_sescam_2019.csv`
- `ponderacion_jornada_sescam_2019.json`

Contiene **146 filas**, desde **0 hasta 145 noches**, ambas inclusive.

Campos:

- `numero_noches`
- `libre_salida_noches`
- `mananas_tardes`
- `vacaciones`
- `libres_disposicion`
- `otros_libres_festivos_domingos_variable`
- `jornada_teorica`
- `jornada_realizar`

Para calcular la jornada objetivo del turno rotatorio debe utilizarse el campo `jornada_realizar` de la fila correspondiente al número de noches.

## Instrucción recomendada para Codex

No extraigas ni transcribas la tabla desde el PDF. Utiliza como fuente de datos `ponderacion_jornada_sescam_2019.json` y valida su integridad frente al CSV adjunto. Conserva `jornada-2020.pdf` únicamente como fuente normativa y documental.

No interpoles valores ni apliques una fórmula aproximada. Si el número de noches queda fuera del intervalo 0-145, muestra un error de validación y exige una corrección manual justificada.

## Control de calidad aplicado

- Secuencia completa y continua de 0 a 145 noches.
- 146 filas.
- Coincidencia entre `numero_noches` y `libre_salida_noches`.
- 30 días de vacaciones en todas las filas.
- 8 días en la columna de libre disposición y 24/31 de diciembre.
- Fila de 42 noches comprobada: jornada a realizar = 1.491 horas.
- CSV y JSON generados desde una única fuente de datos para evitar divergencias.
