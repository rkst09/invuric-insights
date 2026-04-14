class ExternalServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 502, error_code: str = "external_service_error"):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code


class LLMServiceError(ExternalServiceError):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail, status_code=status_code, error_code="llm_service_error")


class StorageServiceError(ExternalServiceError):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail, status_code=status_code, error_code="storage_service_error")
