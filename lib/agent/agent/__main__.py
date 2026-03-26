"""``python -m agent`` -> CLI."""

from __future__ import annotations

import sys

from agent.run import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
