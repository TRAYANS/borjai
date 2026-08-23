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

## Versiones

- V.1.0: base visual estatica.
- V.1.1: dashboard calculado, movimientos, categorias, gastos, patrimonio, inversiones, objetivos, importacion CSV con revision, historial reversible y Coach basado en datos locales.
- V.1.2: backend y persistencia real preparados con Supabase/PostgreSQL, repositorios, migracion segura desde `localStorage`, RLS multiusuario y `financialContext` para IA futura. La interfaz sigue siendo la misma app estatica.
- V.1.3: mejora del motor financiero, categorias, transferencias y analisis de gastos mas profundo.
- V.2.0: IA real, documentos, mercado, conectores bancarios y patrimonio avanzado.

## V.1.2 Backend y persistencia real

La arquitectura aprobada mantiene GitHub Pages como frontend y usa Supabase como backend gestionado:

```text
app.js
    |
    v
src/api/financialApi.js
    |
    v
Repository
    |------------------------|
    v                        v
SupabaseRepository      LocalStorageRepository
    |                        |
    v                        v
PostgreSQL + RLS        borjai:mvp:v1 fallback
```

`app.js` no accede directamente a Supabase. La UI llama a `financialApi`, `financialApi` decide el repositorio activo y los repositorios traducen el estado de BorjaAI a almacenamiento.

El motor financiero se mantiene puro:

```text
Datos normalizados
    |
    v
src/finance.js
    |
    v
metricas, salud, patrimonio, recomendacion
```

No conoce `localStorage`, Supabase, SQL, autenticacion ni red.

### Supabase

El esquema inicial vive en `src/db/schema.sql` y se replica en `src/db/migrations/001_initial_schema.sql`.

Tablas iniciales:

- `accounts`
- `categories`
- `transactions`
- `assets`
- `liabilities`
- `investments`
- `goals`
- `imports`
- `wealth_snapshots`

Todas las entidades financieras tienen `user_id` y Row Level Security. Las politicas permiten `select`, `insert`, `update` y `delete` solo cuando `auth.uid() = user_id`. `categories` permite lectura de categorias globales con `user_id is null`, pero las categorias de usuario siguen protegidas.

El esquema deja preparados tipos como `transfer`, `real_estate` y `mortgage`, pero V.1.2 no implementa vivienda, hipoteca, OCR, mercado ni IA externa.

### Configuracion publica

GitHub Pages puede cargar configuracion publica desde `window.BORJAI_CONFIG` antes de `app.js`:

```html
<script>
  window.BORJAI_CONFIG = {
    supabaseUrl: "https://TU-PROYECTO.supabase.co",
    supabaseAnonKey: "TU_ANON_KEY_PUBLICA"
  };
</script>
```

La anon key de Supabase puede estar en cliente si RLS esta bien configurado. Nunca deben incluirse `service_role`, claves privadas, claves de IA ni claves privadas de APIs de mercado en el frontend.

Si no hay configuracion o no hay sesion valida, BorjaAI cae a modo local y conserva los datos en `borjai:mvp:v1`.

### Migracion desde localStorage

La migracion parte de `borjai:mvp:v1` y es defensiva:

1. Lee el estado local.
2. Valida version, colecciones principales y movimientos.
3. Guarda una copia en `borjai:mvp:v1:backup:v1.2`.
4. Normaliza entidades y elimina duplicados por `legacy_id`.
5. Inserta datos bajo el `user_id` autenticado.
6. Recarga desde Supabase y compara conteos.
7. Guarda el resultado en `borjai:migration:v1.2:status`.

El estado local original no se borra. Si el backend falla, la app sigue en modo local.

## Seguridad desde el inicio

- Cada consulta de datos se filtra por usuario autenticado en servidor.
- Secretos en variables de entorno; nunca en JavaScript cliente.
- Cifrado en transito y en reposo, registros de auditoria y borrado exportable.
- Archivos en almacenamiento privado con escaneo, limite de tamano, lista de tipos permitidos y urls temporales.
- El modelo IA recibe solo el contexto necesario; sus respuestas incluyen datos de origen, fecha y limitaciones.
