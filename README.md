# Certificate Management Tool (CMT) v2.0

Una aplicación web full-stack diseñada para automatizar y centralizar la gestión de certificados SSL/TLS en una infraestructura F5 BIG-IP.

## ✨ Características Principales

- **Dashboard Centralizado:** Visualización del estado de todos los certificados, ordenados por fecha de expiración.
- **Monitorización Proactiva:** Alertas visuales para certificados próximos a expirar.
- **Generador de PFX:** Herramienta integrada para crear archivos PFX a partir de .crt, .key y cadenas de certificados.
- **Asistente de Renovación:** Un wizard guiado para simplificar y automatizar el proceso de renovación de certificados en los dispositivos F5.
- **Gestión de Dispositivos:** Interfaz para añadir, eliminar y gestionar las credenciales de los F5s.
- **Seguridad RBAC:** Control de Acceso Basado en Roles (Admin, Operator, Viewer) para proteger las funcionalidades.

## 🚀 Stack Tecnológico

- **Backend:** Python con FastAPI
- **Frontend:** JavaScript con React (usando Vite) y Material-UI
- **Base de Datos:** PostgreSQL (o la que uses)
- **Contenerización:** Docker y Docker Compose

## ⚙️ Cómo Poner en Marcha el Proyecto

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/marqdomi/certificate-manager-v2.git
    cd certificate-manager-v2
    ```

2.  **Configurar las variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto a partir del archivo de ejemplo `.env.example`.
    ```bash
    cp .env.example .env
    ```
    Luego, edita el archivo `.env` con tus credenciales de base de datos y la clave de encriptación.

3.  **Levantar los contenedores:**
    Este comando construirá las imágenes y levantará todos los servicios (frontend, backend, worker, beat, db, redis).
    ```bash
    docker-compose up --build
    ```

4.  **Acceder a la aplicación:**
    - Frontend: `http://localhost:5173`
    - Backend API Docs: `http://localhost:8000/docs`
