# Arquitectura de BorjaAI

## Inventario del proyecto inicial

El repositorio original era una pagina HTML estatica de 973 lineas. Incluia un dashboard visual de patrimonio, grafico, anillo de salud, distribucion, Coach y tarjetas de activos. No tenia persistencia, importacion, navegacion funcional, autenticacion, backend, base de datos ni integracion de IA.

Se conservan y evolucionan sus decisiones de interfaz: fondo oscuro, acento rojo, jerarquia de patrimonio y Coach visible. La primera entrega añade navegacion, calculos, persistencia local, movimientos, gastos, cartera, objetivos, importacion CSV con revision y chat contextual.

## Principio de arquitectura

La base de datos es la fuente de verdad. El motor de analisis y la IA solo leen datos estructurados y devuelven analisis, nunca modifican dinero, movimientos ni cartera de forma directa.

```text
Web responsive
    |
    v
API autenticada ----> PostgreSQL (fuente de verdad)
    |                       |
    |                       +--> snapshots, auditoria e importaciones
    |
    +--> servicio de importacion --> cola de trabajos --> OCR / PDF / XLSX
    |
    +--> motor financiero -------> metricas y reglas explicables
    |
    +--> orquestador IA ---------> modelo IA y datos de mercado
```

## Implementacion actual

La version publicada en GitHub Pages es un cliente estatico para validar el producto:

- `index.html`: estructura accesible de la aplicacion.
- `styles.css`: sistema visual responsive.
- `app.js`: store local, reglas financieras, vistas, importacion CSV y Coach contextual.
- `localStorage`: persistencia por navegador para no exponer datos a terceros durante la fase de interfaz.

No se almacenan claves ni documentos subidos. CSV se procesa localmente en el navegador. PDF, XLSX e imagenes se aceptan en el flujo y quedan reservados para el importador de servidor; no se finge OCR ni extraccion que esta version no puede hacer de forma segura.

## Backend objetivo

Para el MVP conectado se recomienda una API REST tipada con FastAPI o NestJS, PostgreSQL, almacenamiento privado compatible con S3 y una cola de trabajos. El frontend puede migrar progresivamente a Next.js o mantenerse como cliente separado sin cambiar los contratos.

Responsabilidades:

- API: autentica al usuario, valida todas las entradas y aplica autorizacion por `user_id`.
- Base de datos: movimientos, cuentas, activos, pasivos, objetivos, importaciones y auditoria.
- Importador: guarda el archivo en una zona privada, extrae candidatos, registra confianza y nunca confirma por si mismo.
- Motor financiero: calcula patrimonio, ahorro, salud, liquidez, concentracion y alertas reproducibles.
- IA: recibe un resumen financiero minimizado y respuestas de las herramientas del motor; nunca recibe secretos ni decide operaciones automaticamente.

## Servicios externos que necesitaremos

- IA: un proveedor con API de respuestas y llamadas a herramientas, invocado solo desde backend mediante variables de entorno.
- OCR: proveedor de OCR/document intelligence para capturas y extractos escaneados.
- PDF y XLSX: parser en worker aislado, con antivirus, limites de tamano y bloqueo de archivos con macros.
- Mercado: proveedor de cotizaciones historicas y actuales con simbolos normalizados, cache y trazabilidad de la fecha de cada precio.
- Email o push: solo para alertas relevantes y con consentimiento explicito.

La eleccion final de proveedores se hara al definir presupuesto, paises soportados, cobertura de activos y requisitos RGPD. Todas esas integraciones se ocultan tras adaptadores para poder sustituirlas.

## Fases

1. MVP local: dashboard calculado, movimientos, categorias, gastos, patrimonio, inversiones, objetivos, importacion CSV con revision, historial reversible y Coach basado en datos.
2. Servicio seguro: cuentas, PostgreSQL, importador de PDF/XLSX/imagenes, OCR y Coach con proveedor IA.
3. Inteligencia: recomendacion diaria con datos de mercado, simulador, alertas y objetivos avanzados.
4. Conectores: bancos, brokers, exchanges, inmuebles, hipotecas y sincronizacion automatica.

## Seguridad desde el inicio

- Cada consulta de datos se filtra por usuario autenticado en servidor.
- Secretos en variables de entorno; nunca en JavaScript cliente.
- Cifrado en transito y en reposo, registros de auditoria y borrado exportable.
- Archivos en almacenamiento privado con escaneo, limite de tamano, lista de tipos permitidos y urls temporales.
- El modelo IA recibe solo el contexto necesario; sus respuestas incluyen datos de origen, fecha y limitaciones.
