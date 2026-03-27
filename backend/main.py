"""
main.py — Servidor FastAPI para seguimiento de acciones bursátiles.

Expone un endpoint GET /api/stock/{ticker} que descarga datos históricos
de Yahoo Finance, calcula indicadores técnicos (SMA, RSI, MACD) y
devuelve un JSON estructurado listo para graficar en el frontend.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import cast

import yfinance as yf
import pandas as pd
from ta.trend import SMAIndicator, MACD
from ta.momentum import RSIIndicator

# ──────────────────────────────────────────────
# Configuración de la aplicación
# ──────────────────────────────────────────────
app = FastAPI(
    title="Stock Tracker API",
    version="1.0.0",
    description="API de análisis técnico de acciones bursátiles",
)

# CORS: permitir cualquier origen en entorno local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Endpoint principal
# ──────────────────────────────────────────────
@app.get("/api/stock/{ticker}")
def get_stock_data(
    ticker: str,
    start_date: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    end_date: str = Query(..., description="Fecha fin YYYY-MM-DD"),
):
    """
    Descarga el histórico de *ticker* entre *start_date* y *end_date*,
    calcula indicadores técnicos y devuelve la respuesta en JSON.
    """

    # 1. Descargar datos de Yahoo Finance
    ticker = ticker.upper().strip()
    try:
        df = cast(pd.DataFrame, yf.download(
            ticker,
            start=start_date,
            end=end_date,
            auto_adjust=True,
            progress=False,
        ))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error al contactar con Yahoo Finance: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontraron datos para '{ticker}' en el rango proporcionado.",
        )

    # Si yfinance devuelve MultiIndex de columnas (cuando se pide un solo ticker
    # con versiones recientes), aplanar las columnas.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # 2. Calcular indicadores técnicos con ta
    close = df["Close"]

    df["SMA_8"] = SMAIndicator(close=close, window=8, fillna=False).sma_indicator()
    df["SMA_20"] = SMAIndicator(close=close, window=20, fillna=False).sma_indicator()
    df["SMA_50"] = SMAIndicator(close=close, window=50, fillna=False).sma_indicator()
    df["SMA_200"] = SMAIndicator(close=close, window=200, fillna=False).sma_indicator()

    df["RSI_14"] = RSIIndicator(close=close, window=14, fillna=False).rsi()

    _macd = MACD(close=close, window_slow=26, window_fast=12, window_sign=9, fillna=False)
    df["MACD"] = _macd.macd()
    df["MACD_Signal"] = _macd.macd_signal()
    df["MACD_Hist"] = _macd.macd_diff()

    # 4. Construir respuesta JSON
    dt_index = pd.DatetimeIndex(df.index)
    dates = dt_index.strftime("%Y-%m-%d").tolist()

    def safe_list(series: pd.Series) -> list:
        """Convierte una serie a lista reemplazando NaN por None."""
        return [None if v is None or (isinstance(v, float) and pd.isna(v)) else round(v, 4) for v in series]

    # Guardo a fichero el dataframe completo para depuración (opcional)
    df.to_csv(f"../data/{ticker}_{start_date}_{end_date}.csv")
    # Guardo la búsqueda a fichero para depuración (opcional)
    with open(f"../data/busquedas.csv",
                "a", encoding="utf-8") as f:
            f.write(f"Ticker: {ticker}, Start Date: {start_date}, End Date: {end_date}\n")

    response = {
        "ticker": ticker,
        "dates": dates,
        "open": safe_list(df["Open"]),
        "high": safe_list(df["High"]),
        "low": safe_list(df["Low"]),
        "close": safe_list(df["Close"]),
        "volume": safe_list(df["Volume"]),
        "sma_8": safe_list(df["SMA_8"]),
        "sma_20": safe_list(df["SMA_20"]),
        "sma_50": safe_list(df["SMA_50"]),
        "sma_200": safe_list(df["SMA_200"]),
        "rsi_14": safe_list(df["RSI_14"]),
        "macd": safe_list(df["MACD"]),
        "macd_signal": safe_list(df["MACD_Signal"]),
        "macd_hist": safe_list(df["MACD_Hist"]),
    }

    return response
