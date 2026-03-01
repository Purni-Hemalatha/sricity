"""
Custom runserver command that skips the migration check so Django can start
even when the AWS RDS instance has 'too many connections'.
Once connections drain (usually within a few minutes), normal 'python manage.py runserver'
will work again and you can delete this file.
"""
from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    help = "Runs the development server WITHOUT the migration check (use when DB is overloaded)."

    def check_migrations(self):
        # Skip the DB hit at startup so we can start the server while connections drain.
        self.stdout.write(
            self.style.WARNING(
                "⚠  Migration check skipped (DB connection limit active). "
                "Use 'python manage.py migrate' when the DB is available."
            )
        )
