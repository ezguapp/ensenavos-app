const API_URL = "http://localhost:8000/api";

export async function createSession() {
  const response = await fetch(`${API_URL}/sessions/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      duration_seconds: 0,
      translations_count: 0,
    }),
  });

  if (!response.ok) {
    throw new Error("Error al crear la sesión");
  }

  return await response.json();
}

export async function saveTranslation(sessionId, text, confidence = 1) {
  const response = await fetch(`${API_URL}/translations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: sessionId,
      text: text,
      confidence: confidence,
    }),
  });

  if (!response.ok) {
    throw new Error("Error al guardar la traducción");
  }

  return await response.json();
}

export async function saveFeedback(sessionId, rating) {
  const response = await fetch(`${API_URL}/feedback/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: sessionId,
      rating: rating,
    }),
  });

  if (!response.ok) {
    throw new Error("Error al guardar el feedback");
  }

  return await response.json();
}