"""Unit tests for PeekClient HTTP client."""

import json
from datetime import datetime
from unittest.mock import Mock, patch

import pytest

from peekview.client import PeekClient, RemoteEntry, RemoteFile
from peekview.exceptions import NotFoundError, PeekError


class TestPeekClient:
    """Test PeekClient HTTP client."""

    def test_init_default(self):
        """Test client initialization with default values."""
        client = PeekClient("https://example.com")

        assert client.base_url == "https://example.com"
        assert client.timeout == 30
        assert client.verify is True
        assert client.headers == {}

    def test_init_with_api_key(self):
        """Test client initialization with API key."""
        client = PeekClient("https://example.com", api_key="sk-xxx")

        assert client.headers == {"X-API-Key": "sk-xxx", "Authorization": "Bearer sk-xxx"}

    def test_init_with_options(self):
        """Test client initialization with all options."""
        client = PeekClient(
            "https://example.com/",  # Trailing slash should be stripped
            api_key="sk-xxx",
            timeout=60,
            verify_ssl=False,
        )

        assert client.base_url == "https://example.com"
        assert client.timeout == 60
        assert client.verify is False

    def test_parse_entry_success(self):
        """Test parsing valid entry response."""
        client = PeekClient("https://example.com")

        data = {
            "id": 1,
            "slug": "test-entry",
            "summary": "Test summary",
            "status": "active",
            "tags": ["python", "cli"],
            "files": [
                {
                    "id": 1,
                    "path": "src/main.py",
                    "filename": "main.py",
                    "language": "python",
                    "is_binary": False,
                    "size": 100,
                    "line_count": 10,
                }
            ],
            "created_at": "2026-05-16T10:00:00",
            "updated_at": "2026-05-16T10:00:00",
            "expires_at": None,
        }

        entry = client._parse_entry(data)

        assert isinstance(entry, RemoteEntry)
        assert entry.id == 1
        assert entry.slug == "test-entry"
        assert entry.url == "https://example.com/test-entry"
        assert entry.summary == "Test summary"
        assert entry.status == "active"
        assert entry.tags == ["python", "cli"]
        assert len(entry.files) == 1
        assert isinstance(entry.files[0], RemoteFile)
        assert entry.files[0].filename == "main.py"
        assert isinstance(entry.created_at, datetime)

    def test_parse_entry_missing_slug(self):
        """Test parsing entry with missing slug raises error."""
        client = PeekClient("https://example.com")

        data = {"id": 1, "summary": "Test"}

        with pytest.raises(PeekError, match="missing 'slug' field"):
            client._parse_entry(data)

    def test_parse_entry_uses_server_url(self):
        """Test that server-returned URL is preferred."""
        client = PeekClient("https://example.com")

        data = {
            "id": 1,
            "slug": "test",
            "url": "https://custom.com/test",  # Server-returned URL
            "summary": "Test",
            "status": "active",
            "tags": [],
            "files": [],
            "created_at": "2026-05-16T10:00:00",
            "updated_at": None,
            "expires_at": None,
        }

        entry = client._parse_entry(data)
        assert entry.url == "https://custom.com/test"

    def test_parse_entry_fallback_url(self):
        """Test URL fallback when server doesn't return URL."""
        client = PeekClient("https://example.com")

        data = {
            "id": 1,
            "slug": "test",
            "summary": "Test",
            "status": "active",
            "tags": [],
            "files": [],
            "created_at": "2026-05-16T10:00:00",
            "updated_at": None,
            "expires_at": None,
        }
        # No "url" field

        entry = client._parse_entry(data)
        assert entry.url == "https://example.com/test"


class TestPeekClientRequests:
    """Test PeekClient HTTP requests."""

    @patch("peekview.client.requests.post")
    def test_create_entry_success(self, mock_post):
        """Test successful entry creation."""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": 1,
            "slug": "new-entry",
            "url": "https://example.com/new-entry",
            "summary": "Test entry",
            "status": "active",
            "tags": [],
            "files": [],
            "created_at": "2026-05-16T10:00:00",
            "updated_at": None,
            "expires_at": None,
        }
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com", api_key="sk-xxx")
        result = client.create_entry(
            summary="Test entry",
            slug="new-entry",
            files_data=[{"path": "test.py", "content": "print('hello')"}],
        )

        assert isinstance(result, RemoteEntry)
        assert result.slug == "new-entry"

        # Verify request
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "https://example.com/api/v1/entries"
        assert call_args[1]["headers"] == {"X-API-Key": "sk-xxx", "Authorization": "Bearer sk-xxx"}
        assert call_args[1]["timeout"] == 30
        assert call_args[1]["verify"] is True

    @patch("peekview.client.requests.post")
    def test_create_entry_401_error(self, mock_post):
        """Test entry creation with authentication error."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {
            "error": {"code": "UNAUTHORIZED", "message": "Invalid API key"}
        }
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="Authentication failed"):
            client.create_entry(summary="Test")

    @patch("peekview.client.requests.post")
    def test_create_entry_409_conflict(self, mock_post):
        """Test entry creation with slug conflict."""
        mock_response = Mock()
        mock_response.status_code = 409
        mock_response.json.return_value = {
            "error": {"code": "CONFLICT", "message": "Entry already exists"}
        }
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="already exists"):
            client.create_entry(summary="Test", slug="existing")

    @patch("peekview.client.requests.get")
    def test_list_entries_success(self, mock_get):
        """Test successful list entries."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "items": [
                {"id": 1, "slug": "entry-1", "summary": "First", "tags": [], "status": "active", "file_count": 1},
                {"id": 2, "slug": "entry-2", "summary": "Second", "tags": ["python"], "status": "active", "file_count": 2},
            ],
            "total": 2,
            "page": 1,
            "per_page": 20,
        }
        mock_get.return_value = mock_response

        client = PeekClient("https://example.com")
        result = client.list_entries(q="test", tags=["python"], page=1, per_page=10)

        assert result["total"] == 2
        assert len(result["items"]) == 2
        assert result["items"][0]["slug"] == "entry-1"

        # Verify request params
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert call_args[1]["params"]["q"] == "test"
        assert call_args[1]["params"]["tags"] == "python"
        assert call_args[1]["params"]["page"] == 1
        assert call_args[1]["params"]["per_page"] == 10

    @patch("peekview.client.requests.get")
    def test_get_entry_success(self, mock_get):
        """Test successful get entry."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": 1,
            "slug": "test-entry",
            "summary": "Test",
            "status": "active",
            "tags": [],
            "files": [],
            "created_at": "2026-05-16T10:00:00",
            "updated_at": None,
            "expires_at": None,
        }
        mock_get.return_value = mock_response

        client = PeekClient("https://example.com")
        result = client.get_entry("test-entry")

        assert isinstance(result, RemoteEntry)
        assert result.slug == "test-entry"

        mock_get.assert_called_once_with(
            "https://example.com/api/v1/entries/test-entry",
            headers={},
            timeout=30,
            verify=True,
        )

    @patch("peekview.client.requests.get")
    def test_get_entry_404(self, mock_get):
        """Test get entry not found."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(NotFoundError):
            client.get_entry("non-existent")

    @patch("peekview.client.requests.delete")
    def test_delete_entry_success(self, mock_delete):
        """Test successful delete entry."""
        mock_response = Mock()
        mock_response.status_code = 204
        mock_delete.return_value = mock_response

        client = PeekClient("https://example.com", api_key="sk-xxx")
        result = client.delete_entry("test-entry")

        assert result == {"ok": True}

        mock_delete.assert_called_once_with(
            "https://example.com/api/v1/entries/test-entry",
            headers={"X-API-Key": "sk-xxx", "Authorization": "Bearer sk-xxx"},
            timeout=30,
            verify=True,
        )

    @patch("peekview.client.requests.delete")
    def test_delete_entry_403(self, mock_delete):
        """Test delete entry permission denied."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.json.return_value = {"error": {"message": "Permission denied"}}
        mock_delete.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="Permission denied"):
            client.delete_entry("test-entry")


class TestPeekClientErrorHandling:
    """Test error handling."""

    @patch("peekview.client.requests.post")
    def test_handle_error_with_detail(self, mock_post):
        """Test error handling with detailed message."""
        mock_response = Mock()
        mock_response.status_code = 422
        mock_response.json.return_value = {
            "error": {"code": "VALIDATION_ERROR", "message": "Invalid slug format"}
        }
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="Invalid slug format"):
            client.create_entry(summary="Test")

    @patch("peekview.client.requests.post")
    def test_handle_error_without_detail(self, mock_post):
        """Test error handling without detail message."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {}
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="Server error"):
            client.create_entry(summary="Test")

    @patch("peekview.client.requests.post")
    def test_handle_error_invalid_json(self, mock_post):
        """Test error handling with invalid JSON response."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.side_effect = json.JSONDecodeError("test", "", 0)
        mock_post.return_value = mock_response

        client = PeekClient("https://example.com")

        with pytest.raises(PeekError, match="Server error"):
            client.create_entry(summary="Test")
