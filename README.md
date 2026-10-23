# Resumen comercial · Fit Integra

Tablero estático de Fit Integra. Se publica en GitHub Pages desde `main`, sin build. Toda la interfaz está en español (es-MX) y los montos en pesos mexicanos (MXN). Las unidades se agrupan en bloques definidos en `data/kpis.json`.

La actualización del día solo toca [`data/kpis.json`](data/kpis.json). El navegador calcula los porcentajes al abrir la página.

## Qué muestra

- Totales de la red en octubre: ingresos 2026 contra la meta, avance, crecimiento vs 2025 y vs 2024, y venta.
- Selector de meses (enero a octubre de 2026), con atajos T1, T2, T3 y Año a la fecha. El histórico de enero a septiembre solo cubre las 11 unidades Fit. En Fit&Go y Alcaldías el selector se oculta y queda octubre. En Todo, si el periodo incluye un mes anterior a octubre, la vista muestra solo Fit y lo aclara. La elección vive en el hash junto con el bloque y la unidad (`#ene+feb+mar/fit/coapa`). Sin meses, o solo octubre, el hash sigue siendo el de hoy (`#fit/coapa`, `#coapa`, vacío).
- Secciones Financiero, Usuarios y Redes. En un periodo que no es solo octubre, ingreso, meta y avance salen de la agregación. Domiciliado es un monto y se suma. Usuarios activos es el único indicador que toma el último mes con dato.
- Gráfica de avance de meta por unidad.
- Tabla por unidad, ordenable. La primera columna se queda fija al desplazar en horizontal.
- Selector de bloque y, debajo, de unidad. Los nombres salen de `bloques` y `unidades`; no están escritos en el HTML. **Todo** suma todos los bloques. Dentro de un bloque, **Global** es la suma de ese bloque. La elección vive en el hash (`#fit/coapa`, `#fit-go`, `#alcaldias`) y se puede compartir. Vacío o `#todo` es la vista de todos. Un hash de una sola unidad, como `#coapa`, sigue abriendo esa unidad. Un hash que no coincide deja la vista Todo.
- Tema claro u oscuro. El botón de sol o luna está en el encabezado. Sin elección guardada, sigue `prefers-color-scheme`. La elección se guarda en `localStorage` (`fit-integra-tema`) y se aplica antes de pintar, para no parpadear.
- Columnas vacías en las 11 unidades, en «Pendiente de captura», no como ceros.
- Un asterisco marca **dato anterior**: la corrida no trajo ese campo y se conservó el último número, en vez de publicarlo como si fuera de hoy.
- Estatus tal como se capturó. No se recalcula con el avance.

## Fórmulas que sí se calculan

Están verificadas contra Notion. No van en el JSON.

| Indicador | Fórmula |
| --- | --- |
| Avance de meta | Ingresos 2026 ÷ Meta |
| Crecimiento vs 2025 | Ingresos 2026 ÷ Ingresos 2025 − 1. En Todo o en un bloque solo entran unidades con historia. |
| Crecimiento vs 2024 | Ingresos 2026 ÷ Ingresos 2024 − 1. Si ingresos 2024 es `0`, el resultado es −100%. Sin historia, queda pendiente y no entra al total. |
| % Venta | Venta ÷ Ingresos 2026, solo en bloques con `aplica_venta: true`. Si venta es `null`, cuenta como 0. Si `aplica_venta` es `false`, no entra y se muestra «No aplica». |
| Avance de un bloque | Suma de ingresos ÷ suma de metas, solo unidades que traen los dos. Una unidad sin meta, o con meta pero sin ingresos, no mueve el porcentaje. |

En el corte de octubre no se calculan altas, bajas, tasas, ticket, costo por conversación ni los porcentajes de canal a partir de `kpis.json`: si el campo no existe, la sección correspondiente dice «Sin dato». El estatus es manual. Gastos sin inversión no se muestra.

En un periodo con meses de enero a septiembre, las cifras de Fit salen de `data/historico.json` y se agregan así:

| Indicador | Cómo se junta |
| --- | --- |
| Ingreso, meta, altas, bajas, altas netas, domiciliado, inversión, alcance, conversaciones | Suma. Si todos vienen vacíos, queda sin dato, no en cero. Domiciliado es un monto en pesos. Un cero capturado se muestra. |
| Avance | Ingreso ÷ meta, solo en los meses y unidades que traen ambos. |
| Usuarios activos | Entre meses, el último mes elegido que trae dato. Entre unidades, la suma de esos valores. |
| Tasa de retención, tasa de cancelación, ticket promedio | Promedio ponderado por usuarios activos. Sin pesos, sin dato. No se usa un promedio simple. |
| Costo x conversación | Inversión ÷ conversaciones, con las sumas. No es el promedio de los costos. |
| % Conversión | Promedio ponderado por conversaciones. `null` se muestra «Sin dato». No se usa `notas.conversion_estimada`. |

Los porcentajes del histórico vienen en puntos: `85.2` significa 85.2%.

## Formato de `data/kpis.json`

```json
{
  "schema_version": 1,
  "periodo": "Octubre 2026",
  "corte": "Acumulado del mes al 21 de octubre de 2026",
  "ultima_actualizacion": "2026-10-21",
  "fuente": "Notion · Resumen Comercial Octubre 26",
  "moneda": "MXN",
  "bloques": [
    { "id": "fit", "nombre": "Fit", "aplica_venta": true },
    { "id": "fit-go", "nombre": "Fit&Go", "aplica_venta": false },
    { "id": "alcaldias", "nombre": "Alcaldías", "aplica_venta": false }
  ],
  "unidades": []
}
```

`bloques` arma las pastillas de arriba. `id` es el tramo del hash (`#fit`, `#fit-go`, `#alcaldias`). `aplica_venta: false` significa que la venta no se captura: la página dice «No aplica» y no la suma ni la pone en pendiente.

Cada unidad lleva `bloque` con el `id` de su bloque. Un campo en `null` es «sin captura», nunca un cero inventado. Si todavía no hay ingresos o meta, déjalos en `null`.

`ultima_actualizacion` acepta fecha (`2026-10-22`) o fecha con hora del centro de México (`2026-10-21T22:00:00-06:00`). México no cambia de horario: el desfase es `-06:00`.

Cada unidad lleva insumos. `null` es «sin captura». `0` es un cero real (Tepetatal y La Mancha tienen ingresos 2024 en 0, no vacío).

`dato_anterior` es opcional. Es una lista de claves cuyo número **no** vino en la corrida y se dejó el valor previo. Hoy solo se usa en `ingresos_2026` y `venta`. La página pone un asterisco y el texto «Dato anterior». No lo uses en un campo `null`: eso ya se muestra como pendiente de captura. Si la corrida trajo el dato, omite la clave (o el arreglo entero).

```json
"dato_anterior": ["ingresos_2026"]
```

| JSON | Columna en Notion |
| --- | --- |
| `unidad` | Unidad |
| `bloque` | Id del bloque (`fit`, `fit-go`, `alcaldias`) |
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

No pongas en el archivo avance, crecimientos, % de venta ni el resto de fórmulas. Si un insumo que hoy está en `null` se llena en todas o en alguna unidad, la columna aparece sola en la tabla. `gastos_sin_inversion` se conserva porque así llega de KPI Guy, y la página no lo muestra.

## Formato de `data/historico.json`

Enero a septiembre de 2026, solo unidades Fit. Octubre no va aquí: sigue saliendo de `kpis.json`. La clave de cada unidad es el mismo `unidad` que en `kpis.json` (por ejemplo `Casa Blanca`, no un alias). `null` es «Sin dato». `0` es un cero capturado. Los porcentajes van en puntos (`85.2` = 85.2%). `fuentes` y `notas` se guardan para trazabilidad y la página no las pinta. En particular no usa `notas.conversion_estimada`.

```json
{
  "fuentes": {},
  "notas": {},
  "meses": {
    "2026-01": {
      "Coapa": {
        "ingreso": null,
        "meta": null,
        "usuarios_activos": null,
        "altas": null,
        "bajas": null,
        "altas_netas": null,
        "domiciliado": null,
        "tasa_retencion": null,
        "tasa_cancelacion": null,
        "ticket_promedio": null,
        "inversion": null,
        "alcance": null,
        "conversaciones": null,
        "conversion": null
      }
    }
  }
}
```

`costo_conversacion`, si viniera en el archivo, no se lee: el costo se recalcula.

El orden del arreglo es el de la tabla de Notion y sirve de desempate al ordenar.

## Actualización dos veces al día

La fuente de ingresos 2026 y venta es el envío de KPI Guy, no Notion. Alrededor de las **7:30 a. m.** y las **8:30 p. m.**, hora del centro de México, se actualizan esos dos campos. Las metas no se tocan salvo que el envío las cambie.

1. Edita `ingresos_2026` y, si el bloque tiene `aplica_venta: true`, `venta` de las unidades que sí vengan en la corrida.
2. Si un campo con número no viene, conserva el valor anterior y agrégalo a `dato_anterior`. No escribas `0`.
3. Si la venta sigue vacía y el bloque sí la usa, déjala en `null` y no la pongas en `dato_anterior`. Si `aplica_venta` es `false`, no captures venta.
4. Cambia `ultima_actualizacion`, por ejemplo `2026-10-21T22:00:00-06:00`.
5. Si cambia el rango, ajusta `periodo` y `corte` (por ejemplo `01/10/2026-21/10/2026`).
6. Haz commit y push a `main`. No hay build. Recarga el sitio; la página pide el JSON sin caché.

El histórico de enero a septiembre no entra en esa corrida. Si cambia, se edita `data/historico.json`.

## Verlo en local

Hace falta un servidor: el navegador no puede leer el JSON si abres el HTML como archivo.

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## GitHub Pages

El sitio está en la raíz del repositorio (`index.html`) y lleva `.nojekyll` para que Pages no lo procese con Jekyll.

Pages publica la rama `main`, carpeta `/`. La URL es `https://thethundermikhe.github.io/KPIS-Fitintegra/`. No hace falta workflow ni paso de build. Un cambio en `main` se ve al terminar el despliegue de Pages.
