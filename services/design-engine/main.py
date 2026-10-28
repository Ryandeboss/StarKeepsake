from fastapi import FastAPI

app = FastAPI(title="StarKeepsake Design Engine")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "design-engine", "status": "healthy"}

