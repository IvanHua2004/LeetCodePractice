"""Keep a local copy of the solutions repo up to date."""
from __future__ import annotations

import hashlib
import io
import pathlib
import re
import shutil
import subprocess
import tarfile
import urllib.request

from sync_constants import CACHE_DIR, DOWNLOAD_TIMEOUT_SECONDS, REPO_DIR


def fetch_repo(url: str) -> str:
    """Bring REPO_DIR up to date and return an identifier for the version fetched."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if shutil.which("git"):
        return _fetch_with_git(url)
    return _fetch_tarball(url)


def _git(*args: str) -> str:
    done = subprocess.run(["git", "-C", str(REPO_DIR), *args], check=True, capture_output=True, text=True)
    return done.stdout.strip()


def _fetch_with_git(url: str) -> str:
    try:
        _git("fetch", "--depth", "1", "-q", url, "HEAD")
        _git("reset", "-q", "--hard", "FETCH_HEAD")
    except (subprocess.CalledProcessError, OSError):
        # first run, or a broken clone: start over
        shutil.rmtree(REPO_DIR, ignore_errors=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", url, str(REPO_DIR)], check=True)
    return _git("rev-parse", "HEAD")


def _fetch_tarball(url: str) -> str:
    match = re.match(r"https://github\.com/([^/]+)/([^/.]+)", url)
    if not match:
        raise SystemExit("git isn't installed, so --repo must be a https://github.com/owner/name URL")
    owner, name = match[1], match[2]

    with urllib.request.urlopen(
        f"https://codeload.github.com/{owner}/{name}/tar.gz/HEAD", timeout=DOWNLOAD_TIMEOUT_SECONDS
    ) as response:
        data = response.read()

    shutil.rmtree(REPO_DIR, ignore_errors=True)
    REPO_DIR.mkdir(parents=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            # drop the top-level "<name>-<sha>/" folder; refuse anything escaping REPO_DIR
            parts = pathlib.PurePosixPath(member.name).parts[1:]
            if not parts or ".." in parts:
                continue
            target = REPO_DIR.joinpath(*parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
    return hashlib.sha1(data).hexdigest()
