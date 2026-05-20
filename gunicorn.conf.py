# Gunicorn configuration — production server
# Run with: gunicorn main:app -c gunicorn.conf.py

import multiprocessing

# Number of worker processes
# Rule of thumb: (2 × CPU cores) + 1
workers = multiprocessing.cpu_count() * 2 + 1

# Use uvicorn workers so FastAPI async features still work
worker_class = "uvicorn.workers.UvicornWorker"

# Bind to all interfaces on port 8000
bind = "0.0.0.0:8000"

# Timeouts
timeout = 120          # kill workers that take longer than 120s
keepalive = 5          # reuse connections for 5s (reduces overhead)
graceful_timeout = 30  # give workers 30s to finish before force-kill

# Logging
accesslog = "-"        # stdout
errorlog  = "-"        # stdout
loglevel  = "info"

# Restart workers after this many requests (prevents memory leaks)
max_requests = 1000
max_requests_jitter = 100
