"""
Management command: kill_idle_connections
-----------------------------------------
Kills all sleeping MySQL connections for the configured DB user so that
a fresh Django dev-server start doesn't hit the "Too many connections" wall
on the shared RDS instance.

Usage:
    venv\\Scripts\\python.exe manage.py kill_idle_connections
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Kill all sleeping MySQL connections for this user to free up the connection pool.'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Get all sleeping connections for our user
            cursor.execute("""
                SELECT id
                FROM information_schema.processlist
                WHERE command = 'Sleep'
                  AND user = USER()
                  AND id != CONNECTION_ID()
            """)
            rows = cursor.fetchall()

            if not rows:
                self.stdout.write(self.style.SUCCESS('No sleeping connections found — pool is clean.'))
                return

            killed = 0
            for (proc_id,) in rows:
                try:
                    cursor.execute(f'KILL {proc_id}')
                    killed += 1
                except Exception:
                    # Connection may have closed on its own — ignore
                    pass

            self.stdout.write(
                self.style.SUCCESS(f'Killed {killed} sleeping connection(s). Pool freed.')
            )
