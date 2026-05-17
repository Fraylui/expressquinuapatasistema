# Interface Design System — Express Quinuapata VRAEM SAC

## Intent

**Who:** Operadores de transporte en ventanilla (Huamanga, Kimbiri, Pichari). Abriendo el sistema a las 6am antes del primer viaje. Cansados, con prisa, manejando efectivo real.

**What they must do:** Vender pasajes, registrar encomiendas, abrir y cerrar caja. Todo rápido, sin errores, sin confusión.

**How it should feel:** Denso como una terminal de trabajo. Serio como una caja registradora. Claro como un tablero de bus. NO amigable-app. NO startup. Herramienta profesional de campo.

---

## Domain

Producto: transporte interprovincial VRAEM (Huamanga-Kimbiri-Pichari-San Francisco)

Conceptos del dominio: ruta de montaña, altitud, trocha, bus saliendo de madrugada, encomienda atada con soga, ticket de cartón, caja de efectivo, manifiesto de pasajeros, cuaderno de control.

Color world: azul noche serrano (#1F3864), gris asfalto, blanco papel bond, rojo sellado, verde "libre", naranja "reservado".

Signature: sidebar azul oscuro noche (#1F3864) con secciones OPERACIÓN y GESTIÓN. El azul evoca uniformes de empresa de transporte, no tecnología.

---

## Tokens

```css
/* Surfaces */
--surface-base: #ffffff          /* canvas principal */
--surface-1: #f8f9fa             /* cards, panels */
--surface-2: #f1f3f5             /* inputs, hover suave */
--surface-sidebar: #1F3864       /* sidebar principal */

/* Text */
--text-primary: #111827          /* headings, labels importantes */
--text-secondary: #374151        /* body text normal */
--text-tertiary: #6B7280         /* metadata, subtítulos */
--text-muted: #9CA3AF            /* placeholders, disabled */
--text-sidebar: #ffffff          /* texto en sidebar */
--text-sidebar-muted: rgba(255,255,255,0.5)

/* Brand */
--brand-primary: #1F3864         /* azul nocturno — sidebar, botones primarios */
--brand-accent: #0070C0          /* azul brillante — acciones, links activos */

/* Semantic */
--success: #16a34a               /* asiento libre, caja cuadrada */
--warning: #d97706               /* asiento reservado, alerta */
--danger: #dc2626                /* asiento ocupado, error crítico */
--info: #2563eb                  /* informativo */

/* Borders */
--border-subtle: rgba(0,0,0,0.06)
--border-default: rgba(0,0,0,0.12)
--border-strong: rgba(0,0,0,0.20)
--border-sidebar: rgba(255,255,255,0.10)
```

---

## Typography

Fuente: **Inter** (system-ui fallback)

| Nivel      | Size  | Weight | Use |
|------------|-------|--------|-----|
| Page title | 20px  | 700    | h1 de sección |
| Section    | 14px  | 600    | subtítulos, labels de card |
| Body       | 14px  | 400    | texto general |
| Label      | 13px  | 500    | labels de formulario |
| Small      | 12px  | 400    | metadata, timestamps |
| Micro      | 11px  | 500    | badges, caps tracking |

Sidebar nav: 13px, weight 500, text-white/90 activo, text-white/50 inactivo.

---

## Spacing

Base unit: **4px**

| Token | Value | Use |
|-------|-------|-----|
| xs    | 4px   | gap entre icon y label |
| sm    | 8px   | padding interno de badges |
| md    | 12px  | padding botones, gap entre campos |
| lg    | 16px  | padding cards, secciones |
| xl    | 20px  | padding páginas |
| 2xl   | 24px  | separación entre secciones |

---

## Depth Strategy: Borders + Subtle Shadows

Herramienta de campo = sin excesos decorativos. Jerarquía con bordes, no sombras dramáticas.

- Cards: `border border-gray-200 shadow-sm` (shadow-sm = 0 1px 2px rgba(0,0,0,0.05))
- Modals: `shadow-xl` 
- Sidebar: borde derecho `border-r border-white/10`
- Inputs: `border border-gray-300`, hover `border-gray-400`, focus `ring-2 ring-primary-500`
- NO mezclar shadows dramáticas con borders en el mismo componente

---

## Border Radius

| Elemento | Radius |
|----------|--------|
| Botones, inputs | rounded-lg (8px) |
| Cards, panels | rounded-xl (12px) |
| Badges, pills | rounded-full |
| Modals | rounded-2xl (16px) |
| Avatar/icon containers | rounded-xl |

---

## Components

### Sidebar
- Width: 240px (w-60)
- Background: #1F3864 (bg-sidebar)
- Logo area: border-b border-white/10, py-5 px-5
- Nav sections: label ALL-CAPS text-white/40 text-xs tracking-widest
- Nav item active: bg-white/10 text-white font-medium
- Nav item inactive: text-white/60 hover:bg-white/5
- Item padding: px-3 py-2, rounded-lg, gap-3 icon+label
- Icon size: 17px

### Cards
- bg-white rounded-xl border border-gray-200 shadow-sm p-5
- Título: text-sm font-semibold text-gray-900
- Subtítulo: text-xs text-gray-500

### Buttons (primary)
- bg-primary-900 hover:bg-primary-800 text-white
- px-4 py-2 rounded-lg text-sm font-medium
- Loading: spinner + disabled opacity

### Buttons (secondary)
- bg-white border border-gray-300 text-gray-700
- hover:bg-gray-50

### Buttons (danger)
- bg-red-600 hover:bg-red-700 text-white

### Inputs
- w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
- focus: ring-2 ring-primary-500 border-transparent
- error: border-red-500

### Badges / Estado
- DISPONIBLE/Activo: bg-green-100 text-green-800
- RESERVADO/Pendiente: bg-yellow-100 text-yellow-800  
- OCUPADO/Cancelado: bg-red-100 text-red-800
- EN_TRANSITO: bg-blue-100 text-blue-800

### Table
- Header: bg-gray-50 text-xs uppercase text-gray-500 tracking-wider
- Row: border-b border-gray-100 hover:bg-gray-50
- Cell: px-4 py-3 text-sm text-gray-900

### KPI Cards (dashboard)
- Stat grande: text-2xl font-bold text-gray-900
- Label: text-xs text-gray-500 uppercase tracking-wide
- Icon container: w-10 h-10 rounded-xl bg-primary-100
- Trend: text-xs verde/rojo según dirección

---

## Iconography

Set: **Lucide React** — tamaño estándar 17px en nav, 20px en cards, 16px en botones.
NO mezclar con otros sets de iconos.

---

## Navigation Context

Header siempre visible: breadcrumb + nombre usuario + agencia + hora.
Sidebar siempre visible en desktop.
Mobile: responsive colapsado.

---

## Animation

Transiciones: duration-150 ease-in-out para hover/active.
NO spring/bounce.
Modal: fade + scale suave.
