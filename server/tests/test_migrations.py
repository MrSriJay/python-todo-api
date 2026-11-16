from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.database import create_db_engine
from app.models import User, utcnow
from app.schemas import TodoCreate
from app.security import decrypt_text, hash_passcode
from app.services.todos import TodoService
from sqlalchemy.orm import sessionmaker

SERVER_ROOT = Path(__file__).resolve().parents[1]


def test_alembic_upgrade_and_downgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(SERVER_ROOT)
    url = "sqlite:///" + (tmp_path / "migrated.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url)

    config = Config(str(SERVER_ROOT / "alembic.ini"))
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_db_engine(url)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        user = User(
            name="Ada",
            email="ada@example.com",
            passcode_hash=hash_passcode("123456"),
            created_at=utcnow(),
        )
        session.add(user)
        session.commit()
        created = TodoService(session).create_todo(user, TodoCreate(title="migrated"))
        assert created.id == 1
        assert created.done is False
        assert decrypt_text(created.title) == "migrated"
        assert created.title != "migrated"
    finally:
        session.close()
        engine.dispose()
