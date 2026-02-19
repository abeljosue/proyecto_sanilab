---
name: RPSoft Time Tracking Blueprint
description: Blueprint completo para replicar el proyecto de Control de Horarios. Incluye esquema de BD, lógica de negocio y arquitectura UI.
---

# RPSoft Time Tracking Blueprint

Esta skill define la arquitectura estándar para construir aplicaciones de Control de Horario/Asistencia basadas en el "Modelo RPSoft Sprint 0".

## 1. Stack Tecnológico
-   **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide React.
-   **Backend**: Supabase (Auth, Postgres, Realtime).
-   **Estado**: React Context (`AuthContext`) + Estado local.

## 2. Esquema de Base de Datos (Supabase)

### Tablas Principales

#### `profiles` (Extension de Auth)
Almacena datos públicos del usuario.
-   `id`: uuid (FK -> auth.users.id)
-   `full_name`: text
-   `avatar_url`: text
-   `role`: text (default 'user')
-   **Trigger**: `on_auth_user_created` -> llama a `public.handle_new_user()` para crear perfil automático.

#### `work_sessions` (Core)
Registra las jornadas laborales.
-   `id`: uuid (PK)
-   `user_id`: uuid (FK -> profiles.id/auth.users.id)
-   `start_time`: timestamptz (NOT NULL)
-   `end_time`: timestamptz (Nullable)
-   `pause_time`: timestamptz (Nullable - marca la última pausa)
-   `status`: text ('working' | 'paused' | 'finished')
-   **Constraints**: `check (end_time > start_time)`
-   **Indexes**: `user_id`, `created_at` (desc)

### Políticas de Seguridad (RLS)
-   **Profiles**:
    -   SELECT: Público.
    -   INSERT/UPDATE: Solo el propio usuario (`auth.uid() = id`).
-   **Work Sessions**:
    -   SELECT/INSERT/UPDATE: Solo el propio usuario (`auth.uid() = user_id`).

## 3. Lógica de Negocio (State Machine)

El flujo de una sesión de trabajo sigue estos estados:

1.  **Idle/Ready** (`currentSession === null`)
    -   Acción: **Iniciar** -> INSERT en `work_sessions` (`status: 'working'`, `start_time: now()`).
2.  **Working** (`status === 'working'`)
    -   Acción: **Pausar** -> UPDATE (`status: 'paused'`, `pause_time: now()`).
    -   Acción: **Finalizar** -> UPDATE (`status: 'finished'`, `end_time: now()`).
3.  **Paused** (`status === 'paused'`)
    -   Acción: **Reanudar** -> UPDATE (`status: 'working'`).
    -   Acción: **Finalizar** -> UPDATE (`status: 'finished'`, `end_time: now()`).

## 4. Arquitectura UI

### Estructura de Carpetas
```
/app
  /auth
    /login
    /signup
  /dashboard (o root /)
/components
  /dashboard
    Timer.tsx       (Reloj en tiempo real)
    StatusBadge.tsx (Indicador visual de estado)
    Controls.tsx    (Botones de acción según estado)
    StatCard.tsx    (Tarjetas de info: Inicio, Pausa)
  History.tsx       (Tabla de historial)
/contexts
  AuthContext.tsx   (Manejo de sesión y usuario)
/hooks
  useTimer.ts       (Opcional: lógica del reloj)
```

### Componentes Clave

-   **Dashboard Container**: Gestiona el estado `currentSession` (fetching inicial y actualizaciones optimistas o post-mutación).
-   **Timer**: Debe manejar su propio `setInterval` y evitar "hydration mismatches" (usando `useEffect` para iniciar en cliente).

## 5. Mejores Prácticas Aplicadas
-   **Tipado Estricto**: No usar `any`. Interfaces definidas en `/types/index.ts`.
-   **Manejo de Errores**: UI Feedback para errores de Supabase (Toast o Alertas).
-   **Performance**: Índices de DB y componentes de cliente ligeros.
