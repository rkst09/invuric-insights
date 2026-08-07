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
    libreoffice_binary: str | None = None
    environment: str = "development"
    storage_backend: str = "auto"
    public_backend_url: str = "http://localhost:8000"
    max_file_size_mb: int = 50
    allowed_origins: str = "http://localhost:5173,http://localhost:4173,https://invuric-insights.vercel.app"
    allowed_hosts: str = "localhost,127.0.0.1,testserver,*.onrender.com,*.vercel.app"
    # Only Microsoft/Outlook accounts on these domains may authenticate. Enforced in
    # auth.py independently of the profiles/org_id linkage, so it can't be bypassed by
    # an unexpected profile row.
    allowed_email_domains: str = "invuric.co"
    # DANGER: bypasses all authentication with a fake local user. Local/dev testing
    # only - main.py refuses to start with this on when environment=production.
    dev_bypass_auth: bool = False
    # TEMPORARY: pauses Microsoft/Azure login enforcement in ALL environments,
    # including production, per explicit decision on 2026-08-07 to ship without the
    # Azure app registration configured yet. Unlike dev_bypass_auth, this is allowed
    # to run in production. Set AUTH_PAUSED=false (or flip the default here) once
    # Microsoft sign-in is ready to re-enable real authentication.
    auth_paused: bool = True
    request_log_level: str = "INFO"
    rate_limit_window_seconds: int = 60
    rate_limit_uploads_per_window: int = 12
    rate_limit_generations_per_window: int = 24
    external_request_max_attempts: int = 3
    external_request_retry_delay_seconds: float = 1.0
    llm_request_timeout_seconds: int = 300
    generation_model_timeout_seconds: int = 180
    document_model_timeout_seconds: int = 60
    raid_model_timeout_seconds: int = 60
    backlog_model_timeout_seconds: int = 60
    wbs_model_timeout_seconds: int = 60
    generation_input_max_chars: int = 30000
    generation_template_max_chars: int = 8000
    # 16K tokens accommodates the largest schemas (PRD: 8 features + 10 edge cases +
    # 5 personas + 4 flows + 10 NFRs). Per-pipeline overrides in each pipeline file
    # set tighter budgets where appropriate.
    llm_json_max_tokens: int = 16000
    llm_text_max_tokens: int = 4000
    # 3 repair attempts: attempt 0 (original) + 2 repairs. Increasing beyond 3
    # is rarely useful — if two repairs fail the prompt/schema is the root cause.
    llm_max_validation_repairs: int = 3
    # Vision (Backlog/User Stories only) — lets Claude see uploaded screens/PDF
    # pages instead of just their extracted text. Capped to control cost/latency;
    # images are NOT redacted (redaction only operates on text), so this is an
    # accepted risk documented in the upload UI.
    backlog_vision_max_images: int = 6
    backlog_vision_max_pdf_pages_each: int = 6
    backlog_vision_max_image_dimension: int = 1568

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
    def allowed_email_domains_list(self) -> list[str]:
        return [domain.strip().lower() for domain in self.allowed_email_domains.split(",") if domain.strip()]

    @property
    def llm_api_key(self) -> str:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY must be configured.")
        return self.anthropic_api_key


settings = Settings()
