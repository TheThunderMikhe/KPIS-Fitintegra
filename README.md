# Resumen comercial · Fit Integra

Tablero estático de la red (11 unidades). Se publica en GitHub Pages desde `main`, sin build. Toda la interfaz está en español (es-MX) y los montos en pesos mexicanos (MXN).

La actualización del día solo toca [`data/kpis.json`](data/kpis.json). El navegador calcula los porcentajes al abrir la página.

## Qué muestra

- Totales de la red: ingresos 2026 contra la meta, avance, crecimiento vs 2025 y vs 2024, y venta.
- Gráfica de avance de meta por unidad.
- Tabla por unidad, ordenable. La primera columna se queda fija al desplazar en horizontal.
- Selector de unidad. **Global** es el total de la red. Cada pastilla sale del nombre en `unidades`; no está escrita en el HTML. Al elegir una unidad, las tarjetas, la gráfica y la tabla quedan en esa unidad. La elección vive en el hash (`#coapa`, `#la-salle`, `#casa-blanca`) y se puede compartir. Vacío o `#global` es la red. Un hash que no coincide deja la vista global.
- Tema claro u oscuro. El botón de sol o luna está en el encabezado. Sin elección guardada, sigue `prefers-color-scheme`. La elección se guarda en `localStorage` (`fit-integra-tema`) y se aplica antes de pintar, para no parpadear.
- Columnas vacías en las 11 unidades, en «Pendiente de captura», no como ceros.
- Estatus tal como se capturó. No se recalcula con el avance.

## Fórmulas que sí se calculan

Están verificadas contra Notion. No van en el JSON.

| Indicador | Fórmula |
| --- | --- |
| Avance de meta | Ingresos 2026 ÷ Meta |
| Crecimiento vs 2025 | Ingresos 2026 ÷ Ingresos 2025 − 1 |
| Crecimiento vs 2024 | Ingresos 2026 ÷ Ingresos 2024 − 1. Si ingresos 2024 es `0`, el resultado es −100%. |
| % Venta | Venta ÷ Ingresos 2026. Si venta es `null`, cuenta como 0. |

No se calculan altas, bajas, tasas, ticket, costo por conversación ni los porcentajes de canal. Esas fórmulas no quedaron verificadas. El estatus es manual.

## Formato de `data/kpis.json`

```json
{
  "schema_version": 1,
  "periodo": "Octubre 2026",
  "corte": "Acumulado del mes al 21 de octubre de 2026",
  "ultima_actualizacion": "2026-10-21",
  "fuente": "Notion · Resumen Comercial Octubre 26",
  "moneda": "MXN",
  "unidades": []
}
```

`ultima_actualizacion` acepta fecha (`2026-10-22`) o fecha con hora del centro de México (`2026-10-22T07:30:00-06:00`). México no cambia de horario: el desfase es `-06:00`.

Cada unidad lleva insumos. `null` es «sin captura». `0` es un cero real (Tepetatal y La Mancha tienen ingresos 2024 en 0, no vacío).

| JSON | Columna en Notion |
| --- | --- |
| `unidad` | Unidad |
| `meta` | Meta |
| `ingresos_2026` | Ingresos 2026 |
| `ingresos_2025` | Ingresos 2025 |
| `ingresos_2024` | Ingresos 2024 |
| `venta` | Venta |
| `gastos_sin_inversion` | Gastos sin inversión |
| `usuarios_activos_mes_anterior` | Usuarios Activos mes anterior |
| `usuarios_activos` | Usuarios Activos |
| `altas_digitales` | Altas Digitales |
| `altas_tradicionales` | Altas Tradicionales |
| `altas_seguimiento` | Altas Seguimiento |
| `inversion` | Inversión |
| `alcance` | Alcance |
| `conversaciones` | Conversaciones |
| `recurente` | Recurente (así está escrito en Notion) |
| `recuperado` | Recuperado |
| `pago_adelantado` | Pago Adelantado |
| `retail` | Retail |
| `eventos` | Eventos |
| `agregadores` | Agregadores |
| `cargos_domiciliados` | Cargos Domiciliados |
| `numero` | Número |
| `status` | Status |

Valores de `status` para el color de la etiqueta: `Hasta 50%`, `Hasta 75%`, `Hasta 90%`, `Hasta 99%`, `100%+`. Otro texto se muestra igual, sin color de escala.

No pongas en el archivo avance, crecimientos, % de venta ni el resto de fórmulas. Si un insumo que hoy está en `null` se llena en todas o en alguna unidad, la columna aparece sola en la tabla.

El orden del arreglo es el de la tabla de Notion y sirve de desempate al ordenar.

## Actualización dos veces al día

Alrededor de las **7:30 a. m.** y las **8:30 p. m.**, hora del centro de México, se actualizan ingresos 2026 y venta.

1. Edita `ingresos_2026` y `venta` de cada unidad.
2. Si una unidad no trae venta en ese corte, deja `venta` en `null`. No escribas `0` salvo que la venta real sea cero.
3. Cambia `ultima_actualizacion`, por ejemplo `2026-10-22T07:30:00-06:00` o `2026-10-22T20:30:00-06:00`.
4. Si cambia el corte o el mes, ajusta `periodo` y `corte`.
5. Haz commit y push a `main`. No hay build. Recarga el sitio; la página pide el JSON sin caché.

## Verlo en local

Hace falta un servidor: el navegador no puede leer el JSON si abres el HTML como archivo.

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## GitHub Pages

El sitio está en la raíz del repositorio (`index.html`) y lleva `.nojekyll` para que Pages no lo procese con Jekyll.

Pages publica la rama `main`, carpeta `/`. La URL es `https://thethundermikhe.github.io/KPIS-Fitintegra/`. No hace falta workflow ni paso de build. Un cambio en `main` se ve al terminar el despliegue de Pages.
