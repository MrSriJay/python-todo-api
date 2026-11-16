from app.config import normalize_database_url


def test_postgresql_url_uses_psycopg_driver() -> None:
    assert (
        normalize_database_url("postgresql://todo:todo@localhost:5432/todo")
        == "postgresql+psycopg://todo:todo@localhost:5432/todo"
    )
    assert (
        normalize_database_url("postgres://todo:todo@localhost/todo")
        == "postgresql+psycopg://todo:todo@localhost/todo"
    )


def test_sqlite_url_is_unchanged() -> None:
    assert normalize_database_url("sqlite:///./todo.db") == "sqlite:///./todo.db"
    assert (
        normalize_database_url("postgresql+psycopg://todo:todo@localhost/todo")
        == "postgresql+psycopg://todo:todo@localhost/todo"
    )
