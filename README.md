# 📈 Stock Market Analysis API

API REST desarrollada con FastAPI para el análisis técnico de acciones, incluyendo indicadores como SMA, RSI y MACD, junto con visualización de datos.

# 🚀 Descripción

Este proyecto permite obtener datos históricos del mercado de valores y aplicar análisis técnico de forma automática.

Está pensado como una herramienta para:

Traders principiantes
Estudiantes de finanzas
Desarrolladores interesados en datos financieros

# 🧰 Tecnologías utilizadas
Python
FastAPI
Pandas
yfinance
JavaScript (frontend)
HTML/CSS

# 📊 Funcionalidades

📥 Descarga de datos históricos de acciones

📈 Cálculo de indicadores técnicos:
SMA (Simple Moving Average)
RSI (Relative Strength Index)
MACD (Moving Average Convergence Divergence)

📉 Visualización de datos en gráficos interactivos

🌐 API REST reutilizable

📡 Endpoints principales
Método	Endpoint	Descripción
GET	/api/data/{symbol}	Obtiene datos históricos
GET	/api/indicators/{symbol}	Calcula indicadores técnicos

# ▶️ Cómo ejecutar el proyecto

1. Clonar repositorio
git clone https://github.com/TU_USUARIO/acciones_bolsa.git
cd acciones_bolsa

2. Crear entorno virtual
python -m venv venv

Activar:

Windows:
venv\Scripts\activate
Mac/Linux:
source venv/bin/activate

3. Instalar dependencias
pip install -r backend/requirements.txt

4. Ejecutar la API
uvicorn backend.main:app --reload

5. Acceder a la documentación

FastAPI genera documentación automática:

👉 http://127.0.0.1:8000/docs

📷 Preview

(screenshot)

# 📁 Estructura del proyecto
acciones_bolsa/
│
├── backend/
│   ├── main.py
│   ├── indicators.py
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   └── app.js
│
├── data/
│
└── README.md

# ⚠️ Notas importantes
No se incluyen claves API privadas
Los datos se obtienen mediante yfinance
El proyecto está orientado a fines educativos y de portfolio

# 🌟 Posibles mejoras futuras
Autenticación de usuarios
Cacheo de datos para mejorar rendimiento
Deploy en la nube (Render / Railway)
Tests automatizados
Dockerización

# 👨‍💻 Autor

Álvaro Márquez-Villarejo Condés
https://www.linkedin.com/in/alvaromarquezvillarejo
https://github.com/alvaromarquezvillarejo
