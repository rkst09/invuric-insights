from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str | None = None
    # claude-sonnet-4-6 is the current Sonnet 4.6 model (supports up to 64K output tokens).
    # Switch to claude-opus-4-6 for the most complex documents (PRD/FRD) if budget allows —
    # Opus 4.6 has a 32K output token limit and higher instruction-following accuracy.
    anthropic_model: str = "claude-sonnet-4-6"
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    environment: str = "development"
    max_file_size_mb: int = 50
    allowed_origins: str = "http://localhost:5173,http://localhost:4173,https://invuric-insights.vercel.app"
    allowed_hosts: str = "localhost,127.0.0.1,testserver,*.onrender.com,*.vercel.app"
    request_log_level: str = "INFO"
    rate_limit_window_seconds: int = 60
    rate_limit_uploads_per_window: int = 12
    rate_limit_generations_per_window: int = 24
    llm_request_timeout_seconds: int = 300
    # 16K tokens accommodates the largest schemas (PRD: 8 features + 10 edge cases +
    # 5 personas + 4 flows + 10 NFRs). Per-pipeline overrides in each pipeline file
    # set tighter budgets where appropriate.
    llm_json_max_tokens: int = 16000
    llm_text_max_tokens: int = 4000
    # 3 repair attempts: attempt 0 (original) + 2 repairs. Increasing beyond 3
    # is rarely useful — if two repairs fail the prompt/schema is the root cause.
    llm_max_validation_repairs: int = 3

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @property
    def llm_api_key(self) -> str:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY must be configured.")
        return self.anthropic_api_key


settings = Settings()
